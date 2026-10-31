-- Atomic, short-lived cart holds so concurrent customers cannot claim the same final unit.
alter table public.cart add column if not exists updated_at timestamptz not null default now();
-- The existing primary key makes user_id and variant NOT NULL, so drop it first
-- before enabling guest/session cart rows with a nullable user_id.
alter table public.cart drop constraint if exists cart_pkey;
alter table public.cart alter column user_id drop not null;
alter table public.cart alter column variant drop not null;
alter table public.cart alter column variant set default '';

create unique index if not exists cart_user_product_variant_unique
  on public.cart(user_id, product_id, coalesce(variant, '')) where user_id is not null;
create unique index if not exists cart_session_product_variant_unique
  on public.cart(session_id, product_id, coalesce(variant, '')) where user_id is null and session_id is not null;
create index if not exists cart_active_holds_product_idx
  on public.cart(product_id, updated_at) where quantity > 0;

create or replace function public.set_cart_item_quantity(
  p_product_id bigint,
  p_quantity integer,
  p_variant text default null,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_variant text := coalesce(p_variant, '');
  v_inventory_available integer;
  v_other_cart_quantity integer;
  v_available integer;
  v_current_quantity integer := 0;
begin
  if v_user_id is null and coalesce(p_session_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'CART_SESSION_REQUIRED', 'available', 0, 'quantity', 0);
  end if;
  if p_quantity is null or p_quantity < 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_QUANTITY', 'available', 0, 'quantity', 0);
  end if;
  if p_quantity > 99 then
    return jsonb_build_object('ok', false, 'error', 'MAX_QUANTITY_EXCEEDED', 'available', 99, 'quantity', 99);
  end if;

  delete from public.cart where updated_at < now() - interval '15 minutes';

  select greatest(0, coalesce(i.current_stock, 0) - coalesce(i.reserved_stock, 0))::integer
    into v_inventory_available
    from public.inventory i
    join public.products p on p.id = i.product_id and p.is_active
   where i.product_id = p_product_id
   for update of i;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'PRODUCT_UNAVAILABLE', 'available', 0, 'quantity', 0);
  end if;

  select coalesce(sum(c.quantity), 0)::integer into v_other_cart_quantity
    from public.cart c
   where c.product_id = p_product_id
     and c.updated_at >= now() - interval '15 minutes'
     and not (
       coalesce(c.variant, '') = v_variant and (
         (v_user_id is not null and c.user_id = v_user_id)
         or (v_user_id is null and c.user_id is null and c.session_id = p_session_id)
       )
     );

  v_available := greatest(0, v_inventory_available - v_other_cart_quantity);

  select c.quantity into v_current_quantity
    from public.cart c
   where c.product_id = p_product_id and coalesce(c.variant, '') = v_variant
     and ((v_user_id is not null and c.user_id = v_user_id)
       or (v_user_id is null and c.user_id is null and c.session_id = p_session_id))
   limit 1;
  v_current_quantity := coalesce(v_current_quantity, 0);

  if p_quantity > v_available then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_STOCK', 'available', v_available, 'quantity', v_current_quantity);
  end if;

  if p_quantity = 0 then
    delete from public.cart c
     where c.product_id = p_product_id and coalesce(c.variant, '') = v_variant
       and ((v_user_id is not null and c.user_id = v_user_id)
         or (v_user_id is null and c.user_id is null and c.session_id = p_session_id));
    return jsonb_build_object('ok', true, 'available', v_available, 'quantity', 0, 'product_id', p_product_id);
  end if;

  update public.cart c set quantity = p_quantity, updated_at = now()
   where c.product_id = p_product_id and coalesce(c.variant, '') = v_variant
     and ((v_user_id is not null and c.user_id = v_user_id)
       or (v_user_id is null and c.user_id is null and c.session_id = p_session_id));
  if not found then
    insert into public.cart(user_id, session_id, product_id, variant, quantity, updated_at)
    values (v_user_id, case when v_user_id is null then p_session_id else null end, p_product_id, v_variant, p_quantity, now());
  end if;

  return jsonb_build_object('ok', true, 'available', v_available, 'quantity', p_quantity, 'product_id', p_product_id);
end;
$$;

create or replace function public.get_cart_items(p_session_id text default null)
returns table(product_id bigint, variant text, quantity integer, available_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid();
begin
  delete from public.cart where updated_at < now() - interval '15 minutes';
  if v_user_id is null and coalesce(p_session_id, '') = '' then
    return;
  end if;

  -- An active cart renews its 15-minute reservation lease when refreshed.
  update public.cart set updated_at = now()
   where updated_at >= now() - interval '15 minutes'
     and ((v_user_id is not null and user_id = v_user_id)
       or (v_user_id is null and user_id is null and session_id = p_session_id));

  return query
  select c.product_id, coalesce(c.variant, ''), c.quantity,
         greatest(0, coalesce(i.current_stock, 0) - coalesce(i.reserved_stock, 0) - coalesce((
           select sum(other_cart.quantity)::integer from public.cart other_cart
            where other_cart.product_id = c.product_id
              and other_cart.updated_at >= now() - interval '15 minutes'
              and not (
                coalesce(other_cart.variant, '') = coalesce(c.variant, '') and (
                  (v_user_id is not null and other_cart.user_id = v_user_id)
                  or (v_user_id is null and other_cart.user_id is null and other_cart.session_id = p_session_id)
                )
              )
         ), 0))::integer
    from public.cart c
    left join public.inventory i on i.product_id = c.product_id
   where c.updated_at >= now() - interval '15 minutes'
     and ((v_user_id is not null and c.user_id = v_user_id)
       or (v_user_id is null and c.user_id is null and c.session_id = p_session_id));
end;
$$;

create or replace function public.clear_guest_cart(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_session_id, '') = '' then return; end if;
  delete from public.cart where user_id is null and session_id = p_session_id;
end;
$$;

revoke all on function public.set_cart_item_quantity(bigint, integer, text, text) from public;
revoke all on function public.get_cart_items(text) from public;
revoke all on function public.clear_guest_cart(text) from public;
grant execute on function public.set_cart_item_quantity(bigint, integer, text, text) to anon, authenticated;
grant execute on function public.get_cart_items(text) to anon, authenticated;
grant execute on function public.clear_guest_cart(text) to authenticated;
