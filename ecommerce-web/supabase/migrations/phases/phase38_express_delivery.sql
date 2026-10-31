-- Checkout delivery estimates, atomic slot assignment, and express fee snapshots.
-- Apply after phase37_payment_method_constraint.sql and all existing checkout migrations.
begin;

alter table public.orders
  add column if not exists delivery_speed text not null default 'standard',
  add column if not exists express_fee numeric(12,2) not null default 0;

alter table public.orders
  drop constraint if exists orders_delivery_speed_check,
  add constraint orders_delivery_speed_check check (delivery_speed in ('standard', 'express'));

alter table public.orders
  drop constraint if exists orders_express_fee_check,
  add constraint orders_express_fee_check check (express_fee >= 0);

create index if not exists orders_delivery_slot_occupancy_idx
  on public.orders(delivery_slot_start, delivery_slot_end)
  where status not in ('cancelled', 'refunded', 'returned');

create or replace function public.customer_list_checkout_delivery_slots()
returns table(starts_at timestamptz, ends_at timestamptz, capacity integer)
language plpgsql security definer set search_path=public as $$
declare
  local_today date := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  range_start timestamptz;
  range_end timestamptz;
  has_configured boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  range_start := local_today::timestamp at time zone 'Asia/Kolkata';
  range_end := (local_today + 3)::timestamp at time zone 'Asia/Kolkata';
  select exists(select 1 from public.delivery_slots s where s.starts_at >= range_start and s.starts_at < range_end) into has_configured;

  if has_configured then
    return query
      select s.starts_at, s.ends_at,
        greatest(s.capacity - count(o.id)::integer, 0)::integer
      from public.delivery_slots s
      left join public.orders o on o.delivery_slot_start = s.starts_at and o.delivery_slot_end = s.ends_at
        and o.status::text not in ('cancelled', 'refunded', 'returned')
      where s.starts_at >= greatest(range_start, now() + interval '2 hours')
        and s.starts_at < range_end
      group by s.id
      having s.capacity - count(o.id)::integer > 0
      order by s.starts_at;
  else
    return query
      with windows as (
        select (d.day + make_time(w.start_hour, 0, 0)) at time zone 'Asia/Kolkata' as slot_start,
          (d.day + make_time(w.end_hour, 0, 0)) at time zone 'Asia/Kolkata' as slot_end
        from generate_series(local_today::timestamp, (local_today + 2)::timestamp, interval '1 day') as d(day)
        cross join (values (10, 12), (12, 14), (18, 20)) as w(start_hour, end_hour)
      )
      select w.slot_start, w.slot_end, greatest(20 - count(o.id)::integer, 0)::integer
      from windows w
      left join public.orders o on o.delivery_slot_start = w.slot_start and o.delivery_slot_end = w.slot_end
        and o.status::text not in ('cancelled', 'refunded', 'returned')
      where w.slot_start >= greatest(range_start, now() + interval '2 hours') and w.slot_start < range_end
      group by w.slot_start, w.slot_end
      having 20 - count(o.id)::integer > 0
      order by w.slot_start;
  end if;
end;
$$;
revoke all on function public.customer_list_checkout_delivery_slots() from public, anon;
grant execute on function public.customer_list_checkout_delivery_slots() to authenticated;

create or replace function public.customer_place_checkout_order(
  p_address_id bigint,
  p_items jsonb,
  p_payment_method text,
  p_delivery_speed text,
  p_expected_total numeric,
  p_coupon_code text,
  p_delivery_instructions text,
  p_contactless_delivery boolean
)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  slot_row record;
  local_today date := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  standard_from timestamptz;
  standard_start timestamptz;
  selected_start timestamptz;
  selected_end timestamptz;
  selected_capacity integer;
  occupied integer;
  v_order_id bigint;
  base_total numeric(12,2);
  final_total numeric(12,2);
  fee numeric(12,2);
  delivery_label text;
  safe_items jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_delivery_speed not in ('standard', 'express') then raise exception 'INVALID_DELIVERY_SPEED'; end if;
  if p_expected_total is null or p_expected_total < 0 then raise exception 'INVALID_EXPECTED_TOTAL'; end if;
  standard_from := (local_today + 1)::timestamp at time zone 'Asia/Kolkata';
  select s.starts_at into standard_start
    from public.customer_list_checkout_delivery_slots() s
    where s.starts_at >= standard_from
    order by s.starts_at limit 1;

  for slot_row in
    select s.starts_at, s.ends_at
    from public.customer_list_checkout_delivery_slots() s
    where (p_delivery_speed = 'standard' and s.starts_at >= standard_from)
       or (p_delivery_speed = 'express' and s.starts_at >= now() + interval '2 hours' and s.starts_at < standard_start)
    order by s.starts_at
  loop
    -- Serialize all attempts for a time window, including generated fallback windows.
    perform pg_advisory_xact_lock(hashtextextended(slot_row.starts_at::text, 0));
    select s.capacity into selected_capacity
      from public.delivery_slots s where s.starts_at = slot_row.starts_at and s.ends_at = slot_row.ends_at
      order by s.id limit 1 for update;
    if not found then selected_capacity := 20; end if;
    select count(*)::integer into occupied from public.orders o
      where o.delivery_slot_start = slot_row.starts_at and o.delivery_slot_end = slot_row.ends_at
        and o.status::text not in ('cancelled', 'refunded', 'returned');
    if occupied < selected_capacity then
      selected_start := slot_row.starts_at;
      selected_end := slot_row.ends_at;
      exit;
    end if;
  end loop;

  if selected_start is null then raise exception 'NO_DELIVERY_SLOT_AVAILABLE'; end if;
  delivery_label := to_char(selected_start at time zone 'Asia/Kolkata', 'Dy DD Mon') || ', ' ||
    to_char(selected_start at time zone 'Asia/Kolkata', 'HH12 AM') || ' - ' ||
    to_char(selected_end at time zone 'Asia/Kolkata', 'HH12 AM');
  select coalesce(jsonb_agg(item || jsonb_build_object('substitute', false)), '[]'::jsonb)
    into safe_items from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as items(item);

  -- The existing transactional order RPC continues to validate prices, stock,
  -- coupon, address, payment, delivery windows, GST, packaging, and base delivery.
  v_order_id := public.place_order(
    p_address_id, safe_items, p_payment_method, selected_start, selected_end,
    delivery_label, p_coupon_code, p_delivery_instructions,
    coalesce(p_contactless_delivery, false), false
  );

  select o.total into base_total from public.orders o where o.id = v_order_id for update;
  fee := case when p_delivery_speed = 'express' then 49 else 0 end;
  final_total := round(base_total + fee, 2);
  if abs(final_total - p_expected_total) > 0.01 then raise exception 'TOTAL_MISMATCH'; end if;

  update public.orders set total = final_total, delivery_speed = p_delivery_speed, express_fee = fee where id = v_order_id;
  update public.payments payment set amount = final_total where payment.order_id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'delivery_slot', delivery_label,
    'delivery_slot_start', selected_start,
    'delivery_slot_end', selected_end,
    'delivery_speed', p_delivery_speed,
    'express_fee', fee,
    'total', final_total
  );
