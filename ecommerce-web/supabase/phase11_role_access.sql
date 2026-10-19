-- Enforce the same role separation in fulfilment RPCs as in the web UI.
-- Run after phase2_operations.sql and segment6_fulfilment.sql.

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
  if p_queue = 'all' and not (public.has_role('store_manager') or public.has_role('super_admin')) then
    raise exception 'MANAGER_ROLE_REQUIRED';
  end if;
  if p_queue = 'picker' and not (public.has_role('picker') or public.has_role('store_manager') or public.has_role('super_admin')) then
    raise exception 'PICKER_ROLE_REQUIRED';
  end if;
  if p_queue = 'delivery' and not (public.has_role('delivery_boy') or public.has_role('store_manager') or public.has_role('super_admin')) then
    raise exception 'DELIVERY_ROLE_REQUIRED';
  end if;
  if p_queue not in ('all', 'picker', 'delivery') then raise exception 'INVALID_FULFILMENT_QUEUE'; end if;
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

grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;
