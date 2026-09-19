-- Phase 4: authoritative coupon validation and checkout totals.

create or replace function public.customer_validate_coupon(p_code text, p_subtotal numeric)
returns table (valid boolean, discount numeric, kind text, message text)
language plpgsql security definer set search_path = public
as $$
declare v_coupon public.coupons%rowtype; v_discount numeric := 0;
begin
  select * into v_coupon from public.coupons c
  where upper(c.code) = upper(trim(coalesce(p_code, '')))
    and c.active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at >= now())
  limit 1;
  if not found then return query select false, 0::numeric, ''::text, 'Coupon is invalid or expired.'::text; return; end if;
  if v_coupon.kind = 'percentage' then v_discount := round(greatest(p_subtotal, 0) * v_coupon.value / 100);
  elsif v_coupon.kind = 'flat' then v_discount := least(greatest(p_subtotal, 0), v_coupon.value);
  else v_discount := 0; end if;
  return query select true, v_discount, v_coupon.kind, 'Coupon applied.'::text;
end;
$$;

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
  v_order_id bigint; v_item jsonb; v_product_id bigint; v_requested_id bigint;
  v_sku text; v_name text; v_quantity integer; v_price numeric;
  v_subtotal numeric := 0; v_discount numeric := 0; v_delivery numeric := 0; v_packing numeric := 19; v_total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_address_id is null or not exists (select 1 from public.addresses where id = p_address_id and user_id = auth.uid()) then raise exception 'ADDRESS_REQUIRED'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'EMPTY_CART'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint; v_product_id := null;
    v_sku := nullif(v_item->>'sku', ''); v_name := nullif(v_item->>'name', ''); v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
    if v_sku is not null then select id, selling_price into v_product_id, v_price from public.products where sku = v_sku and is_active; end if;
    if v_price is null and v_name is not null then select id, selling_price into v_product_id, v_price from public.products where lower(name) = lower(v_name) and is_active; end if;
    if v_price is null and v_requested_id is not null then select id, selling_price into v_product_id, v_price from public.products where id = v_requested_id and is_active; end if;
    if v_price is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    update public.inventory set current_stock = current_stock - v_quantity where product_id = v_product_id and current_stock - reserved_stock >= v_quantity;
    if not found then raise exception 'INSUFFICIENT_STOCK:%', v_product_id; end if;
    v_subtotal := v_subtotal + v_price * v_quantity;
  end loop;
  if v_subtotal >= 499 then v_delivery := 0; else v_delivery := 49; end if;
  if v_subtotal >= 3000 then v_discount := round(v_subtotal * 0.1); end if;
  if nullif(trim(p_coupon_code), '') is not null then
    v_price := null;
    select discount into v_price from public.customer_validate_coupon(p_coupon_code, v_subtotal) where valid;
    v_discount := v_discount + coalesce(v_price, 0);
  end if;
  v_total := greatest(0, v_subtotal + v_delivery + v_packing - v_discount);
  insert into public.orders(user_id, address_id, delivery_slot, total) values (auth.uid(), p_address_id, p_delivery_slot, v_total) returning id into v_order_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_requested_id := nullif(v_item->>'product_id', '')::bigint; v_product_id := null;
    v_sku := nullif(v_item->>'sku', ''); v_name := nullif(v_item->>'name', ''); v_quantity := (v_item->>'quantity')::integer;
    if v_sku is not null then select id into v_product_id from public.products where sku = v_sku; end if;
    if v_product_id is null and v_name is not null then select id into v_product_id from public.products where lower(name) = lower(v_name); end if;
    if v_product_id is null then v_product_id := v_requested_id; end if;
    select selling_price into v_price from public.products where id = v_product_id;
    insert into public.order_items(order_id, product_id, quantity, unit_price, substitute_if_unavailable) values (v_order_id, v_product_id, v_quantity, v_price, coalesce((v_item->>'substitute')::boolean, false));
  end loop;
  insert into public.payments(order_id, method, amount) values (v_order_id, p_payment_method, v_total);
  delete from public.cart where user_id = auth.uid();
  return v_order_id;
end;
$$;

grant execute on function public.customer_validate_coupon(text,numeric) to authenticated;
grant execute on function public.place_order(bigint,jsonb,text,text,text) to authenticated;
