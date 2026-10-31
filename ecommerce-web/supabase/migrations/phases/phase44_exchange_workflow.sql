-- Add exchanges to the existing return workflow without issuing any refund.
begin;

alter table public.refunds drop constraint if exists refunds_type_check;
alter table public.refunds add constraint refunds_type_check
  check (type in ('return_and_refund','refund_only','exchange'));

alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check
  check (status in ('requested','approved','pickup_scheduled','picked_up','received','exchange_dispatched','exchanged','rejected','refunded','cancelled'));

-- Existing refund-only requests remain readable and manageable, but new requests use only
-- return_and_refund or exchange through their respective RPCs.
create or replace function public.reject_new_refund_only_requests()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.type='refund_only' then raise exception 'INVALID_REFUND_TYPE'; end if;
  return new;
end;
$$;
drop trigger if exists refunds_reject_new_refund_only on public.refunds;
create trigger refunds_reject_new_refund_only before insert on public.refunds
  for each row execute function public.reject_new_refund_only_requests();

create or replace function public.guard_refund_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; paid_amount numeric; reserved numeric; open_count integer; max_open integer;
begin
  select user_id,total into owner_id,paid_amount from public.orders where id=new.order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select coalesce((select amount from public.payments where order_id=new.order_id order by id desc limit 1),paid_amount) into paid_amount;
  select coalesce(sum(case when status='refunded' then coalesce(final_amount,amount) else amount end),0)
    into reserved from public.refunds where order_id=new.order_id and id is distinct from new.id and status not in ('rejected','cancelled');
  if new.status not in ('rejected','cancelled') and reserved+new.amount>paid_amount then raise exception 'REFUND_EXCEEDS_AMOUNT_PAID'; end if;
  perform pg_advisory_xact_lock(hashtext(owner_id::text));
  select count(*) into open_count from public.refunds where requested_by=owner_id
    and status in ('requested','approved','pickup_scheduled','picked_up','received','exchange_dispatched');
  select max_open_requests_per_customer into max_open from public.returns_settings where id=true;
  if new.status in ('requested','approved','pickup_scheduled','picked_up','received','exchange_dispatched') and open_count>=coalesce(max_open,5) then
    raise exception 'TOO_MANY_OPEN_REQUESTS';
  end if;
  return new;
end;
$$;

create or replace function public.guard_refund_item_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare line_order_id bigint; line_quantity integer; prior_qty integer;
begin
  select order_id,quantity into line_order_id,line_quantity from public.order_items where id=new.order_item_id;
  if not found then raise exception 'INVALID_ORDER_ITEM'; end if;
  perform 1 from public.orders where id=line_order_id for update;
  if exists(select 1 from public.refund_items ri join public.refunds r on r.id=ri.refund_id
    where ri.order_item_id=new.order_item_id and ri.refund_id<>new.refund_id
      and r.status in ('requested','approved','pickup_scheduled','picked_up','received','exchange_dispatched')) then
    raise exception 'ITEM_ALREADY_REQUESTED';
  end if;
  select coalesce(sum(ri.quantity),0)::integer into prior_qty from public.refund_items ri
    join public.refunds r on r.id=ri.refund_id
    where ri.order_item_id=new.order_item_id and r.status not in ('rejected','cancelled');
  if prior_qty+new.quantity>line_quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
  return new;
end;
$$;

