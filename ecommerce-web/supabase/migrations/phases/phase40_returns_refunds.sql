-- Cartly returns/refunds hardening. Apply after phase22_returns.sql.
-- This replaces the unapplied phase39 draft; RPC names already exist in phase21/22.
begin;

-- The phase22 seed used a fixed product ID to disable returns. AirPods are
-- returnable; repair the catalog record by name because IDs differ per project.
update public.products set is_returnable=true where lower(name) like '%airpod%' and is_returnable is distinct from true;

create table if not exists public.returns_settings (
  id boolean primary key default true check (id),
  return_window_days integer not null check (return_window_days > 0),
  refund_eta text not null,
  auto_approve_max_amount numeric(12,2) not null check (auto_approve_max_amount >= 0),
  auto_approve_reasons text[] not null,
  max_open_requests_per_customer integer not null check (max_open_requests_per_customer > 0),
  pickup_reschedules_allowed integer not null check (pickup_reschedules_allowed >= 0),
  request_sla_hours integer not null check (request_sla_hours > 0),
  attachments_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.returns_settings(id,return_window_days,refund_eta,auto_approve_max_amount,auto_approve_reasons,max_open_requests_per_customer,pickup_reschedules_allowed,request_sla_hours,attachments_enabled)
values(true,7,'5-7 business days',5000,array['changed my mind','wrong item','damaged or defective','not as described'],5,1,24,false)
on conflict(id) do nothing;
alter table public.returns_settings enable row level security;
drop policy if exists "returns settings readable by authenticated" on public.returns_settings;
create policy "returns settings readable by authenticated" on public.returns_settings for select to authenticated using(true);
revoke insert,update,delete on public.returns_settings from anon,authenticated;
grant select on public.returns_settings to authenticated;

create or replace function public.get_returns_settings(p_unused boolean default true)
returns public.returns_settings language sql stable security definer set search_path=public as $$
  select * from public.returns_settings where id=true
$$;
revoke all on function public.get_returns_settings(boolean) from public,anon;
grant execute on function public.get_returns_settings(boolean) to authenticated;

alter table public.refunds add column if not exists auto_approved boolean not null default false;
alter table public.refunds add column if not exists refund_reference text;
alter table public.refunds add column if not exists refunded_at timestamptz;
alter table public.refunds add column if not exists return_to_stock boolean;
alter table public.refunds add column if not exists final_amount_reason text;
alter table public.refunds add column if not exists pickup_code text;
alter table public.refunds add column if not exists qr_payload text;
alter table public.refunds add column if not exists pickup_reschedules integer not null default 0;
alter table public.refunds add column if not exists expected_arrival_at timestamptz;
alter table public.refund_events add column if not exists actor_role text;
alter table public.notifications add column if not exists link text;
create unique index if not exists refunds_reference_unique on public.refunds(refund_reference) where refund_reference is not null;
create unique index if not exists refunds_pickup_code_unique on public.refunds(pickup_code) where pickup_code is not null;

-- Extend the project's existing permission resolver. UI grants are mirrored in lib/permission-definitions.ts.
create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
 select case public.current_role()
  when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','messages:send','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','messages:send','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view','messages:send','refunds:view','refunds:decide','refunds:receive','refunds:pay')
  when 'customer_support' then p_permission in ('complaints:manage','notifications:view','refunds:view','refunds:decide')
  when 'delivery_boy' then p_permission in ('orders:view','delivery:manage','notifications:view','refunds:pickup')
  when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
  else false end
$$;
revoke all on function public.current_role_has_permission(text) from public,anon;
grant execute on function public.current_role_has_permission(text) to authenticated;

-- A customer cancellation RPC already checks ownership, locks the order and only permits
-- placed/accepted orders. The status trigger must allow that same guarded transition.
create or replace function public.enforce_order_status_permission()
returns trigger language plpgsql security definer set search_path=public as $$
declare role_name text:=public.current_role();
begin
 if new.status is not distinct from old.status or auth.uid() is null then return new; end if;
 if old.user_id=auth.uid() and old.status in ('placed','accepted') and new.status='cancelled' then return new; end if;
 if role_name='picker' then
  if old.status<>'picking' or new.status<>'packed' then raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode='42501'; end if;
 elsif role_name in ('store_manager','super_admin','admin') then
  if not ((old.status='placed' and new.status in ('accepted','cancelled')) or (old.status='accepted' and new.status in ('picking','cancelled')) or (old.status='picking' and new.status='packed') or (old.status='packed' and new.status='out_for_delivery') or (old.status='out_for_delivery' and new.status='delivered') or (old.status='delivered' and new.status='returned') or (new.status='refunded' and old.status in ('cancelled','returned','delivered'))) then raise exception 'INVALID_STATUS_TRANSITION' using errcode='22023'; end if;
 else
  raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode='42501';
 end if;
 return new;
end $$;

drop policy if exists "customers read own refunds" on public.refunds;
create policy "customers read own refunds" on public.refunds for select to authenticated using(
 exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid())
 or public.current_role_has_permission('refunds:view')
 or (public.current_role_has_permission('refunds:pickup') and status='pickup_scheduled')
);
drop policy if exists "refund items read scoped" on public.refund_items;
create policy "refund items read scoped" on public.refund_items for select to authenticated using(
 exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
 or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
 or exists(select 1 from public.refunds r where r.id=refund_id and r.status='pickup_scheduled' and public.current_role_has_permission('refunds:pickup'))
);
drop policy if exists "refund events read scoped" on public.refund_events;
create policy "refund events read scoped" on public.refund_events for select to authenticated using(
 exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and o.user_id=auth.uid())
 or exists(select 1 from public.refunds r where r.id=refund_id and public.current_role_has_permission('refunds:view'))
 or exists(select 1 from public.refunds r where r.id=refund_id and r.status='pickup_scheduled' and public.current_role_has_permission('refunds:pickup'))
);

