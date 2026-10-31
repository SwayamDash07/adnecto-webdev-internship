-- Extend refunds with customer returns, pickup tracking, and role-gated single-step transitions.
alter table public.products add column if not exists is_returnable boolean not null default true;
update public.products p set is_returnable=false where
 lower(coalesce((select c.name from public.categories c where c.id=p.category_id),'')) ~ '(grocer|dairy|produce|fresh|meat|seafood|bakery|frozen)' 
 or lower(p.name) ~ '(milk|atta|curd|yogurt|paneer|cheese|butter|egg|vegetable|fruit|meat|fish|chicken|bread|cream)';
-- Keep the demo catalog rerunnable with a product-level returnability flag.
update public.products set is_returnable=false where lower(name) like '%atta%' or lower(name) like '%milk%';
alter table public.refunds add column if not exists type text not null default 'refund_only';
alter table public.refunds add column if not exists pickup_slot text;
alter table public.refunds add column if not exists pickup_address_id bigint references public.addresses(id);
alter table public.refunds add column if not exists picked_up_at timestamptz;
alter table public.refunds add column if not exists received_at timestamptz;
alter table public.refunds add column if not exists item_condition text;
alter table public.refunds add column if not exists condition_note text;
alter table public.refunds add column if not exists final_amount numeric(12,2);
alter table public.refunds add column if not exists final_amount_reason text;
update public.refunds set type='refund_only' where type is null;
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check check(status in ('requested','approved','pickup_scheduled','picked_up','received','rejected','refunded','cancelled'));
alter table public.refunds drop constraint if exists refunds_type_check;
alter table public.refunds add constraint refunds_type_check check(type in ('return_and_refund','refund_only'));
alter table public.refunds drop constraint if exists refunds_condition_check;
alter table public.refunds add constraint refunds_condition_check check(item_condition is null or item_condition in ('Good','Damaged','Missing items'));
create index if not exists refunds_pickup_queue_idx on public.refunds(status,pickup_slot) where status='pickup_scheduled';
drop function if exists public.create_refund_request(bigint,text,text,jsonb,text[]);
create function public.create_refund_request(p_order_id bigint,p_reason text,p_comment text,p_items jsonb,p_photos text[] default '{}',p_type text default 'return_and_refund',p_pickup_slot text default null,p_pickup_address_id bigint default null) returns bigint language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; r bigint; it record; li record; amt numeric:=0; line_amt numeric; prior_qty integer; prior_amt numeric; fee_amt numeric:=0; method_name text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_reason not in ('Damaged or defective','Wrong item','Not as described','Changed my mind','Other') then raise exception 'INVALID_REASON'; end if;
 if p_type not in ('return_and_refund','refund_only') then raise exception 'INVALID_REFUND_TYPE'; end if;
 if p_type='refund_only' and p_reason not in ('Damaged or defective','Wrong item','Not as described') then raise exception 'REFUND_ONLY_REASON_REQUIRED'; end if;
 if p_reason='Other' and nullif(trim(p_comment),'') is null then raise exception 'COMMENT_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if o.status<>'delivered' then raise exception 'ORDER_NOT_DELIVERED'; end if;
 if not o.refund_pricing_complete then raise exception 'REFUND_PRICING_UNAVAILABLE'; end if;
 if o.delivered_at is null or o.delivered_at>now() or o.delivered_at<now()-interval '7 days' then raise exception 'RETURN_WINDOW_CLOSED'; end if;
 if coalesce(jsonb_typeof(p_items),'')<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'SELECT_ITEMS'; end if;
 if p_type='return_and_refund' then
  if o.address_id is null or p_pickup_address_id is distinct from o.address_id then raise exception 'PICKUP_ADDRESS_MUST_MATCH_ORDER'; end if;
  if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' then raise exception 'INVALID_PICKUP_SLOT'; end if;
  if split_part(p_pickup_slot,' | ',1)::date<=current_date or split_part(p_pickup_slot,' | ',1)::date>current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
 end if;
 if cardinality(coalesce(p_photos,'{}'))>3 then raise exception 'TOO_MANY_PHOTOS'; end if;
 if exists(select 1 from unnest(coalesce(p_photos,'{}')) as photos(path) where path not like 'refunds/'||auth.uid()::text||'/%' or not exists(select 1 from storage.objects so where so.bucket_id='refund-photos' and so.name=photos.path)) then raise exception 'INVALID_REFUND_PHOTO'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j where coalesce((j->>'quantity')::int,0)<=0) then raise exception 'INVALID_QUANTITY'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) j group by (j->>'order_item_id')::bigint having count(*)>1) then raise exception 'DUPLICATE_ITEM'; end if;
 for it in select (j->>'order_item_id')::bigint item_id,(j->>'quantity')::int qty from jsonb_array_elements(p_items) j loop
   select id,quantity,unit_price,gst_amount,discount_amount into li from public.order_items where id=it.item_id and order_id=p_order_id;
   if not found or it.qty>li.quantity then raise exception 'INVALID_ORDER_ITEM'; end if;
   if p_type='return_and_refund' and p_reason not in ('Damaged or defective','Wrong item','Not as described') and not coalesce((select pr.is_returnable from public.products pr where pr.id=li.product_id),true) then raise exception 'ITEM_NOT_RETURNABLE'; end if;
   if it.qty+coalesce((select sum(ri.quantity) from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=li.id and rf.status not in ('rejected','cancelled')),0)>li.quantity then raise exception 'ITEM_ALREADY_REQUESTED'; end if;
   select coalesce(sum(ri.quantity),0),coalesce(sum(ri.amount),0) into prior_qty,prior_amt from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=li.id and rf.status not in ('rejected','cancelled');
   if prior_qty+it.qty=li.quantity then line_amt:=round(li.unit_price*li.quantity+li.gst_amount-li.discount_amount,0)-prior_amt;
   else line_amt:=round(((li.unit_price*li.quantity+li.gst_amount-li.discount_amount)/li.quantity)*it.qty,0); end if;
   amt:=amt+line_amt;
 end loop;
 if p_reason in ('Damaged or defective','Wrong item','Not as described') then
   select greatest(0,o.total-(select coalesce(sum(oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount),0) from public.order_items oi where oi.order_id=p_order_id)-coalesce(sum(rf.fee_amount),0)) into fee_amt from public.refunds rf where rf.order_id=p_order_id and rf.status not in ('rejected','cancelled');
   amt:=amt+fee_amt;
 end if;
 select p.method into method_name from public.payments p where p.order_id=p_order_id order by p.id desc limit 1;
 insert into public.refunds(order_id,requested_by,status,reason,comment,amount,fee_amount,method,photo_paths,type,pickup_slot,pickup_address_id) values(p_order_id,auth.uid(),'requested',p_reason,left(p_comment,300),greatest(0,amt),fee_amt,case when lower(coalesce(method_name,'')) in ('cod','cash on delivery') then 'Store credit or bank transfer' else 'Original payment method' end,coalesce(p_photos,'{}'),p_type,case when p_type='return_and_refund' then p_pickup_slot end,case when p_type='return_and_refund' then p_pickup_address_id end) returning id into r;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id) values(r,null,'requested',auth.uid());
 if p_type='return_and_refund' then
  insert into public.notifications(user_id,title,body) select u.id,'New return request','Return request for order #'||p_order_id||' needs review.' from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text='store_manager';
 end if;
 insert into public.refund_items(refund_id,order_item_id,quantity,amount) select r,(j->>'order_item_id')::bigint,(j->>'quantity')::int,case when coalesce((select sum(pri.quantity) from public.refund_items pri join public.refunds pr on pr.id=pri.refund_id where pri.order_item_id=oi.id and pr.status not in ('rejected','cancelled')),0)+(j->>'quantity')::int=oi.quantity then round(oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount,0)-coalesce((select sum(pri.amount) from public.refund_items pri join public.refunds pr on pr.id=pri.refund_id where pri.order_item_id=oi.id and pr.status not in ('rejected','cancelled')),0) else round(((oi.unit_price*oi.quantity+oi.gst_amount-oi.discount_amount)/oi.quantity)*(j->>'quantity')::int,0) end from jsonb_array_elements(p_items) j join public.order_items oi on oi.id=(j->>'order_item_id')::bigint;
 return r;
