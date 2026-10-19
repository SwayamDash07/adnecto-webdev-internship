-- Real delivery windows for orders. Apply after phase21_refunds.sql.
begin;

alter table public.orders add column if not exists delivery_slot_start timestamptz;
alter table public.orders add column if not exists delivery_slot_end timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists delivery_instructions text;
alter table public.orders add column if not exists contactless_delivery boolean not null default false;
alter table public.orders add column if not exists substitute_unavailable boolean not null default false;
alter table public.orders drop constraint if exists orders_delivery_slot_window_check;
alter table public.orders add constraint orders_delivery_slot_window_check
  check ((delivery_slot_start is null and delivery_slot_end is null) or
         (delivery_slot_start is not null and delivery_slot_end is not null and delivery_slot_end > delivery_slot_start));
create index if not exists orders_delivery_slot_start_idx on public.orders(delivery_slot_start);

-- This parser deliberately returns NULL for ambiguous/unrecognized labels.
create or replace function public.parse_legacy_delivery_slot(p_label text, p_created_at timestamptz)
returns timestamptz[] language plpgsql immutable as $$
declare txt text; date_txt text; win text[]; day_date date; ref_date date; sh int; sm int; eh int; em int; sp text; ep text; start_local timestamp; end_local timestamp;
begin
  if p_label is null or p_created_at is null then return null; end if;
  txt := regexp_replace(split_part(p_label, ' · ', 1), '^\s*(Today|Tomorrow|Day after tomorrow|[A-Za-z]{3},\s*[0-9]{1,2}\s+[A-Za-z]{3}|[0-9]{1,2}\s+[A-Za-z]{3})\s*,?\s*', '', 'i');
  ref_date := (p_created_at at time zone 'Asia/Kolkata')::date;
  if p_label ~* '^\s*Today\b' then day_date := ref_date;
  elsif p_label ~* '^\s*Tomorrow\b' then day_date := ref_date + 1;
  elsif p_label ~* '^\s*Day after tomorrow\b' then day_date := ref_date + 2;
  else
    date_txt := substring(p_label from '^\s*(?:[A-Za-z]{3},\s*)?([0-9]{1,2}\s+[A-Za-z]{3})');
    if date_txt is null then return null; end if;
    begin day_date := to_date(date_txt || ' ' || extract(year from ref_date)::int, 'DD Mon YYYY');
    exception when others then return null; end;
  end if;
  win := regexp_match(txt, '(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', 'i');
  if win is null then return null; end if;
  sh := win[1]::int; sm := coalesce(nullif(win[2], '')::int, 0); sp := upper(coalesce(win[3], win[6]));
  eh := win[4]::int; em := coalesce(nullif(win[5], '')::int, 0); ep := upper(win[6]);
  if sh < 1 or sh > 12 or eh < 1 or eh > 12 or sm > 59 or em > 59 then return null; end if;
  sh := (sh % 12) + case when sp = 'PM' then 12 else 0 end;
  eh := (eh % 12) + case when ep = 'PM' then 12 else 0 end;
  start_local := day_date + make_time(sh, sm, 0);
  end_local := day_date + make_time(eh, em, 0);
  if end_local <= start_local then end_local := end_local + interval '1 day'; end if;
  return array[start_local at time zone 'Asia/Kolkata', end_local at time zone 'Asia/Kolkata'];
end $$;

create temporary table delivery_slot_backfill_report on commit drop as
select o.id, o.delivery_slot as old_label, o.created_at,
       (public.parse_legacy_delivery_slot(o.delivery_slot, o.created_at))[1] as starts_at,
       (public.parse_legacy_delivery_slot(o.delivery_slot, o.created_at))[2] as ends_at
from public.orders o where o.delivery_slot_start is null or o.delivery_slot_end is null;
update public.orders o set delivery_slot_start = r.starts_at, delivery_slot_end = r.ends_at
from delivery_slot_backfill_report r where r.id=o.id and r.starts_at is not null and r.ends_at is not null;

-- Backfill only from explicit status-change evidence; never infer from order creation time.
update public.orders o set delivered_at = (
  select l.created_at from public.audit_logs l
  where l.table_name='orders' and l.row_id=o.id::text
    and l.action in ('order_status_updated','fulfilment_status_updated','UPDATE')
    and coalesce(l.payload->>'to', l.payload->>'status', l.payload->'new'->>'status')='delivered'
  order by l.created_at desc limit 1)