create or replace function public.create_exchange_request(
  p_order_id bigint default null,
  p_reason text default null,
  p_comment text default null,
  p_items jsonb default '[]',
  p_pickup_slot text default null,
  p_pickup_address_id bigint default null
)
returns bigint language plpgsql security definer set search_path=public as $$
declare
  o public.orders%rowtype; request_id bigint; entry jsonb; item_id bigint; qty integer;
  remaining record; max_open integer; open_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_reason is null or p_reason not in ('Changed my mind','Wrong item','Damaged or defective','Not as described','Other') then
    raise exception 'INVALID_REASON';
  end if;
  if p_reason='Other' and nullif(trim(p_comment),'') is null then raise exception 'COMMENT_REQUIRED'; end if;
  if coalesce(jsonb_typeof(p_items),'')<>'array' or jsonb_array_length(coalesce(p_items,'[]'))=0 then raise exception 'SELECT_ITEMS'; end if;
  if o.address_id is null or p_pickup_address_id is distinct from o.address_id then raise exception 'PICKUP_ADDRESS_MUST_MATCH_ORDER'; end if;
  if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
  if split_part(p_pickup_slot,' | ',1)::date not between current_date+1 and current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select max_open_requests_per_customer into max_open from public.returns_settings where id=true;
  select count(*) into open_count from public.refunds where requested_by=auth.uid()
    and status in ('requested','approved','pickup_scheduled','picked_up','received','exchange_dispatched');
  if open_count>=coalesce(max_open,5) then raise exception 'TOO_MANY_OPEN_REQUESTS'; end if;
  for entry in select * from jsonb_array_elements(p_items) loop
    item_id:=(entry->>'order_item_id')::bigint; qty:=(entry->>'quantity')::integer;
    if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
    select * into remaining from public.get_return_eligibility(p_order_id) e where e.order_item_id=item_id;
    if not found then raise exception 'INVALID_ORDER_ITEM'; end if;
    if not remaining.return_possible then raise exception 'ITEM_NOT_ELIGIBLE:%',coalesce(remaining.reason_code,'not_returnable'); end if;
    if qty>remaining.refundable_quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
  end loop;
  insert into public.refunds(order_id,requested_by,status,reason,comment,amount,fee_amount,method,photo_paths,type,pickup_slot,pickup_address_id,auto_approved)
  values(p_order_id,auth.uid(),'requested',p_reason,left(p_comment,300),0,0,'No refund - exchange','{}','exchange',p_pickup_slot,p_pickup_address_id,false)
  returning id into request_id;
  for entry in select * from jsonb_array_elements(p_items) loop
    item_id:=(entry->>'order_item_id')::bigint; qty:=(entry->>'quantity')::integer;
    insert into public.refund_items(refund_id,order_item_id,quantity,amount) values(request_id,item_id,qty,0);
  end loop;
  insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note)
    values(request_id,null,'requested',auth.uid(),'customer','Exchange requested; no refund will be issued.');
  insert into public.notifications(user_id,title,body,link)
    select u.id,'Exchange request needs review','Exchange request #'||request_id||' for order #'||p_order_id||' needs review.',
      '/portal/'||coalesce(current_setting('app.admin_route_token',true),'')||'/refunds'
    from public.users u join public.roles ro on ro.id=u.role_id
    where ro.name::text in ('store_manager','customer_support');
  return request_id;
end;
$$;
revoke all on function public.create_exchange_request(bigint,text,text,jsonb,text,bigint) from public,anon;
grant execute on function public.create_exchange_request(bigint,text,text,jsonb,text,bigint) to authenticated;