end $$;
revoke all on function public.create_refund_request(bigint,text,text,jsonb,text[],text,text,bigint) from public,anon;
grant execute on function public.create_refund_request(bigint,text,text,jsonb,text[],text,text,bigint) to authenticated;

drop function if exists public.set_refund_status(bigint,text,text);
create function public.set_refund_status(p_refund_id bigint,p_status text,p_note text default null,p_pickup_slot text default null,p_condition text default null,p_condition_note text default null,p_final_amount numeric default null,p_final_amount_reason text default null) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype; v_role text:=public.current_role(); v_note text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_status not in ('approved','rejected','pickup_scheduled','picked_up','received','refunded') then raise exception 'INVALID_REFUND_STATUS'; end if;
 if v_role='picker' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_role='delivery_boy' and p_status<>'picked_up' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_role not in ('store_manager','super_admin','delivery_boy') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into r from public.refunds where id=p_refund_id for update;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 if not ((r.status='requested' and p_status in ('approved','rejected')) or (r.status='approved' and p_status in ('pickup_scheduled','refunded')) or (r.status='pickup_scheduled' and p_status='picked_up') or (r.status='picked_up' and p_status='received') or (r.status='received' and p_status='refunded')) then raise exception 'INVALID_REFUND_STEP'; end if;
 if r.type='refund_only' and p_status in ('pickup_scheduled','picked_up','received') then raise exception 'INVALID_REFUND_STEP'; end if;
 if r.type='return_and_refund' and p_status='refunded' and r.status<>'received' then raise exception 'REFUND_REQUIRES_RECEIVED_ITEM'; end if;
 if p_status='rejected' and nullif(trim(p_note),'') is null then raise exception 'REJECTION_NOTE_REQUIRED'; end if;
 if p_status='pickup_scheduled' then
   if p_pickup_slot is null or p_pickup_slot !~ '^\d{4}-\d{2}-\d{2} [|] (10:00-12:00|16:00-18:00)$' or split_part(p_pickup_slot,' | ',1)::date<=current_date or split_part(p_pickup_slot,' | ',1)::date>current_date+3 then raise exception 'INVALID_PICKUP_SLOT'; end if;
 end if;
 if p_status='received' then
   if p_condition not in ('Good','Damaged','Missing items') then raise exception 'ITEM_CONDITION_REQUIRED'; end if;
   if nullif(trim(p_condition_note),'') is null then raise exception 'CONDITION_NOTE_REQUIRED'; end if;
 end if;
 if p_status='refunded' then
   if r.status='received' and r.item_condition in ('Damaged','Missing items') then
     if p_final_amount is null or p_final_amount<0 or p_final_amount>r.amount then raise exception 'INVALID_FINAL_AMOUNT'; end if;
     if p_final_amount<r.amount and nullif(trim(p_final_amount_reason),'') is null then raise exception 'FINAL_AMOUNT_REASON_REQUIRED'; end if;
   elsif p_final_amount is not null and p_final_amount<>r.amount then raise exception 'FINAL_AMOUNT_NOT_EDITABLE';
   end if;
 end if;
 v_note:=case when p_status='rejected' then left(trim(p_note),500) when p_status='received' then left(trim(p_condition_note),500) when p_status='refunded' and p_final_amount<r.amount then left(trim(p_final_amount_reason),500) else null end;
 update public.refunds set status=p_status,updated_at=now(),decided_by=case when p_status in ('approved','rejected','received','refunded') then auth.uid() else decided_by end,decided_at=case when p_status in ('rejected','refunded') then now() else decided_at end,decision_note=case when p_status='rejected' then left(trim(p_note),500) else decision_note end,pickup_slot=case when p_status='pickup_scheduled' then p_pickup_slot else pickup_slot end,picked_up_at=case when p_status='picked_up' then now() else picked_up_at end,received_at=case when p_status='received' then now() else received_at end,item_condition=case when p_status='received' then p_condition else item_condition end,condition_note=case when p_status='received' then left(trim(p_condition_note),500) else condition_note end,final_amount=case when p_status='refunded' then coalesce(p_final_amount,r.amount) else final_amount end,final_amount_reason=case when p_status='refunded' and p_final_amount<r.amount then left(trim(p_final_amount_reason),500) else final_amount_reason end where id=p_refund_id;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id,note) values(p_refund_id,r.status,p_status,auth.uid(),v_note);
 if p_status in ('approved','pickup_scheduled','received','refunded','rejected') and r.requested_by is not null then insert into public.notifications(user_id,title,body) values(r.requested_by,'Return/refund update','Request for order #'||r.order_id||' is now '||replace(p_status,'_',' ')||case when p_status='rejected' then ': '||left(trim(p_note),300) else '.' end); end if;
 if p_status='refunded' and not exists(select 1 from public.order_items oi where oi.order_id=r.order_id and oi.quantity>coalesce((select sum(ri.quantity) from public.refund_items ri join public.refunds rf on rf.id=ri.refund_id where ri.order_item_id=oi.id and rf.status='refunded'),0)) then update public.orders set status='refunded' where id=r.order_id and status in ('delivered','returned','cancelled'); end if;
 return true;