where o.status='delivered' and o.delivered_at is null and exists (
  select 1 from public.audit_logs l where l.table_name='orders' and l.row_id=o.id::text
    and l.action in ('order_status_updated','fulfilment_status_updated','UPDATE')
    and coalesce(l.payload->>'to', l.payload->>'status', l.payload->'new'->>'status')='delivered');

-- Preserve the phase21 pricing/coupon/refund snapshot calculation and only change slot handling.
drop function if exists public.place_order(bigint,jsonb,text,text,text);
create or replace function public.place_order(p_address_id bigint,p_items jsonb,p_payment_method text,p_delivery_slot_start timestamptz,p_delivery_slot_end timestamptz,p_delivery_slot_label text,p_coupon_code text,p_delivery_instructions text,p_contactless_delivery boolean,p_substitute_unavailable boolean)
returns bigint language plpgsql security definer set search_path=public as $$
declare oid bigint; item jsonb; pid bigint; requested_id bigint; v_sku text; pname text; qty int; price numeric; tax numeric; subtotal numeric:=0; gst_total numeric:=0; discount numeric:=0; delivery numeric:=0; packing numeric:=19; total numeric; item_count int; item_index int:=0; allocated_gst numeric:=0; allocated_discount numeric:=0; line_gst numeric; line_discount numeric; local_start timestamp; local_today date; allowed boolean;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if lower(trim(coalesce(p_payment_method,''))) not in ('prepaid','razorpay','cod') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
 if p_address_id is null or not exists(select 1 from public.addresses where id=p_address_id and user_id=auth.uid()) then raise exception 'ADDRESS_REQUIRED'; end if;
 if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'EMPTY_CART'; end if;
 if p_delivery_slot_start is null or p_delivery_slot_end is null or p_delivery_slot_end<=p_delivery_slot_start then raise exception 'INVALID_DELIVERY_SLOT'; end if;
 local_start := p_delivery_slot_start at time zone 'Asia/Kolkata'; local_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
 if local_start::date < local_today or local_start::date > local_today+2 or p_delivery_slot_start <= now()+interval '2 hours' then raise exception 'INVALID_DELIVERY_SLOT'; end if;
 select exists(select 1 from public.delivery_slots s where s.starts_at=p_delivery_slot_start and s.ends_at=p_delivery_slot_end and s.capacity>0) into allowed;
 if (p_delivery_slot_end at time zone 'Asia/Kolkata')::date <> local_start::date then raise exception 'INVALID_DELIVERY_SLOT'; end if;
 if not allowed and not exists(select 1 from public.delivery_slots where starts_at >= (local_today::timestamp at time zone 'Asia/Kolkata') and starts_at < ((local_today+3)::timestamp at time zone 'Asia/Kolkata')) then
   allowed := (local_start::time, (p_delivery_slot_end at time zone 'Asia/Kolkata')::time) in ((time '10:00',time '12:00'),(time '12:00',time '14:00'),(time '18:00',time '20:00'));
 end if;
 if not allowed then raise exception 'INVALID_DELIVERY_SLOT'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
  requested_id:=nullif(item->>'product_id','')::bigint; v_sku:=nullif(item->>'sku',''); pname:=nullif(item->>'name',''); qty:=(item->>'quantity')::int;
  if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
  pid:=null; price:=null;
  if v_sku is not null then select id,selling_price,coalesce(gst,0) into pid,price,tax from public.products where public.products.sku=v_sku and is_active; end if;
  if price is null and pname is not null then select id,selling_price,coalesce(gst,0) into pid,price,tax from public.products where lower(public.products.name)=lower(pname) and is_active; end if;
  if price is null and requested_id is not null then select id,selling_price,coalesce(gst,0) into pid,price,tax from public.products where id=requested_id and is_active; end if;
  if pid is null or price is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  update public.inventory set current_stock=current_stock-qty where product_id=pid and current_stock-reserved_stock>=qty;
  if not found then raise exception 'INSUFFICIENT_STOCK:%',pid; end if;
  subtotal:=subtotal+price*qty; gst_total:=gst_total+price*qty*tax/100;
 end loop;
 if subtotal>=1000 then delivery:=0; else delivery:=49; end if;
 if nullif(trim(p_coupon_code),'') is not null then select c.discount into discount from public.customer_validate_coupon(p_coupon_code,subtotal) c where c.valid; end if;
 gst_total:=round(gst_total,2); total:=greatest(0,subtotal+gst_total+delivery+packing-discount);
 insert into public.orders(user_id,address_id,delivery_slot,delivery_slot_start,delivery_slot_end,delivery_instructions,contactless_delivery,substitute_unavailable,total,refund_pricing_complete)
 values(auth.uid(),p_address_id,p_delivery_slot_label,p_delivery_slot_start,p_delivery_slot_end,left(p_delivery_instructions,200),coalesce(p_contactless_delivery,false),coalesce(p_substitute_unavailable,false),total,true) returning id into oid;
 select count(*) into item_count from jsonb_array_elements(p_items); item_index:=0;
 for item in select * from jsonb_array_elements(p_items) loop
  requested_id:=nullif(item->>'product_id','')::bigint; v_sku:=nullif(item->>'sku',''); pname:=nullif(item->>'name',''); qty:=(item->>'quantity')::int; pid:=null;
  if v_sku is not null then select id into pid from public.products where public.products.sku=v_sku; end if;
  if pid is null and pname is not null then select id into pid from public.products where lower(public.products.name)=lower(pname); end if;
  if pid is null then pid:=requested_id; end if;
  select selling_price,coalesce(gst,0) into price,tax from public.products where id=pid;
  item_index:=item_index+1;
  if item_index=item_count then line_gst:=gst_total-allocated_gst; else line_gst:=round(price*qty*tax/100,2); allocated_gst:=allocated_gst+line_gst; end if;
  if item_index=item_count then line_discount:=discount-allocated_discount; else line_discount:=case when subtotal>0 then round(discount*price*qty/subtotal,2) else 0 end; allocated_discount:=allocated_discount+line_discount; end if;
  insert into public.order_items(order_id,product_id,quantity,unit_price,substitute_if_unavailable,gst_amount,discount_amount) values(oid,pid,qty,price,coalesce((item->>'substitute')::boolean,false),line_gst,line_discount);
 end loop;
 insert into public.payments(order_id,method,amount) values(oid,case when lower(trim(p_payment_method)) in ('prepaid','razorpay') then 'prepaid' else 'cod' end,total);
 delete from public.cart where user_id=auth.uid(); return oid;
