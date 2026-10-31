-- Phase 2: customer profile, addresses, order history and tracking access.

alter table public.users enable row level security;
drop policy if exists "own profile" on public.users;
create policy "own profile" on public.users for select using (id = auth.uid());
drop policy if exists "update own profile" on public.users;
create policy "update own profile" on public.users for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own addresses" on public.addresses;
create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select using (user_id = auth.uid());
drop policy if exists "own order items" on public.order_items;
create policy "own order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

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
  if p_address_id is null or not exists (select 1 from public.addresses where id = p_address_id and user_id = auth.uid()) then raise exception 'ADDRESS_REQUIRED'; end if;
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

grant execute on function public.place_order(bigint, jsonb, text, text) to authenticated;
