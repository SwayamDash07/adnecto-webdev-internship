-- Fixes admin_list_orders when an existing database function has mismatched
-- inferred column types. Run this after phase2_admin_orders.sql.

drop function if exists public.admin_list_orders();

create function public.admin_list_orders()
returns table (
  order_id bigint,
  customer_name text,
  customer_email text,
  total numeric,
  status public.order_status,
  created_at timestamptz,
  delivery_slot text,
  address_line text,
  item_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role('store_manager')
    or public.has_role('picker')
    or public.has_role('accountant')
  ) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;

  return query
    select
      o.id::bigint,
      coalesce(nullif(u.full_name::text, ''), nullif(split_part(coalesce(a.email::text, ''), '@', 1), ''), 'Customer')::text,
      coalesce(a.email::text, '')::text,
      o.total::numeric,
      o.status::public.order_status,
      o.created_at::timestamptz,
      o.delivery_slot::text,
      concat_ws(', ', ad.line1, ad.city, ad.postal_code)::text,
      count(oi.id)::bigint
    from public.orders o
    left join auth.users a on a.id = o.user_id
    left join public.users u on u.id = o.user_id
    left join public.addresses ad on ad.id = o.address_id
    left join public.order_items oi on oi.order_id = o.id
    group by o.id, u.full_name, a.email, ad.line1, ad.city, ad.postal_code
    order by o.created_at desc;
end;
$$;

grant execute on function public.admin_list_orders() to authenticated;

