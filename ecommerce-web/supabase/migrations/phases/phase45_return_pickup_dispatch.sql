-- Automatically dispatch approved return/exchange pickups and let delivery staff
-- scan once for collection (out for delivery) and again for delivery completion.
begin;

alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check check (status in (
  'requested','approved','pickup_scheduled','picked_up','delivered','received',
  'exchange_dispatched','exchanged','rejected','refunded','cancelled'
));

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
    and status in ('requested','approved','pickup_scheduled','picked_up','delivered','received','exchange_dispatched');
  select max_open_requests_per_customer into max_open from public.returns_settings where id=true;
  if new.status in ('requested','approved','pickup_scheduled','picked_up','delivered','received','exchange_dispatched') and open_count>=coalesce(max_open,5) then
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
      and r.status in ('requested','approved','pickup_scheduled','picked_up','delivered','received','exchange_dispatched')) then
    raise exception 'ITEM_ALREADY_REQUESTED';
  end if;
  select coalesce(sum(ri.quantity),0)::integer into prior_qty from public.refund_items ri
    join public.refunds r on r.id=ri.refund_id
    where ri.order_item_id=new.order_item_id and r.status not in ('rejected','cancelled');
  if prior_qty+new.quantity>line_quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
  return new;
end;
$$;

drop policy if exists "customers read own refunds" on public.refunds;
create policy "customers read own refunds" on public.refunds for select to authenticated using(
  exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
  or public.current_role_has_permission('refunds:view')
  or (public.current_role_has_permission('refunds:pickup') and status in ('pickup_scheduled','picked_up'))
);
drop policy if exists "refund items read scoped" on public.refund_items;
create policy "refund items read scoped" on public.refund_items for select to authenticated using(
  exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
  or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
  or exists(select 1 from public.refunds r where r.id=refund_id and r.status in ('pickup_scheduled','picked_up') and public.current_role_has_permission('refunds:pickup'))
);
drop policy if exists "refund events read scoped" on public.refund_events;
create policy "refund events read scoped" on public.refund_events for select to authenticated using(
  exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
  or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
  or exists(select 1 from public.refunds r where r.id=refund_id and r.status in ('pickup_scheduled','picked_up') and public.current_role_has_permission('refunds:pickup'))
);

create or replace function public.approve_and_schedule_return_pickup(p_refund_id bigint)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; role_name text:=public.current_role(); old_status text; new_code text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.refunds where id=p_refund_id for update;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if r.type not in ('return_and_refund','exchange') then raise exception 'INVALID_REFUND_TYPE'; end if;
  if r.status not in ('requested','approved') then raise exception 'INVALID_REFUND_STEP'; end if;
  if not public.current_role_has_permission('refunds:decide') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  old_status:=r.status;
  new_code:=lpad((floor(random()*10000))::integer::text,4,'0');
  update public.refunds set status='pickup_scheduled',pickup_slot='Today or tomorrow',
    pickup_code=new_code,qr_payload=id::text||':'||new_code,decided_by=auth.uid(),decided_at=coalesce(decided_at,now()),updated_at=now()
    where id=r.id;
  insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note)
    values(r.id,old_status,'pickup_scheduled',auth.uid(),role_name,'Approved. Pickup is expected today or tomorrow and has been sent to delivery.');
  insert into public.notifications(user_id,title,body,link)
    values(r.requested_by,'Pickup scheduled',case when r.type='exchange' then 'Your exchange pickup is expected today or tomorrow.' else 'Your return pickup is expected today or tomorrow.' end,'/customer/orders/tracking?id='||r.order_id);
  insert into public.notifications(user_id,title,body,link)
    select u.id,'Pickup assigned','Return or exchange request #'||r.id||' for order #'||r.order_id||' is ready for collection.','/portal/'||coalesce(current_setting('app.admin_route_token',true),'')||'/delivery'
    from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text='delivery_boy';
  return true;
end;
$$;
revoke all on function public.approve_and_schedule_return_pickup(bigint) from public,anon;
grant execute on function public.approve_and_schedule_return_pickup(bigint) to authenticated;