end;
$$;
revoke all on function public.customer_place_checkout_order(bigint, jsonb, text, text, numeric, text, text, boolean) from public, anon;
grant execute on function public.customer_place_checkout_order(bigint, jsonb, text, text, numeric, text, text, boolean) to authenticated;

drop function if exists public.admin_list_orders();
create function public.admin_list_orders()
returns table(order_id bigint, customer_name text, customer_email text, total numeric, status public.order_status, created_at timestamptz, delivery_slot text, delivery_slot_start timestamptz, delivery_slot_end timestamptz, delivered_at timestamptz, address_line text, item_count bigint, delivery_speed text, express_fee numeric)
language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('orders:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select o.id, coalesce(u.full_name, split_part(coalesce(a.email, ''), '@', 1), 'Customer')::text,
    coalesce(a.email, '')::text, case when public.current_role() = 'picker' then null else o.total end,
    o.status, o.created_at, o.delivery_slot, o.delivery_slot_start, o.delivery_slot_end, o.delivered_at,
    concat_ws(', ', ad.line1, ad.city, ad.postal_code), count(oi.id)::bigint,
    coalesce(o.delivery_speed, 'standard'), coalesce(o.express_fee, 0)
  from public.orders o left join public.users u on u.id = o.user_id left join auth.users a on a.id = o.user_id
    left join public.addresses ad on ad.id = o.address_id left join public.order_items oi on oi.order_id = o.id
  where public.current_role() <> 'picker' or o.status in ('accepted', 'picking')
  group by o.id, u.full_name, a.email, ad.line1, ad.city, ad.postal_code
  order by o.delivery_slot_start nulls last, o.created_at desc;
end;
$$;
grant execute on function public.admin_list_orders() to authenticated;
revoke all on function public.admin_list_orders() from public, anon;

drop function if exists public.admin_list_fulfilment_orders(text);
create function public.admin_list_fulfilment_orders(p_queue text default 'all')
returns table(order_id bigint, customer_name text, total numeric, status public.order_status, delivery_slot text, delivery_slot_start timestamptz, delivery_slot_end timestamptz, delivered_at timestamptz, address_line text, item_count bigint, delivery_instructions text, contactless_delivery boolean, substitute_unavailable boolean, delivery_speed text)
language plpgsql security definer set search_path=public as $$
begin
  if p_queue = 'all' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue = 'picker' and not public.current_role_has_permission('picker:use') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue = 'delivery' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue not in ('all', 'picker', 'delivery') then raise exception 'INVALID_FULFILMENT_QUEUE'; end if;
  return query select o.id::bigint, coalesce(nullif(u.full_name::text, ''), 'Customer')::text,
    case when public.current_role() = 'picker' then null else o.total end, o.status, o.delivery_slot::text,
    o.delivery_slot_start, o.delivery_slot_end, o.delivered_at,
    concat_ws(', ', ad.line1, ad.city, ad.postal_code)::text, count(oi.id)::bigint,
    coalesce(nullif(btrim(o.delivery_instructions), ''), nullif(btrim(ad.delivery_instructions), ''))::text,
    coalesce(o.contactless_delivery, false), coalesce(o.substitute_unavailable, false), coalesce(o.delivery_speed, 'standard')
  from public.orders o left join public.users u on u.id = o.user_id left join public.addresses ad on ad.id = o.address_id
    left join public.order_items oi on oi.order_id = o.id
  where (p_queue = 'all' or (p_queue = 'picker' and o.status in ('accepted', 'picking')) or (p_queue = 'delivery' and o.status in ('packed', 'out_for_delivery')))
  group by o.id, u.full_name, ad.line1, ad.city, ad.postal_code, ad.delivery_instructions
  order by o.delivery_slot_start nulls last, o.created_at desc;
end;
$$;
grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;
revoke all on function public.admin_list_fulfilment_orders(text) from public, anon;

commit;
notify pgrst, 'reload schema';