create or replace function public.set_exchange_status(
  p_refund_id bigint default null,
  p_status text default null,
  p_note text default null,
  p_pickup_slot text default null,
  p_condition text default null,
  p_condition_note text default null,
  p_return_to_stock boolean default null,
  p_pickup_code text default null
)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  r public.refunds%rowtype; role_name text:=public.current_role(); need text; old_status text;
  order_key bigint; new_code text; note_text text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select order_id into order_key from public.refunds where id=p_refund_id;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  perform 1 from public.orders where id=order_key for update;
  select * into r from public.refunds where id=p_refund_id for update;
  if not found or r.type<>'exchange' then raise exception 'EXCHANGE_NOT_FOUND'; end if;
  if r.status=p_status then return true; end if;
  old_status:=r.status;
  need:=case when p_status in ('approved','rejected') then 'refunds:decide'
    when p_status='picked_up' and role_name='delivery_boy' then 'refunds:pickup'
    when p_status in ('pickup_scheduled','picked_up','received','exchange_dispatched','exchanged') then 'refunds:receive'
    else null end;
  if need is null or not public.current_role_has_permission(need) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if not ((r.status='requested' and p_status in ('approved','rejected'))
    or (r.status='approved' and p_status='pickup_scheduled')
    or (r.status='pickup_scheduled' and p_status='picked_up')
    or (r.status='picked_up' and p_status='received')
    or (r.status='received' and p_status='exchange_dispatched')
    or (r.status='exchange_dispatched' and p_status='exchanged')) then
    raise exception 'INVALID_REFUND_STEP';
  end if;
  if p_status='rejected' and nullif(trim(p_note),'') is null then raise exception 'REJECTION_NOTE_REQUIRED'; end if;
  if p_status='pickup_scheduled' then
    if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
    if split_part(p_pickup_slot,' | ',1)::date not between current_date+1 and current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
    new_code:=lpad((floor(random()*10000))::integer::text,4,'0');
    update public.refunds set pickup_code=new_code,qr_payload=id::text||':'||new_code where id=r.id;
  end if;
  if p_status='picked_up' and p_pickup_code is not null and p_pickup_code<>r.pickup_code then raise exception 'INVALID_PICKUP_CODE'; end if;
  if p_status='received' and (p_condition not in ('Good','Damaged','Missing items') or nullif(trim(p_condition_note),'') is null or p_return_to_stock is null) then
    raise exception 'RECEIPT_DETAILS_REQUIRED';
  end if;
  if p_status='received' and p_return_to_stock and p_condition<>'Good' then raise exception 'STOCK_RETURN_REQUIRES_GOOD_CONDITION'; end if;
  if p_status='exchange_dispatched' then
    if not public.current_role_has_permission('inventory:adjust') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    perform public.admin_adjust_inventory_with_batch(oi.product_id,-ri.quantity,'Exchange replacement dispatched',null,null)
      from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=r.id;
  end if;
  if p_status='pickup_scheduled' then
    update public.refunds set pickup_slot=p_pickup_slot,pickup_reschedules=0 where id=r.id;
  end if;
  update public.refunds set status=p_status,updated_at=now(),
    decided_by=case when p_status in ('approved','rejected','received','exchanged') then auth.uid() else decided_by end,
    decided_at=case when p_status in ('rejected','exchanged') then now() else decided_at end,
    decision_note=case when p_status='rejected' then left(trim(p_note),500) else decision_note end,
    pickup_slot=case when p_status='pickup_scheduled' then p_pickup_slot else pickup_slot end,
    picked_up_at=case when p_status='picked_up' then now() else picked_up_at end,
    received_at=case when p_status='received' then now() else received_at end,
    item_condition=case when p_status='received' then p_condition else item_condition end,
    condition_note=case when p_status='received' then left(trim(p_condition_note),500) else condition_note end,
    return_to_stock=case when p_status='received' then p_return_to_stock else return_to_stock end
    where id=r.id;
  if p_status='received' and p_return_to_stock then
    perform public.admin_adjust_inventory_with_batch(oi.product_id,ri.quantity,'Exchange return received',null,null)
      from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=r.id;
  end if;
  note_text:=case when p_status='rejected' then left(trim(p_note),500)
    when p_status='received' then left(trim(p_condition_note),500)
    when p_status='exchange_dispatched' then 'Replacement dispatched; stock deducted.'
    when p_status='exchanged' then 'Replacement delivered; exchange complete.' end;
  insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note)
    values(r.id,old_status,p_status,auth.uid(),role_name,note_text);
  insert into public.notifications(user_id,title,body,link)
    values(r.requested_by,'Exchange update','Exchange request #'||r.id||' for order #'||r.order_id||' is now '||replace(p_status,'_',' ')||'.','/customer/orders/tracking?id='||r.order_id);
  if p_status='pickup_scheduled' then
    insert into public.notifications(user_id,title,body,link)
      select u.id,'Exchange pickup scheduled','Pickup for exchange #'||r.id||' is scheduled for '||p_pickup_slot,
        '/portal/'||coalesce(current_setting('app.admin_route_token',true),'')||'/delivery'
      from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text='delivery_boy';
  end if;
  return true;
end;
$$;
revoke all on function public.set_exchange_status(bigint,text,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.set_exchange_status(bigint,text,text,text,text,text,boolean,text) to authenticated;

notify pgrst, 'reload schema';
commit;