end $$;
revoke all on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text) from public,anon;
grant execute on function public.set_refund_status(bigint,text,text,text,text,text,numeric,text) to authenticated;

create or replace function public.cancel_return_request(p_refund_id bigint) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.refunds%rowtype;
begin
 select rf.* into r from public.refunds rf join public.orders o on o.id=rf.order_id where rf.id=p_refund_id and o.user_id=auth.uid() for update of rf;
 if not found then raise exception 'REFUND_NOT_FOUND'; end if;
 if r.type<>'return_and_refund' or r.status<>'requested' then raise exception 'RETURN_CANNOT_BE_CANCELLED'; end if;
 update public.refunds set status='cancelled',updated_at=now() where id=p_refund_id;
 insert into public.refund_events(refund_id,from_status,to_status,actor_id) values(p_refund_id,'requested','cancelled',auth.uid());
 return true;
end $$;
revoke all on function public.cancel_return_request(bigint) from public,anon;
grant execute on function public.cancel_return_request(bigint) to authenticated;

-- Let delivery staff see scheduled pickup requests only; status changes remain RPC-gated.
drop policy if exists "customers read own refunds" on public.refunds;
create policy "customers read own refunds" on public.refunds for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()) or public.current_role() in ('store_manager','super_admin') or (public.current_role()='delivery_boy' and status='pickup_scheduled'));
drop policy if exists "refund items read scoped" on public.refund_items;
create policy "refund items read scoped" on public.refund_items for select to authenticated using(exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and (o.user_id=auth.uid() or public.current_role() in ('store_manager','super_admin') or (public.current_role()='delivery_boy' and r.status='pickup_scheduled'))));
drop policy if exists "refund events read scoped" on public.refund_events;
create policy "refund events read scoped" on public.refund_events for select to authenticated using(exists(select 1 from public.refunds r join public.orders o on o.id=r.order_id where r.id=refund_id and (o.user_id=auth.uid() or public.current_role() in ('store_manager','super_admin') or (public.current_role()='delivery_boy' and r.status='pickup_scheduled'))));
