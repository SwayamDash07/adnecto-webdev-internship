-- Remove customer-directory access from store managers.
-- Apply after phase15_role_based_access.sql.

create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.current_role()
    when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send')
    when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view')
    when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
    else false end
$$;
revoke all on function public.current_role_has_permission(text) from public, anon;
grant execute on function public.current_role_has_permission(text) to authenticated;

-- This SECURITY DEFINER RPC was originally guarded by the broad legacy
-- store_manager role. Guard it with the current permission matrix instead.
create or replace function public.admin_list_customers()
returns table (customer_id uuid, customer_name text, email text, phone text, order_count bigint, lifetime_spend numeric, joined_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.current_role_has_permission('customers:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query
    select u.id, coalesce(nullif(u.full_name, ''), split_part(coalesce(a.email, ''), '@', 1), 'Customer')::text,
      coalesce(a.email, '')::text, u.phone::text, count(o.id)::bigint,
      coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric, u.created_at
    from public.users u
    join auth.users a on a.id = u.id
    left join public.orders o on o.user_id = u.id
    left join public.roles r on r.id = u.role_id
    where coalesce(r.name::text, 'customer') = 'customer'
    group by u.id, u.full_name, a.email, u.phone, u.created_at
    order by u.created_at desc;
end; $$;
revoke all on function public.admin_list_customers() from public, anon;
grant execute on function public.admin_list_customers() to authenticated;