-- Eligibility is the sole SQL source for the UI and request RPC. A perishable can have a refund-only route,
-- but cannot be returned for a non-fault reason.
drop function if exists public.get_return_eligibility(bigint);
create function public.get_return_eligibility(p_order_id bigint default null)
returns table(order_item_id bigint,product_id bigint,ordered_quantity integer,refundable_quantity integer,return_possible boolean,refund_only_possible boolean,deadline timestamptz,reason_code text)
language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype; payment_method text; payment_status text; window_days integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id;
 if not found or (o.user_id<>auth.uid() and not public.current_role_has_permission('refunds:view')) then raise exception 'ORDER_NOT_FOUND'; end if;
 select method,status into payment_method,payment_status from public.payments where order_id=p_order_id order by id desc limit 1;
 select s.return_window_days into window_days from public.returns_settings s where s.id=true;
 return query
 select oi.id,oi.product_id,oi.quantity,
   greatest(0,oi.quantity-coalesce((select sum(ri.quantity)::integer from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')),0)),
   (coalesce(pr.is_returnable,true) and o.status='delivered' and o.delivered_at is not null and o.delivered_at<=now() and o.delivered_at>=now()-make_interval(days=>window_days) and ((lower(coalesce(payment_method,'')) in ('cod','cash on delivery') and lower(coalesce(payment_status,'')) in ('paid','captured','succeeded','completed')) or (lower(coalesce(payment_method,'')) not in ('cod','cash on delivery') and lower(coalesce(payment_status,'')) in ('captured','paid','succeeded','completed'))) and oi.quantity>coalesce((select sum(ri.quantity)::integer from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')))),
   (o.status='delivered' and o.delivered_at is not null and o.delivered_at<=now() and o.delivered_at>=now()-make_interval(days=>window_days) and ((lower(coalesce(payment_method,'')) in ('cod','cash on delivery') and lower(coalesce(payment_status,'')) in ('paid','captured','succeeded','completed')) or (lower(coalesce(payment_method,'')) not in ('cod','cash on delivery') and lower(coalesce(payment_status,'')) in ('captured','paid','succeeded','completed'))) and oi.quantity>coalesce((select sum(ri.quantity)::integer from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')))),
   o.delivered_at+make_interval(days=>window_days),
   case when o.status<>'delivered' then 'not_delivered'
        when o.delivered_at is null or o.delivered_at>now() or o.delivered_at<now()-make_interval(days=>window_days) then 'window_closed'
        when lower(coalesce(payment_status,'')) not in ('captured','paid','succeeded','completed') then 'not_paid'
        when oi.quantity<=coalesce((select sum(ri.quantity)::integer from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')),0) then 'already_requested'
        when not coalesce(pr.is_returnable,true) then 'not_returnable' else null end
 from public.order_items oi join public.products pr on pr.id=oi.product_id where oi.order_id=p_order_id order by oi.id;
end $$;
revoke all on function public.get_return_eligibility(bigint) from public,anon;
grant execute on function public.get_return_eligibility(bigint) to authenticated;

-- Per-line cents use saved unit price, coupon and GST snapshots; a full selection receives any exact rounding residual.
create or replace function public.calculate_refund_line_amount(p_order_item_id bigint default null,p_quantity integer default null)
returns numeric language plpgsql stable security definer set search_path=public as $$
declare li public.order_items%rowtype; total_cents bigint; base_cents bigint; remainder_cents bigint; previous_qty bigint; owner_id uuid;
begin
 select oi.* into li from public.order_items oi where oi.id=p_order_item_id;
 if not found or p_quantity is null or p_quantity<1 or p_quantity>li.quantity then raise exception 'INVALID_ORDER_ITEM_QUANTITY'; end if;
 select o.user_id into owner_id from public.orders o where o.id=li.order_id;
 if auth.uid() is null or (owner_id<>auth.uid() and not public.current_role_has_permission('refunds:view')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 total_cents:=round((li.unit_price*li.quantity+li.gst_amount-li.discount_amount)*100)::bigint;
 base_cents:=floor(total_cents::numeric/li.quantity)::bigint;
 remainder_cents:=total_cents-base_cents*li.quantity;
 select coalesce(sum(ri.quantity),0) into previous_qty from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=li.id and rf.status not in ('rejected','cancelled');
 return ((base_cents*p_quantity+greatest(0,least(p_quantity,remainder_cents-previous_qty)))/100.0)::numeric(12,2);
end $$;
revoke all on function public.calculate_refund_line_amount(bigint,integer) from public,anon;
grant execute on function public.calculate_refund_line_amount(bigint,integer) to authenticated;

create or replace function public.preview_refund_request(p_order_id bigint default null,p_reason text default null,p_items jsonb default '[]',p_type text default 'return_and_refund')
returns table(items_subtotal numeric,coupon_discount numeric,gst_amount numeric,fee_amount numeric,total_amount numeric)
language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype; li public.order_items%rowtype; entry jsonb; item_id bigint; qty integer; item_total numeric:=0; subtotal_total numeric:=0; discount_total numeric:=0; gst_total numeric:=0; fee_total numeric:=0; paid numeric; previous_qty bigint; cents bigint; base_cents bigint; remainder_cents bigint;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id and user_id=auth.uid();
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_type not in ('return_and_refund','refund_only') then raise exception 'INVALID_REFUND_TYPE'; end if;
 if p_type='refund_only' and p_reason not in ('Wrong item','Damaged or defective','Not as described') then raise exception 'REFUND_ONLY_REASON_REQUIRED'; end if;
 if coalesce(jsonb_typeof(p_items),'')<>'array' or jsonb_array_length(coalesce(p_items,'[]'))=0 then raise exception 'SELECT_ITEMS'; end if;
 for entry in select * from jsonb_array_elements(p_items) loop
  item_id:=(entry->>'order_item_id')::bigint; qty:=(entry->>'quantity')::integer;
  if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
  if not exists(select 1 from public.get_return_eligibility(p_order_id) e where e.order_item_id=item_id and e.refundable_quantity>=qty and ((p_type='return_and_refund' and e.return_possible) or (p_type='refund_only' and e.refund_only_possible))) then raise exception 'ITEM_NOT_ELIGIBLE'; end if;
  select * into li from public.order_items where id=item_id;
  select coalesce(sum(ri.quantity),0) into previous_qty from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=item_id and rf.status not in ('rejected','cancelled');
  item_total:=item_total+public.calculate_refund_line_amount(item_id,qty);
  subtotal_total:=subtotal_total+li.unit_price*qty;
  cents:=round(li.discount_amount*100)::bigint; base_cents:=floor(cents::numeric/li.quantity)::bigint; remainder_cents:=cents-base_cents*li.quantity;
  discount_total:=discount_total+(base_cents*qty+greatest(0,least(qty,remainder_cents-previous_qty)))/100.0;
  cents:=round(li.gst_amount*100)::bigint; base_cents:=floor(cents::numeric/li.quantity)::bigint; remainder_cents:=cents-base_cents*li.quantity;
  gst_total:=gst_total+(base_cents*qty+greatest(0,least(qty,remainder_cents-previous_qty)))/100.0;
 end loop;
 select amount into paid from public.payments where order_id=p_order_id order by id desc limit 1;
 if p_reason in ('Wrong item','Damaged or defective','Not as described') and not exists(select 1 from public.refunds where order_id=p_order_id and status not in ('rejected','cancelled')) and
   (select coalesce(sum((j->>'quantity')::integer),0) from jsonb_array_elements(p_items) j)=(select coalesce(sum(oi.quantity),0) from public.order_items oi where oi.order_id=p_order_id) then
   select greatest(0,coalesce(paid,o.total)-(select coalesce(sum(oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount),0) from public.order_items oi where oi.order_id=p_order_id)) into fee_total;
 end if;
 return query select subtotal_total,discount_total,gst_total,fee_total,item_total+fee_total;
end $$;
revoke all on function public.preview_refund_request(bigint,text,jsonb,text) from public,anon;
grant execute on function public.preview_refund_request(bigint,text,jsonb,text) to authenticated;

-- Second-line defence for direct inserts: order lock, paid-amount cap, customer open request limit and single open line.
create or replace function public.guard_refund_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; paid_amount numeric; reserved numeric; open_count integer; max_open integer;
begin
 select user_id,total into owner_id,paid_amount from public.orders where id=new.order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 select coalesce((select amount from public.payments where order_id=new.order_id order by id desc limit 1),paid_amount) into paid_amount;
 select coalesce(sum(case when status='refunded' then coalesce(final_amount,amount) else amount end),0) into reserved from public.refunds where order_id=new.order_id and status not in ('rejected','cancelled');
 if new.status not in ('rejected','cancelled') and reserved+new.amount>paid_amount then raise exception 'REFUND_EXCEEDS_AMOUNT_PAID'; end if;
 perform pg_advisory_xact_lock(hashtext(owner_id::text));
 select count(*) into open_count from public.refunds where requested_by=owner_id and status in ('requested','approved','pickup_scheduled','picked_up','received');
 select max_open_requests_per_customer into max_open from public.returns_settings where id=true;
 if new.status in ('requested','approved','pickup_scheduled','picked_up','received') and open_count>=max_open then raise exception 'TOO_MANY_OPEN_REQUESTS'; end if;
 return new;
end $$;
drop trigger if exists refunds_guard_insert on public.refunds;
create trigger refunds_guard_insert before insert on public.refunds for each row execute function public.guard_refund_insert();

create or replace function public.guard_refund_item_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare line_order_id bigint; line_quantity integer; prior_qty integer;
begin
 select order_id,quantity into line_order_id,line_quantity from public.order_items where id=new.order_item_id;
 if not found then raise exception 'INVALID_ORDER_ITEM'; end if;
 perform 1 from public.orders where id=line_order_id for update;
 if exists(select 1 from public.refund_items ri join public.refunds r on r.id=ri.refund_id where ri.order_item_id=new.order_item_id and ri.refund_id<>new.refund_id and r.status in ('requested','approved','pickup_scheduled','picked_up','received')) then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
 select coalesce(sum(ri.quantity),0)::integer into prior_qty from public.refund_items ri join public.refunds r on r.id=ri.refund_id where ri.order_item_id=new.order_item_id and r.status not in ('rejected','cancelled');
 if prior_qty+new.quantity>line_quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
 return new;
end $$;
drop trigger if exists refund_items_guard_insert on public.refund_items;
create trigger refund_items_guard_insert before insert on public.refund_items for each row execute function public.guard_refund_item_insert();

-- Customer creation recalculates every amount from order snapshots, consults shared eligibility and locks the order.
drop function if exists public.create_refund_request(bigint,text,text,jsonb,text[],text,text,bigint);
drop function if exists public.create_refund_request(bigint,text,text,jsonb,text[]);
create function public.create_refund_request(p_order_id bigint default null,p_reason text default null,p_comment text default null,p_items jsonb default '[]',p_photos text[] default '{}',p_type text default 'return_and_refund',p_pickup_slot text default null,p_pickup_address_id bigint default null)
returns bigint language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; r bigint; entry jsonb; item_id bigint; qty integer; line_total numeric:=0; fee_total numeric:=0; paid numeric; payment_method text; auto_ok boolean; remaining record; blocked text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if cardinality(coalesce(p_photos,'{}'))>0 then raise exception 'ATTACHMENTS_DISABLED'; end if;
 select * into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_reason is null or p_reason not in ('Changed my mind','Wrong item','Damaged or defective','Not as described','Other') then raise exception 'INVALID_REASON'; end if;
 if p_reason='Other' and nullif(trim(p_comment),'') is null then raise exception 'COMMENT_REQUIRED'; end if;
 if p_type not in ('return_and_refund','refund_only') then raise exception 'INVALID_REFUND_TYPE'; end if;
 if p_type='refund_only' and p_reason not in ('Wrong item','Damaged or defective','Not as described') then raise exception 'REFUND_ONLY_REASON_REQUIRED'; end if;
 if coalesce(jsonb_typeof(p_items),'')<>'array' or jsonb_array_length(coalesce(p_items,'[]'))=0 then raise exception 'SELECT_ITEMS'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.refunds where requested_by=auth.uid() and status in ('requested','approved','pickup_scheduled','picked_up','received')) >= (select max_open_requests_per_customer from public.returns_settings where id=true) then raise exception 'TOO_MANY_OPEN_REQUESTS'; end if;
 select method,amount into payment_method,paid from public.payments where order_id=p_order_id order by id desc limit 1;
 for entry in select * from jsonb_array_elements(p_items) loop
  item_id:=(entry->>'order_item_id')::bigint; qty:=(entry->>'quantity')::integer;
  if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
  select * into remaining from public.get_return_eligibility(p_order_id) e where e.order_item_id=item_id;
  if not found then raise exception 'INVALID_ORDER_ITEM'; end if;
  if p_type='return_and_refund' and not remaining.return_possible then
    if remaining.reason_code is not null then raise exception 'ITEM_NOT_ELIGIBLE:%',remaining.reason_code; end if;
    raise exception 'ITEM_NOT_RETURNABLE';
  end if;
  if p_type='refund_only' and not remaining.refund_only_possible then raise exception 'ITEM_NOT_ELIGIBLE:%',coalesce(remaining.reason_code,'not_delivered'); end if;
  if qty>remaining.refundable_quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
  line_total:=line_total+public.calculate_refund_line_amount(item_id,qty);
 end loop;
 if p_type='return_and_refund' then
  if o.address_id is null or p_pickup_address_id is distinct from o.address_id then raise exception 'PICKUP_ADDRESS_MUST_MATCH_ORDER'; end if;
  if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
  if split_part(p_pickup_slot,' | ',1)::date not between current_date+1 and current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
 end if;
 if p_reason in ('Wrong item','Damaged or defective','Not as described') and not exists(select 1 from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where rf.order_id=p_order_id and rf.status not in ('rejected','cancelled')) then
  if (select coalesce(sum((j->>'quantity')::integer),0) from jsonb_array_elements(p_items) j)=
     (select coalesce(sum(oi.quantity),0) from public.order_items oi where oi.order_id=p_order_id) then
   select greatest(0,coalesce(paid,o.total)-(select coalesce(sum(oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount),0) from public.order_items oi where oi.order_id=p_order_id)) into fee_total;
   line_total:=line_total+fee_total;
  end if;
 end if;
 select line_total<=auto_approve_max_amount and lower(p_reason)=any(auto_approve_reasons) and not exists(select 1 from public.refunds where order_id=p_order_id and status in ('requested','approved','pickup_scheduled','picked_up','received')) into auto_ok from public.returns_settings where id=true;
 insert into public.refunds(order_id,requested_by,status,reason,comment,amount,fee_amount,method,photo_paths,type,pickup_slot,pickup_address_id,auto_approved,decided_by,decided_at)
 values(p_order_id,auth.uid(),case when auto_ok then 'approved' else 'requested' end,p_reason,left(p_comment,300),line_total,fee_total,case when lower(coalesce(payment_method,'')) in ('cod','cash on delivery') then 'Contact customer' else 'Original payment method' end,'{}',p_type,case when p_type='return_and_refund' then p_pickup_slot end,case when p_type='return_and_refund' then p_pickup_address_id end,auto_ok,null,case when auto_ok then now() end) returning id into r;
 for entry in select * from jsonb_array_elements(p_items) loop
  item_id:=(entry->>'order_item_id')::bigint; qty:=(entry->>'quantity')::integer;
  insert into public.refund_items(refund_id,order_item_id,quantity,amount) values(r,item_id,qty,public.calculate_refund_line_amount(item_id,qty));
 end loop;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note) values(r,null,case when auto_ok then 'approved' else 'requested' end,case when auto_ok then null else auth.uid() end,case when auto_ok then 'system' else public.current_role() end,case when auto_ok then 'Auto-approved by demo rules' else null end);
 if auto_ok then
  insert into public.notifications(user_id,title,body,link) values(auth.uid(),'Return request approved','Request #'||r||' for order #'||p_order_id||' was approved instantly.','/customer/orders/tracking?id='||p_order_id);
 else
  insert into public.notifications(user_id,title,body,link) select u.id,'Return request needs review','Request #'||r||' for order #'||p_order_id||' needs review.','/portal/'||coalesce(current_setting('app.admin_route_token',true),'')||'/refunds' from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text in ('store_manager','customer_support');
 end if;
 return r;
end $$;
revoke all on function public.create_refund_request(bigint,text,text,jsonb,text[],text,text,bigint) from public,anon;
grant execute on function public.create_refund_request(bigint,text,text,jsonb,text[],text,text,bigint) to authenticated;

create or replace function public.refund_expected_arrival(p_refunded_at timestamptz default now())
returns timestamptz language plpgsql immutable set search_path=public as $$
declare d date:=(p_refunded_at at time zone 'Asia/Kolkata')::date; days_added integer:=0;
begin
 while days_added<7 loop
  d:=d+1;
  if extract(isodow from d)<6 then days_added:=days_added+1; end if;
 end loop;
 return d::timestamp at time zone 'Asia/Kolkata';
end $$;
revoke all on function public.refund_expected_arrival(timestamptz) from public,anon;
grant execute on function public.refund_expected_arrival(timestamptz) to authenticated;

create or replace function public.reschedule_return_pickup(p_refund_id bigint default null,p_pickup_slot text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select order_id into r.order_id from public.refunds where id=p_refund_id;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 perform 1 from public.orders where id=r.order_id and user_id=auth.uid() for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 select * into r from public.refunds where id=p_refund_id for update;
 if r.status<>'pickup_scheduled' or r.pickup_reschedules >= (select pickup_reschedules_allowed from public.returns_settings where id=true) then raise exception 'PICKUP_RESCHEDULE_LIMIT'; end if;
 if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
 if split_part(p_pickup_slot,' | ',1)::date not between current_date+1 and current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
 update public.refunds set pickup_slot=p_pickup_slot,pickup_reschedules=pickup_reschedules+1,updated_at=now() where id=r.id;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note) values(r.id,'pickup_scheduled','pickup_scheduled',auth.uid(),'customer','Pickup rescheduled to '||p_pickup_slot);
 insert into public.notifications(user_id,title,body,link) values(r.requested_by,'Pickup rescheduled','Pickup for request #'||r.id||' was rescheduled to '||p_pickup_slot,'/customer/orders/tracking?id='||r.order_id);
 return true;
end $$;
revoke all on function public.reschedule_return_pickup(bigint,text) from public,anon;
grant execute on function public.reschedule_return_pickup(bigint,text) to authenticated;

-- All progress is a single locked transition. No-op repeats create neither events nor notifications.
drop function if exists public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean,text);
drop function if exists public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean);
drop function if exists public.set_refund_status(bigint,text,text,text,text,text,numeric,text);
drop function if exists public.set_refund_status(bigint,text,text);
create function public.set_refund_status(p_refund_id bigint default null,p_status text default null,p_note text default null,p_pickup_slot text default null,p_condition text default null,p_condition_note text default null,p_final_amount numeric default null,p_final_amount_reason text default null,p_return_to_stock boolean default null,p_pickup_code text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; need text; role_name text:=public.current_role(); note_text text; paid numeric; old_status text; order_key bigint; new_code text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select order_id into order_key from public.refunds where id=p_refund_id;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 perform 1 from public.orders where id=order_key for update;
 select * into r from public.refunds where id=p_refund_id for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 if r.status=p_status then return true; end if;
 old_status:=r.status;
 need:=case when p_status in ('approved','rejected') then 'refunds:decide' when p_status='picked_up' and role_name='delivery_boy' then 'refunds:pickup' when p_status='picked_up' then 'refunds:receive' when p_status='received' then 'refunds:receive' when p_status='refunded' then 'refunds:pay' when p_status='pickup_scheduled' then 'refunds:receive' else null end;
 if need is null or not public.current_role_has_permission(need) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not ((r.status='requested' and p_status in ('approved','rejected')) or (r.status='approved' and p_status='pickup_scheduled' and r.type='return_and_refund') or (r.status='approved' and p_status='refunded' and r.type='refund_only') or (r.status='pickup_scheduled' and p_status='picked_up') or (r.status='picked_up' and p_status='received') or (r.status='received' and p_status='refunded')) then raise exception 'INVALID_REFUND_STEP'; end if;
 if p_status in ('pickup_scheduled','picked_up','received') and r.type<>'return_and_refund' then raise exception 'INVALID_REFUND_STEP'; end if;
 if p_status='rejected' and nullif(trim(p_note),'') is null then raise exception 'REJECTION_NOTE_REQUIRED'; end if;
 if p_status='pickup_scheduled' then
  if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
  if split_part(p_pickup_slot,' | ',1)::date not between current_date+1 and current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
 end if;
 if p_status='picked_up' and r.type='return_and_refund' and p_pickup_code is not null then
  if p_pickup_code<>r.pickup_code then raise exception 'INVALID_PICKUP_CODE'; end if;
 end if;
 if p_status='received' and (p_condition not in ('Good','Damaged','Missing items') or nullif(trim(p_condition_note),'') is null or p_return_to_stock is null) then raise exception 'RECEIPT_DETAILS_REQUIRED'; end if;
 if p_status='received' and p_return_to_stock and p_condition<>'Good' then raise exception 'STOCK_RETURN_REQUIRES_GOOD_CONDITION'; end if;
 if p_status='received' and p_final_amount is not null then
  if p_final_amount<0 or p_final_amount>r.amount then raise exception 'INVALID_FINAL_AMOUNT'; end if;
  if p_final_amount<r.amount and nullif(trim(p_final_amount_reason),'') is null then raise exception 'FINAL_AMOUNT_REASON_REQUIRED'; end if;
 end if;
 if p_status='refunded' then
  if coalesce(p_final_amount,r.final_amount,r.amount)<0 or coalesce(p_final_amount,r.final_amount,r.amount)>r.amount then raise exception 'INVALID_FINAL_AMOUNT'; end if;
  if coalesce(p_final_amount,r.final_amount,r.amount)<r.amount and nullif(trim(coalesce(p_final_amount_reason,r.final_amount_reason)),'') is null then raise exception 'FINAL_AMOUNT_REASON_REQUIRED'; end if;
  select amount into paid from public.payments where order_id=r.order_id order by id desc limit 1;
  if coalesce((select sum(case when status='refunded' then coalesce(final_amount,amount) else amount end) from public.refunds where order_id=r.order_id and id<>r.id and status not in ('rejected','cancelled')),0)+coalesce(p_final_amount,r.final_amount,r.amount)>coalesce(paid,0) then raise exception 'REFUND_EXCEEDS_AMOUNT_PAID'; end if;
 end if;
 if p_status='pickup_scheduled' then
  new_code:=lpad((floor(random()*10000))::integer::text,4,'0');
  update public.refunds set pickup_slot=p_pickup_slot,pickup_code=new_code,qr_payload=id::text||':'||new_code where id=r.id;
 end if;
 update public.refunds set status=p_status,updated_at=now(),decided_by=case when p_status in ('approved','rejected','received','refunded') then auth.uid() else decided_by end,decided_at=case when p_status in ('rejected','refunded') then now() else decided_at end,
  decision_note=case when p_status='rejected' then left(trim(p_note),500) else decision_note end,
  pickup_slot=case when p_status='pickup_scheduled' then p_pickup_slot else pickup_slot end,
  picked_up_at=case when p_status='picked_up' then now() else picked_up_at end,received_at=case when p_status='received' then now() else received_at end,
  item_condition=case when p_status='received' then p_condition else item_condition end,condition_note=case when p_status='received' then left(trim(p_condition_note),500) else condition_note end,
  return_to_stock=case when p_status='received' then p_return_to_stock else return_to_stock end,
  final_amount=case when p_status='received' and p_final_amount is not null then p_final_amount when p_status='refunded' then coalesce(p_final_amount,r.final_amount,r.amount) else final_amount end,
  final_amount_reason=case when p_status='received' and p_final_amount<r.amount then left(trim(p_final_amount_reason),500) when p_status='refunded' and coalesce(p_final_amount,r.final_amount,r.amount)<r.amount then left(trim(coalesce(p_final_amount_reason,r.final_amount_reason)),500) else final_amount_reason end,
  refunded_at=case when p_status='refunded' then now() else refunded_at end,
  expected_arrival_at=case when p_status='refunded' then public.refund_expected_arrival(now()) else expected_arrival_at end,
  refund_reference=case when p_status='refunded' then coalesce(refund_reference,'RF-'||to_char(current_date,'YYYY')||'-'||lpad(r.id::text,4,'0')) else refund_reference end
 where id=r.id returning * into r;
 note_text:=case when p_status='rejected' then left(trim(p_note),500) when p_status='received' then left(trim(p_condition_note),500)||case when p_final_amount<r.amount then ' · '||left(trim(p_final_amount_reason),300) else '' end when p_status='refunded' and coalesce(p_final_amount,r.final_amount,r.amount)<r.amount then left(trim(coalesce(p_final_amount_reason,r.final_amount_reason)),500) end;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note) values(r.id,old_status,p_status,auth.uid(),role_name,note_text);
 if p_status='received' and p_return_to_stock then
  perform public.admin_adjust_inventory_with_batch(oi.product_id,ri.quantity,'Returned',null,null) from public.refund_items ri join public.order_items oi on oi.id=ri.order_item_id where ri.refund_id=r.id;
 end if;
 insert into public.notifications(user_id,title,body,link) values(r.requested_by,'Return/refund update','Request #'||r.id||' for order #'||r.order_id||' is now '||replace(p_status,'_',' ')||case when p_status='rejected' then ': '||left(trim(p_note),250) else '.' end,'/customer/orders/tracking?id='||r.order_id);
 if p_status='pickup_scheduled' then
  insert into public.notifications(user_id,title,body,link) select u.id,'Return pickup scheduled','Pickup for request #'||r.id||' is scheduled for '||p_pickup_slot,'/portal/'||coalesce(current_setting('app.admin_route_token',true),'')||'/delivery' from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text='delivery_boy';
 end if;
 return true;
end $$;
revoke all on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean,text) from public,anon;
grant execute on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text,boolean,text) to authenticated;

create or replace function public.cancel_return_request(p_refund_id bigint default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select order_id into r.order_id from public.refunds where id=p_refund_id;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 perform 1 from public.orders where id=r.order_id and user_id=auth.uid() for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 select * into r from public.refunds where id=p_refund_id for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 if r.status not in ('requested','approved') then raise exception 'RETURN_CANNOT_BE_CANCELLED'; end if;
 update public.refunds set status='cancelled',updated_at=now() where id=r.id;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role) values(r.id,r.status,'cancelled',auth.uid(),'customer');
 return true;
end $$;
revoke all on function public.cancel_return_request(bigint) from public,anon;
grant execute on function public.cancel_return_request(bigint) to authenticated;

-- A completed COD delivery is the demo's confirmation that cash was collected.
create or replace function public.mark_cod_paid_after_delivery()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='delivered' and old.status is distinct from new.status then
  update public.payments set status='paid' where order_id=new.id and lower(method) in ('cod','cash on delivery') and status not in ('paid','refunded');
 end if;
 return new;
end $$;
drop trigger if exists mark_cod_paid_after_delivery on public.orders;
create trigger mark_cod_paid_after_delivery after update of status on public.orders for each row execute function public.mark_cod_paid_after_delivery();

-- Pre-dispatch prepaid cancellation is a full demo refund; COD cancellation remains refund-free.
create or replace function public.auto_refund_prepaid_cancellation()
returns trigger language plpgsql security definer set search_path=public as $$
declare payment_row record; refund_id bigint; fee numeric;
begin
 if new.status='cancelled' and old.status in ('placed','accepted') and old.status is distinct from new.status then
  select * into payment_row from public.payments where order_id=new.id order by id desc limit 1;
  if payment_row.method is not null and lower(payment_row.method) not in ('cod','cash on delivery')
     and not exists(select 1 from public.refunds where order_id=new.id and status<>'rejected') then
   fee:=greatest(0,payment_row.amount-(select coalesce(sum(oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount),0) from public.order_items oi where oi.order_id=new.id));
   insert into public.refunds(order_id,requested_by,status,reason,amount,final_amount,fee_amount,method,decided_by,decided_at,refunded_at,expected_arrival_at)
   values(new.id,new.user_id,'refunded','Order cancelled before dispatch',payment_row.amount,payment_row.amount,fee,'Original payment method',auth.uid(),now(),now(),public.refund_expected_arrival(now())) returning id into refund_id;
   update public.refunds set refund_reference='RF-'||to_char(current_date,'YYYY')||'-'||lpad(refund_id::text,4,'0') where id=refund_id;
   insert into public.refund_events(refund_id,from_status,to_status,actor_id,actor_role,note) values(refund_id,null,'refunded',auth.uid(),coalesce(public.current_role(),'system'),'Automatic cancellation refund');
   insert into public.refund_items(refund_id,order_item_id,quantity,amount)
    select refund_id,oi.id,oi.quantity,round((oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount),2) from public.order_items oi where oi.order_id=new.id;
   update public.payments set status='refunded' where order_id=new.id;
   insert into public.notifications(user_id,title,body,link) values(new.user_id,'Cancellation refund issued','Refund for order #'||new.id||' was issued. Demo: no money is moved.','/customer/orders/tracking?id='||new.id);
  end if;
 end if;
 return new;
end $$;
drop trigger if exists prepaid_cancel_refund on public.orders;
create trigger prepaid_cancel_refund after update of status on public.orders for each row execute function public.auto_refund_prepaid_cancellation();

-- Shared reporting definition: paid completed orders less issued refunds; cancelled orders are excluded.
create or replace function public.net_revenue_daily(p_from date default current_date-29,p_to date default current_date)
returns table(day date,orders bigint,revenue numeric)
language plpgsql stable security definer set search_path=public as $$
begin
 if not (public.current_role_has_permission('reports:view') or public.current_role_has_permission('revenue:view')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return query
 select (o.created_at at time zone 'Asia/Kolkata')::date,count(*)::bigint,
  coalesce(sum(greatest(0,coalesce(p.amount,o.total)-coalesce((select sum(coalesce(r.final_amount,r.amount)) from public.refunds r where r.order_id=o.id and r.status='refunded'),0))),0)::numeric
 from public.orders o left join lateral (select amount,method,status from public.payments where order_id=o.id order by id desc limit 1) p on true
 where (o.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to and o.status<>'cancelled'
   and (lower(coalesce(p.method,'')) in ('prepaid','razorpay') and lower(coalesce(p.status,'')) in ('captured','paid','succeeded','completed')
     or lower(coalesce(p.method,'')) in ('cod','cash on delivery') and o.status in ('delivered','returned','refunded'))
 group by 1 order by 1;
end $$;
revoke all on function public.net_revenue_daily(date,date) from public,anon;
grant execute on function public.net_revenue_daily(date,date) to authenticated;

create or replace function public.net_revenue(p_from date default current_date-29,p_to date default current_date)
returns numeric language sql stable security definer set search_path=public as $$
 select coalesce(sum(d.revenue),0)::numeric from public.net_revenue_daily(p_from,p_to) d
$$;
revoke all on function public.net_revenue(date,date) from public,anon;
grant execute on function public.net_revenue(date,date) to authenticated;

create or replace function public.admin_sales_report(p_from date default current_date-29,p_to date default current_date)
returns table(day date,order_count bigint,revenue numeric)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('reports:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return query select d.day,d.orders,d.revenue from public.net_revenue_daily(p_from,p_to) d;
end $$;
revoke all on function public.admin_sales_report(date,date) from public,anon;
grant execute on function public.admin_sales_report(date,date) to authenticated;

create or replace view public.dashboard_daily_sales as
select d.day,d.orders::integer as orders,d.revenue from public.net_revenue_daily((now() at time zone 'Asia/Kolkata')::date-364,(now() at time zone 'Asia/Kolkata')::date) d;

create or replace view public.dashboard_summary as
with daily as (
 select * from public.net_revenue_daily((now() at time zone 'Asia/Kolkata')::date,(now() at time zone 'Asia/Kolkata')::date)
)
select coalesce((select sum(revenue) from daily),0)::numeric as today_sales,
 coalesce((select sum(orders) from daily),0)::integer as today_orders,
 (select count(*)::integer from public.orders where status in ('placed','accepted','picking','packed','out_for_delivery')) as pending_deliveries,
 (select count(*)::integer from public.inventory where current_stock-reserved_stock<=reorder_level) as low_stock_items;

drop function if exists public.refund_report(date,date);
create function public.refund_report(p_from date default current_date-29,p_to date default current_date)
returns table(refund_amount numeric,refund_count bigint,reason text,reason_count bigint,delivered_count bigint,request_count bigint,return_rate numeric)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('reports:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return query
 with reasons as (
  select r.reason,
   count(*) filter(where (r.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to)::bigint requested_count,
   count(*) filter(where r.status='refunded' and (r.refunded_at at time zone 'Asia/Kolkata')::date between p_from and p_to)::bigint refunded_count,
   coalesce(sum(coalesce(r.final_amount,r.amount)) filter(where r.status='refunded' and (r.refunded_at at time zone 'Asia/Kolkata')::date between p_from and p_to),0)::numeric total_refund
  from public.refunds r where (r.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to or r.status='refunded' and (r.refunded_at at time zone 'Asia/Kolkata')::date between p_from and p_to group by r.reason
 ), totals as (
  select coalesce(sum(requested_count),0)::bigint request_count,
   (select count(*)::bigint from public.orders o where o.delivered_at is not null and (o.delivered_at at time zone 'Asia/Kolkata')::date between p_from and p_to) delivered_count
  from reasons
 )
 select coalesce(rs.total_refund,0),coalesce(rs.refunded_count,0),coalesce(rs.reason,'No requests'),coalesce(rs.requested_count,0),t.delivered_count,t.request_count,coalesce(t.request_count::numeric/nullif(t.delivered_count,0),0)
 from totals t left join reasons rs on true;
end
$$;
revoke all on function public.refund_report(date,date) from public,anon;
grant execute on function public.refund_report(date,date) to authenticated;

commit;
notify pgrst, 'reload schema';
