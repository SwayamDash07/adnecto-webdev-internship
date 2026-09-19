-- Phase 2 operations: live inventory controls and fulfilment queues.

create or replace function public.admin_list_inventory()
returns table (
  product_id bigint,
  product_name text,
  sku text,
  current_stock integer,
  reserved_stock integer,
  reorder_level integer
)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('inventory_manager') or public.has_role('store_manager')) then
    raise exception 'INVENTORY_ROLE_REQUIRED';
  end if;
  return query
    select p.id::bigint, p.name::text, p.sku::text,
           i.current_stock::integer, i.reserved_stock::integer, i.reorder_level::integer
    from public.inventory i
    join public.products p on p.id = i.product_id
    order by p.name;
end;
$$;

create or replace function public.admin_adjust_inventory(
  p_product_id bigint,
  p_delta integer,
  p_reason text default 'Stock correction'
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_stock integer;
begin
  if not (public.has_role('inventory_manager') or public.has_role('store_manager')) then
    raise exception 'INVENTORY_ROLE_REQUIRED';
  end if;
  if p_delta = 0 then raise exception 'INVALID_DELTA'; end if;
  update public.inventory
  set current_stock = current_stock + p_delta,
      warehouse_stock = warehouse_stock + p_delta
  where product_id = p_product_id and current_stock + p_delta >= reserved_stock
  returning current_stock into v_stock;
  if v_stock is null then raise exception 'INVENTORY_NOT_FOUND_OR_BELOW_RESERVED'; end if;
  insert into public.audit_logs(actor_id, action, table_name, row_id, payload)
  values (auth.uid(), 'inventory_adjusted', 'inventory', p_product_id::text,
          jsonb_build_object('delta', p_delta, 'reason', coalesce(p_reason, 'Stock correction'), 'current_stock', v_stock));
  return v_stock;
end;
$$;

create or replace function public.admin_list_fulfilment_orders(p_queue text default 'all')
returns table (
  order_id bigint,
  customer_name text,
  total numeric,
  status public.order_status,
  delivery_slot text,
  address_line text,
  item_count bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('picker') or public.has_role('delivery_boy') or public.has_role('store_manager')) then
    raise exception 'FULFILMENT_ROLE_REQUIRED';
  end if;
  return query
    select o.id::bigint,
      coalesce(nullif(u.full_name::text, ''), 'Customer')::text,
      o.total::numeric, o.status::public.order_status, o.delivery_slot::text,
      concat_ws(', ', ad.line1, ad.city, ad.postal_code)::text,
      count(oi.id)::bigint
    from public.orders o
    left join public.users u on u.id = o.user_id
    left join public.addresses ad on ad.id = o.address_id
    left join public.order_items oi on oi.order_id = o.id
    where (p_queue = 'all'
      or (p_queue = 'picker' and o.status in ('placed','accepted','picking','packed'))
      or (p_queue = 'delivery' and o.status in ('packed','out_for_delivery')))
    group by o.id, u.full_name, ad.line1, ad.city, ad.postal_code
    order by o.created_at desc;
end;
$$;

grant execute on function public.admin_list_inventory() to authenticated;
grant execute on function public.admin_adjust_inventory(bigint, integer, text) to authenticated;
grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;

create or replace function public.admin_update_fulfilment_status(
  p_order_id bigint,
  p_status public.order_status
)
returns public.order_status
language plpgsql security definer set search_path = public
as $$
declare v_status public.order_status;
  v_role public.app_role;
begin
  select r.name into v_role
  from public.users u join public.roles r on r.id = u.role_id
  where u.id = auth.uid();
  if v_role is null or v_role not in ('picker', 'delivery_boy', 'store_manager', 'super_admin') then
    raise exception 'FULFILMENT_ROLE_REQUIRED';
  end if;
  if v_role = 'picker' and p_status not in ('accepted','picking','packed') then
    raise exception 'PICKER_STATUS_NOT_ALLOWED';
  end if;
  if v_role = 'delivery_boy' and p_status not in ('out_for_delivery','delivered','returned') then
    raise exception 'DELIVERY_STATUS_NOT_ALLOWED';
  end if;
  update public.orders set status = p_status where id = p_order_id returning status into v_status;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id, action, table_name, row_id, payload)
  values (auth.uid(), 'fulfilment_status_updated', 'orders', p_order_id::text,
          jsonb_build_object('status', p_status::text));
  return v_status;
end;
$$;

grant execute on function public.admin_update_fulfilment_status(bigint, public.order_status) to authenticated;