end $$;
grant execute on function public.place_order(bigint,jsonb,text,timestamptz,timestamptz,text,text,text,boolean,boolean) to authenticated;
revoke all on function public.place_order(bigint,jsonb,text,timestamptz,timestamptz,text,text,text,boolean,boolean) from public, anon;

-- Add real slot fields to existing operational RPCs so queues never parse labels.
drop function if exists public.admin_list_orders();
create function public.admin_list_orders()
returns table(order_id bigint, customer_name text, customer_email text, total numeric, status public.order_status, created_at timestamptz, delivery_slot text, delivery_slot_start timestamptz, delivery_slot_end timestamptz, delivered_at timestamptz, address_line text, item_count bigint)
language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('orders:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select o.id,coalesce(u.full_name,split_part(coalesce(a.email,''),'@',1),'Customer')::text,coalesce(a.email,'')::text,
    case when public.current_role()='picker' then null else o.total end,o.status,o.created_at,o.delivery_slot,o.delivery_slot_start,o.delivery_slot_end,o.delivered_at,
    concat_ws(', ',ad.line1,ad.city,ad.postal_code),count(oi.id)::bigint
  from public.orders o left join public.users u on u.id=o.user_id left join auth.users a on a.id=o.user_id
  left join public.addresses ad on ad.id=o.address_id left join public.order_items oi on oi.order_id=o.id
  where public.current_role()<>'picker' or o.status in ('accepted','picking')
  group by o.id,u.full_name,a.email,ad.line1,ad.city,ad.postal_code order by o.delivery_slot_start nulls last,o.created_at desc;
end $$;
grant execute on function public.admin_list_orders() to authenticated;
revoke all on function public.admin_list_orders() from public, anon;

drop function if exists public.admin_list_fulfilment_orders(text);
create function public.admin_list_fulfilment_orders(p_queue text default 'all')
returns table(order_id bigint,customer_name text,total numeric,status public.order_status,delivery_slot text,delivery_slot_start timestamptz,delivery_slot_end timestamptz,delivered_at timestamptz,address_line text,item_count bigint)
language plpgsql security definer set search_path=public as $$
begin
  if p_queue='all' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='picker' and not public.current_role_has_permission('picker:use') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='delivery' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue not in ('all','picker','delivery') then raise exception 'INVALID_FULFILMENT_QUEUE'; end if;
  return query select o.id::bigint,coalesce(nullif(u.full_name::text,''),'Customer')::text,
    case when public.current_role()='picker' then null else o.total end,o.status,o.delivery_slot::text,o.delivery_slot_start,o.delivery_slot_end,o.delivered_at,
    concat_ws(', ',ad.line1,ad.city,ad.postal_code)::text,count(oi.id)::bigint
  from public.orders o left join public.users u on u.id=o.user_id left join public.addresses ad on ad.id=o.address_id left join public.order_items oi on oi.order_id=o.id
  where (p_queue='all' or (p_queue='picker' and o.status in ('accepted','picking')) or (p_queue='delivery' and o.status in ('packed','out_for_delivery')))
  group by o.id,u.full_name,ad.line1,ad.city,ad.postal_code order by o.delivery_slot_start nulls last,o.created_at desc;
end $$;
grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;
revoke all on function public.admin_list_fulfilment_orders(text) from public, anon;

drop function if exists public.admin_list_late_orders();
create function public.admin_list_late_orders()
returns table(order_id bigint,customer_name text,total numeric,status public.order_status,created_at timestamptz,delivery_slot_start timestamptz,delivery_slot_end timestamptz,last_reminded_at timestamptz,open_complaint_id bigint)
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.users u join public.roles r on r.id=u.role_id where u.id=auth.uid() and r.name in ('super_admin','store_manager')) then raise exception 'COMPLAINT_ACCESS_REQUIRED'; end if;
  return query select o.id,coalesce(nullif(u.full_name,''),nullif(split_part(coalesce(a.email,''),'@',1),''),'Customer'),o.total,o.status,o.created_at,o.delivery_slot_start,o.delivery_slot_end,
    (select max(rem.sent_at) from public.admin_order_reminders rem where rem.order_id=o.id),
    (select c.id from public.complaints c where c.order_id=o.id and c.status<>'resolved' order by c.created_at desc limit 1)
  from public.orders o left join public.users u on u.id=o.user_id left join auth.users a on a.id=o.user_id
  where o.status in ('placed','accepted','picking','packed','out_for_delivery') and o.delivery_slot_end < now()
  order by o.delivery_slot_start nulls last limit 5;
