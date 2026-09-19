-- Phase 2 reporting RPCs.

create or replace function public.admin_sales_report(p_from date default current_date - 30, p_to date default current_date)
returns table (day date, order_count bigint, revenue numeric)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then
    raise exception 'REPORT_ROLE_REQUIRED';
  end if;
  return query
    select date_trunc('day', o.created_at)::date,
           count(*)::bigint,
           coalesce(sum(o.total), 0)::numeric
    from public.orders o
    where o.created_at >= p_from::timestamptz
      and o.created_at < (p_to + 1)::timestamptz
      and o.status <> 'cancelled'
    group by 1
    order by 1;
end;
$$;

create or replace function public.admin_top_products_report(p_from date default current_date - 30, p_to date default current_date)
returns table (product_id bigint, product_name text, units_sold bigint, revenue numeric)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('accountant') or public.has_role('store_manager')) then
    raise exception 'REPORT_ROLE_REQUIRED';
  end if;
  return query
    select p.id::bigint, p.name::text,
           coalesce(sum(oi.quantity), 0)::bigint,
           coalesce(sum(oi.quantity * oi.unit_price), 0)::numeric
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.created_at >= p_from::timestamptz
      and o.created_at < (p_to + 1)::timestamptz
      and o.status <> 'cancelled'
    group by p.id, p.name
    order by units_sold desc, revenue desc;
end;
$$;

create or replace function public.admin_inventory_report()
returns table (product_id bigint, product_name text, current_stock integer, reserved_stock integer, reorder_level integer, low_stock boolean)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('inventory_manager') or public.has_role('accountant') or public.has_role('store_manager')) then
    raise exception 'REPORT_ROLE_REQUIRED';
  end if;
  return query
    select p.id::bigint, p.name::text, i.current_stock::integer, i.reserved_stock::integer,
           i.reorder_level::integer, (i.current_stock - i.reserved_stock <= i.reorder_level)
    from public.inventory i join public.products p on p.id = i.product_id
    order by low_stock desc, p.name;
end;
$$;

grant execute on function public.admin_sales_report(date, date) to authenticated;
grant execute on function public.admin_top_products_report(date, date) to authenticated;
grant execute on function public.admin_inventory_report() to authenticated;

