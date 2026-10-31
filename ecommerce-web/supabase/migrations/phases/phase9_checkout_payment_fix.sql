-- Checkout hardening: only prepaid online payments and COD are offered for new orders.
-- Also resets per-item lookup variables so a multi-item cart cannot produce
-- INSUFFICIENT_STOCK:<NULL> after the first item.

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('prepaid', 'upi', 'card', 'netbanking', 'wallet', 'cod', 'Razorpay'));

create or replace function public.place_order(
  p_address_id bigint,
  p_items jsonb,
  p_payment_method text,
  p_delivery_slot text,
  p_coupon_code text
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
  v_gst numeric;
  v_subtotal numeric := 0;
  v_gst_total numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_packing numeric := 19;
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if lower(trim(coalesce(p_payment_method, ''))) not in ('prepaid', 'razorpay', 'cod') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_address_id is null or not exists (select 1 from public.addresses where id = p_address_id and user_id = auth.uid()) then raise exception 'ADDRESS_REQUIRED'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'EMPTY_CART'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint;
    v_product_id := null;
    v_sku := nullif(v_item->>'sku', '');
    v_name := nullif(v_item->>'name', '');
    v_quantity := (v_item->>'quantity')::integer;
    v_price := null;
    v_gst := null;
    if v_quantity is null or v_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
    if v_sku is not null then select id, selling_price, gst into v_product_id, v_price, v_gst from public.products where sku = v_sku and is_active; end if;
    if v_price is null and v_name is not null then select id, selling_price, gst into v_product_id, v_price, v_gst from public.products where lower(name) = lower(v_name) and is_active; end if;
    if v_price is null and v_requested_id is not null then select id, selling_price, gst into v_product_id, v_price, v_gst from public.products where id = v_requested_id and is_active; end if;
    if v_product_id is null or v_price is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    update public.inventory set current_stock = current_stock - v_quantity where product_id = v_product_id and current_stock - reserved_stock >= v_quantity;
    if not found then raise exception 'INSUFFICIENT_STOCK:%', v_product_id; end if;
    v_subtotal := v_subtotal + v_price * v_quantity;
    v_gst_total := v_gst_total + (v_price * v_quantity * coalesce(v_gst, 0) / 100);
  end loop;

  if v_subtotal >= 499 then v_delivery := 0; else v_delivery := 49; end if;
  if v_subtotal >= 3000 then v_discount := round(v_subtotal * 0.1); end if;
  if nullif(trim(p_coupon_code), '') is not null then
    v_price := null;
    select discount into v_price from public.customer_validate_coupon(p_coupon_code, v_subtotal) where valid;
    v_discount := v_discount + coalesce(v_price, 0);
  end if;
  v_total := greatest(0, v_subtotal + v_gst_total + v_delivery + v_packing - v_discount);
  insert into public.orders(user_id, address_id, delivery_slot, total) values (auth.uid(), p_address_id, p_delivery_slot, v_total) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint;
    v_product_id := null;
    v_sku := nullif(v_item->>'sku', '');
    v_name := nullif(v_item->>'name', '');
    v_quantity := (v_item->>'quantity')::integer;
    if v_sku is not null then select id into v_product_id from public.products where sku = v_sku; end if;
    if v_product_id is null and v_name is not null then select id into v_product_id from public.products where lower(name) = lower(v_name); end if;
    if v_product_id is null then v_product_id := v_requested_id; end if;
    select selling_price into v_price from public.products where id = v_product_id;
    insert into public.order_items(order_id, product_id, quantity, unit_price, substitute_if_unavailable) values (v_order_id, v_product_id, v_quantity, v_price, coalesce((v_item->>'substitute')::boolean, false));
  end loop;
  insert into public.payments(order_id, method, amount) values (v_order_id, case when lower(trim(p_payment_method)) in ('prepaid', 'razorpay') then 'prepaid' else 'cod' end, v_total);
  delete from public.cart where user_id = auth.uid();
  return v_order_id;
end;
$$;

grant execute on function public.place_order(bigint, jsonb, text, text, text) to authenticated;
