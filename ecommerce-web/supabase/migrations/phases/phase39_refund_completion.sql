-- Complete the demo refund workflow without moving money.
alter table public.refunds add column if not exists refund_reference text;
alter table public.refunds add column if not exists refunded_at timestamptz;
alter table public.refunds add column if not exists return_to_stock boolean;
alter table public.refunds add column if not exists final_amount_reason text;
create unique index if not exists refunds_reference_unique on public.refunds(refund_reference) where refund_reference is not null;

-- Shared eligibility rule for UI-facing reads and request validation.
create or replace function public.refund_item_eligibility(p_order_id bigint,p_order_item_id bigint,p_reason text,p_type text default 'return_and_refund')
returns text language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype; li public.order_items%rowtype; remaining integer;
begin
 select * into o from public.orders where id=p_order_id;
 if not found or (o.user_id<>auth.uid() and not public.current_role_has_permission('refunds:view')) then return 'Order unavailable'; end if;
 if o.status<>'delivered' or o.delivered_at is null or o.delivered_at>now() or o.delivered_at<now()-interval '7 days' then return 'Return window closed'; end if;
 select * into li from public.order_items where id=p_order_item_id and order_id=p_order_id;
 if not found then return 'Item unavailable'; end if;
 select li.quantity-coalesce((select sum(ri.quantity) from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=li.id and rf.status not in ('rejected','cancelled')),0)::integer into remaining;
 if remaining<=0 then return 'Already requested'; end if;
 if p_type='return_and_refund' and p_reason not in ('Damaged or defective','Wrong item','Not as described') and not coalesce((select is_returnable from public.products where id=li.product_id),true) then return 'Not returnable'; end if;
 return null;
end $$;
revoke all on function public.refund_item_eligibility(bigint,bigint,text,text) from public,anon;
grant execute on function public.refund_item_eligibility(bigint,bigint,text,text) to authenticated;

-- Keep the existing centralized permission resolver as the only RPC authorization check.
create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
 select case public.current_role()
  when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'customer_support' then p_permission in ('complaints:manage','notifications:view','refunds:view','refunds:decide')
  when 'delivery_boy' then p_permission in ('orders:view','delivery:manage','notifications:view','refunds:pickup')
  when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
  else false end
$$;
alter table public.notifications add column if not exists link text;

drop policy if exists "customers read own refunds" on public.refunds;
create policy "customers read own refunds" on public.refunds for select to authenticated using(
 exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
 or (public.current_role_has_permission('refunds:view') and public.current_role()<>'picker')
 or (public.current_role_has_permission('delivery:manage') and status='pickup_scheduled')
);
drop policy if exists "refund items read scoped" on public.refund_items;
create policy "refund items read scoped" on public.refund_items for select to authenticated using(
 exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
 or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
 or exists(select 1 from public.refunds r where r.id=refund_id and r.status='pickup_scheduled' and public.current_role_has_permission('delivery:manage'))
);
drop policy if exists "refund events read scoped" on public.refund_events;
create policy "refund events read scoped" on public.refund_events for select to authenticated using(
 exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
 or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
 or exists(select 1 from public.refunds r where r.id=refund_id and r.status='pickup_scheduled' and public.current_role_has_permission('delivery:manage'))
);

create or replace function public.enforce_refund_amount_cap()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order_total numeric; v_paid numeric; v_reserved numeric;
begin
 select total into v_order_total from public.orders where id=new.order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 select amount into v_paid from public.payments where order_id=new.order_id order by id desc limit 1;
 select coalesce(sum(case when status='refunded' then coalesce(final_amount,amount) else amount end),0) into v_reserved
 from public.refunds where order_id=new.order_id and id is distinct from new.id and status not in ('rejected','cancelled');
 if v_reserved+new.amount>coalesce(v_paid,v_order_total,0) then raise exception 'REFUND_EXCEEDS_AMOUNT_PAID'; end if;
 return new;
end $$;
drop trigger if exists refunds_amount_cap on public.refunds;
create trigger refunds_amount_cap before insert or update of amount,status,final_amount on public.refunds for each row execute function public.enforce_refund_amount_cap();

create or replace function public.enforce_single_open_refund_per_line()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order_id bigint;
begin
 select order_id into v_order_id from public.refunds where id=new.refund_id;
 perform 1 from public.orders where id=v_order_id for update;
 if exists(select 1 from public.refund_items ri join public.refunds r on r.id=ri.refund_id where ri.order_item_id=new.order_item_id and r.id<>new.refund_id and r.status in ('requested','approved','pickup_scheduled','picked_up','received')) then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
 return new;
end $$;
drop trigger if exists refund_items_single_open on public.refund_items;
create trigger refund_items_single_open before insert or update on public.refund_items for each row execute function public.enforce_single_open_refund_per_line();