end $$;
grant execute on function public.admin_list_late_orders() to authenticated;
revoke all on function public.admin_list_late_orders() from public, anon;

-- Keep the existing delivered_at transition behavior in place, idempotently.
create or replace function public.stamp_order_delivered_at() returns trigger language plpgsql as $$
begin
  if new.status='delivered' and old.status is distinct from 'delivered' then new.delivered_at:=coalesce(new.delivered_at,now()); end if;
  return new;
end $$;
drop trigger if exists order_delivered_at_stamp on public.orders;
create trigger order_delivered_at_stamp before update of status on public.orders for each row execute function public.stamp_order_delivered_at();

-- Apply-time report: totals, distinct labels which could not be parsed, and five samples.
select count(*) filter (where starts_at is not null and ends_at is not null) as orders_backfilled,
       count(*) filter (where starts_at is null or ends_at is null) as orders_unparsed from delivery_slot_backfill_report;
select old_label, count(*) as order_count from delivery_slot_backfill_report where starts_at is null or ends_at is null group by old_label order by order_count desc, old_label;
select id, old_label, created_at at time zone 'Asia/Kolkata' as created_at_ist, starts_at as delivery_slot_start, ends_at as delivery_slot_end from delivery_slot_backfill_report order by id limit 5;
select count(*) as delivered_orders_still_missing_delivered_at from public.orders where status='delivered' and delivered_at is null;

drop function if exists public.parse_legacy_delivery_slot(text,timestamptz);
notify pgrst, 'reload schema';
commit;
