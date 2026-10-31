create or replace function public.place_order(
  p_address_id bigint,
  p_items jsonb,
  p_payment_method text,
  p_delivery_slot text default null
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_order_id bigint;
  v_item jsonb;
  v_product_id bigint;
  v_requested_id bigint;
  v_sku text;
  v_name text;
  v_quantity integer;
  v_price numeric;
  v_total numeric := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'EMPTY_CART'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint;
    v_product_id := null;
    v_sku := nullif(v_item->>'sku', '');
    v_name := nullif(v_item->>'name', '');
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
    v_price := null;
    if v_sku is not null then select id, selling_price into v_product_id, v_price from public.products where sku = v_sku; end if;
    if v_price is null and v_name is not null then select id, selling_price into v_product_id, v_price from public.products where lower(name) = lower(v_name); end if;
    if v_price is null and v_requested_id is not null then select id, selling_price into v_product_id, v_price from public.products where id = v_requested_id; end if;
    if v_price is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    update public.inventory set current_stock = current_stock - v_quantity
      where product_id = v_product_id and coalesce(current_stock, 0) - coalesce(reserved_stock, 0) >= v_quantity;
    if not found then raise exception 'INSUFFICIENT_STOCK:%', v_product_id; end if;
    v_total := v_total + (v_price * v_quantity);
  end loop;

  insert into public.orders(user_id, address_id, delivery_slot, total)
    values (auth.uid(), p_address_id, p_delivery_slot, v_total) returning id into v_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint;
    v_product_id := null;
    v_sku := nullif(v_item->>'sku', '');
    v_name := nullif(v_item->>'name', '');
    v_quantity := (v_item->>'quantity')::integer;
    if v_sku is not null then select id into v_product_id from public.products where sku = v_sku; end if;
    if v_product_id is null and v_name is not null then select id into v_product_id from public.products where lower(name) = lower(v_name); end if;
    if v_product_id is null and v_requested_id is not null then select id into v_product_id from public.products where id = v_requested_id; end if;
    select selling_price into v_price from public.products where id = v_product_id;
    insert into public.order_items(order_id, product_id, quantity, unit_price, substitute_if_unavailable)
      values (v_order_id, v_product_id, v_quantity, v_price, coalesce((v_item->>'substitute')::boolean, false));
  end loop;
  insert into public.payments(order_id, method, amount) values (v_order_id, p_payment_method, v_total);
  delete from public.cart where user_id = auth.uid();
  return v_order_id;
end;
$$;

create or replace view public.dashboard_daily_sales as
select date_trunc('day', created_at)::date as day, count(*)::integer as orders,
       coalesce(sum(total), 0)::numeric as revenue
from public.orders where status <> 'cancelled' group by 1 order by 1;

create or replace view public.dashboard_summary as
select
  coalesce(sum(total) filter (where created_at >= current_date and status <> 'cancelled'), 0)::numeric as today_sales,
  count(*) filter (where created_at >= current_date and status <> 'cancelled')::integer as today_orders,
  count(*) filter (where status in ('placed','accepted','picking','packed','out_for_delivery'))::integer as pending_deliveries,
  (select count(*) from public.inventory where current_stock - reserved_stock <= reorder_level)::integer as low_stock_items
from public.orders;

create or replace view public.dashboard_recent_orders as
select o.id, o.created_at, o.total, o.status, coalesce(u.full_name, 'Customer') as customer
from public.orders o left join public.users u on u.id = o.user_id order by o.created_at desc limit 8;

alter view public.dashboard_summary set (security_invoker = true);
alter view public.dashboard_daily_sales set (security_invoker = true);
alter view public.dashboard_recent_orders set (security_invoker = true);

-- Keep a public profile row available for every Supabase Auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill users who signed up before the trigger was installed.
insert into public.users (id, full_name)
select id,
       coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do update set full_name = excluded.full_name;