-- Make every transition sequential and idempotent, with permissions and refund reference enforced under row lock.
drop function if exists public.set_refund_status(bigint,text,text,text,text,text,numeric,text);
create function public.set_refund_status(p_refund_id bigint,p_status text,p_note text default null,p_pickup_slot text default null,p_condition text default null,p_condition_note text default null,p_final_amount numeric default null,p_final_amount_reason text default null,p_return_to_stock boolean default null) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; v_permission text; v_note text; v_paid numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_status not in ('approved','rejected','pickup_scheduled','picked_up','received','refunded') then raise exception 'INVALID_REFUND_STATUS'; end if;
 select * into r from public.refunds where id=p_refund_id for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 if r.status=p_status then return true; end if;
 v_permission:=case when p_status in ('approved','rejected') then 'refunds:decide' when p_status='picked_up' then 'refunds:pickup' when p_status='received' then 'refunds:receive' else 'refunds:pay' end;
 if not public.current_role_has_permission(v_permission) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not ((r.status='requested' and p_status in ('approved','rejected')) or (r.status='approved' and p_status in ('pickup_scheduled','refunded') and r.type='refund_only') or (r.status='pickup_scheduled' and p_status='picked_up') or (r.status='picked_up' and p_status='received') or (r.status='received' and p_status='refunded')) then raise exception 'INVALID_REFUND_STEP'; end if;
 if p_status='rejected' and nullif(trim(p_note),'') is null then raise exception 'REJECTION_NOTE_REQUIRED'; end if;
 if p_status='pickup_scheduled' and (p_pickup_slot is null or p_pickup_slot !~ '^\\d{4}-\\d{2}-\\d{2} [|] (10:00-12:00|16:00-18:00)$' or split_part(p_pickup_slot,' | ',1)::date<=current_date or split_part(p_pickup_slot,' | ',1)::date>current_date+3) then raise exception 'INVALID_PICKUP_SLOT'; end if;
 if p_status='received' then
  if p_condition not in ('Good','Damaged','Missing items') or nullif(trim(p_condition_note),'') is null or p_return_to_stock is null then raise exception 'RECEIPT_DETAILS_REQUIRED'; end if;
  if p_return_to_stock and p_condition<>'Good' then raise exception 'STOCK_RETURN_REQUIRES_GOOD_CONDITION'; end if;
 end if;
 if p_status='refunded' then
  if coalesce(p_final_amount,r.amount)<0 or coalesce(p_final_amount,r.amount)>r.amount then raise exception 'INVALID_FINAL_AMOUNT'; end if;
  if coalesce(p_final_amount,r.amount)<r.amount and nullif(trim(p_final_amount_reason),'') is null then raise exception 'FINAL_AMOUNT_REASON_REQUIRED'; end if;
  select amount into v_paid from public.payments where order_id=r.order_id order by id desc limit 1;
  if coalesce((select sum(coalesce(final_amount,amount)) from public.refunds where order_id=r.order_id and status='refunded' and id<>r.id),0)+coalesce(p_final_amount,r.amount)>coalesce(v_paid,0) then raise exception 'REFUND_EXCEEDS_AMOUNT_PAID'; end if;
 end if;
 v_note:=case when p_status='rejected' then left(trim(p_note),500) when p_status='received' then left(trim(p_condition_note),500) when p_status='refunded' and coalesce(p_final_amount,r.amount)<r.amount then left(trim(p_final_amount_reason),500) end;
 update public.refunds set status=p_status,updated_at=now(),decided_by=case when p_status in ('approved','rejected','received','refunded') then auth.uid() else decided_by end,
  decided_at=case when p_status in ('rejected','refunded') then now() else decided_at end,
  decision_note=case when p_status='rejected' then left(trim(p_note),500) else decision_note end,
  pickup_slot=case when p_status='pickup_scheduled' then p_pickup_slot else pickup_slot end,
  picked_up_at=case when p_status='picked_up' then now() else picked_up_at end,
  received_at=case when p_status='received' then now() else received_at end,
  item_condition=case when p_status='received' then p_condition else item_condition end,
  condition_note=case when p_status='received' then left(trim(p_condition_note),500) else condition_note end,
  return_to_stock=case when p_status='received' then p_return_to_stock else return_to_stock end,
  final_amount=case when p_status='refunded' then coalesce(p_final_amount,r.amount) else final_amount end,
  final_amount_reason=case when p_status='refunded' and coalesce(p_final_amount,r.amount)<r.amount then left(trim(p_final_amount_reason),500) else final_amount_reason end,
  refunded_at=case when p_status='refunded' then now() else refunded_at end,
  refund_reference=case when p_status='refunded' then coalesce(refund_reference,'RF-'||to_char(current_date,'YYYY')||'-'||lpad(p_refund_id::text,4,'0')) else refund_reference end
 where id=p_refund_id;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,note) values(p_refund_id,r.status,p_status,auth.uid(),v_note);
 if p_status='received' and p_return_to_stock then
  perform public.admin_adjust_inventory_with_batch(oi.product_id,ri.quantity,'Returned',null,null) from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=p_refund_id;
 elsif p_status='received' and not p_return_to_stock then
  insert into public.inventory_movements(product_id,quantity,movement_type,reference_type,reference_id,reason,actor_id)
  select oi.product_id,0,'damage','refund',p_refund_id::text,'Damaged write-off (zero-change receipt log)',auth.uid() from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=p_refund_id;
 end if;
 if r.requested_by is not null then insert into public.notifications(user_id,title,body,link) values(r.requested_by,'Return/refund update','Request for order #'||r.order_id||' is now '||replace(p_status,'_',' ')||case when p_status='rejected' then ': '||left(trim(p_note),300) else '.' end,'/customer/orders/tracking?id='||r.order_id); end if;
 if p_status='refunded' and not exists(select 1 from public.order_items oi where oi.order_id=r.order_id and oi.quantity>coalesce((select sum(ri.quantity) from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status='refunded'),0)) then update public.orders set status='refunded' where id=r.order_id and status in ('delivered','returned','cancelled'); end if;
 return true;
end $$;
revoke all on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean) from public,anon;
grant execute on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean) to authenticated;

notify pgrst, 'reload schema';