create or replace function public.delivery_scan_return_pickup(p_refund_id bigint,p_pickup_code text)
returns text language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; next_status text; role_name text:=public.current_role(); note_text text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (public.current_role_has_permission('refunds:pickup') or public.current_role_has_permission('refunds:receive')) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into r from public.refunds where id=p_refund_id for update;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if r.type not in ('return_and_refund','exchange') then raise exception 'INVALID_REFUND_TYPE'; end if;
  if p_pickup_code is null or p_pickup_code<>r.pickup_code then raise exception 'INVALID_PICKUP_CODE'; end if;
  if r.status='pickup_scheduled' then
    next_status:='picked_up'; note_text:='Collected from customer; out for delivery.';
  elsif r.status='picked_up' then
    next_status:='delivered'; note_text:='Return package delivered to the store.';
  else raise exception 'INVALID_REFUND_STEP'; end if;
  update public.refunds set status=next_status,updated_at=now(),picked_up_at=case when next_status='picked_up' then now() else picked_up_at end where id=r.id;
  insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note)
    values(r.id,r.status,next_status,auth.uid(),role_name,note_text);
  insert into public.notifications(user_id,title,body,link)
    values(r.requested_by,case when next_status='picked_up' then 'Return picked up' else 'Return delivered' end,note_text,'/customer/orders/tracking?id='||r.order_id);
  return next_status;
end;
$$;
revoke all on function public.delivery_scan_return_pickup(bigint,text) from public,anon;
grant execute on function public.delivery_scan_return_pickup(bigint,text) to authenticated;

create or replace function public.receive_delivered_return(
  p_refund_id bigint,
  p_condition text,
  p_condition_note text,
  p_return_to_stock boolean,
  p_final_amount numeric default null,
  p_final_amount_reason text default null
)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; role_name text:=public.current_role(); order_key bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select order_id into order_key from public.refunds where id=p_refund_id;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  perform 1 from public.orders where id=order_key for update;
  select * into r from public.refunds where id=p_refund_id for update;
  if not found or r.type not in ('return_and_refund','exchange') then raise exception 'REFUND_NOT_FOUND'; end if;
  if r.status<>'delivered' then raise exception 'INVALID_REFUND_STEP'; end if;
  if not public.current_role_has_permission('refunds:receive') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_condition is null or p_condition not in ('Good','Damaged','Missing items') or nullif(trim(p_condition_note),'') is null or p_return_to_stock is null then raise exception 'RECEIPT_DETAILS_REQUIRED'; end if;
  if p_return_to_stock and p_condition<>'Good' then raise exception 'STOCK_RETURN_REQUIRES_GOOD_CONDITION'; end if;
  if r.type='exchange' and p_final_amount is not null then raise exception 'INVALID_FINAL_AMOUNT'; end if;
  if r.type='return_and_refund' and p_final_amount is not null then
    if p_final_amount<0 or p_final_amount>r.amount then raise exception 'INVALID_FINAL_AMOUNT'; end if;
    if p_final_amount<r.amount and nullif(trim(p_final_amount_reason),'') is null then raise exception 'FINAL_AMOUNT_REASON_REQUIRED'; end if;
  end if;
  update public.refunds set status='received',received_at=now(),updated_at=now(),decided_by=auth.uid(),
    item_condition=p_condition,condition_note=left(trim(p_condition_note),500),return_to_stock=p_return_to_stock,
    final_amount=case when r.type='return_and_refund' and p_final_amount is not null then p_final_amount else final_amount end,
    final_amount_reason=case when r.type='return_and_refund' and p_final_amount is not null and p_final_amount<r.amount then left(trim(p_final_amount_reason),500) else final_amount_reason end
    where id=r.id;
  if p_return_to_stock then
    perform public.admin_adjust_inventory_with_batch(oi.product_id,ri.quantity,'Returned',null,null)
      from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=r.id;
  end if;
  insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note)
    values(r.id,'delivered','received',auth.uid(),role_name,left(trim(p_condition_note),500));
  insert into public.notifications(user_id,title,body,link)
    values(r.requested_by,'Return received','The returned item was received and is being processed.','/customer/orders/tracking?id='||r.order_id);
  return true;
end;
$$;
revoke all on function public.receive_delivered_return(bigint,text,text,boolean,numeric,text) from public,anon;
grant execute on function public.receive_delivered_return(bigint,text,text,boolean,numeric,text) to authenticated;

notify pgrst, 'reload schema';
commit;
