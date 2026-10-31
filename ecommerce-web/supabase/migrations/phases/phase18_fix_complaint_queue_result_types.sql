-- Ensure every expression returned by the complaint queue RPC exactly matches
-- its declared RETURNS TABLE type. Explicit casts avoid PostgREST runtime
-- errors when auth.users.email or enum-backed status columns resolve differently.
create or replace function public.admin_list_complaints()
returns table(
  complaint_id bigint,
  order_id bigint,
  customer_name text,
  customer_email text,
  issue_type text,
  severity text,
  status text,
  assigned_to uuid,
  assigned_name text,
  orders_status_at_filing public.order_status,
  current_order_status public.order_status,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  raised_by uuid,
  raised_by_name text,
  notes text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.users as u
    join public.roles as r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name in ('super_admin', 'store_manager')
  ) then
    raise exception 'COMPLAINT_ACCESS_REQUIRED' using errcode = '42501';
  end if;

  return query
    select
      c.id::bigint,
      c.order_id::bigint,
      coalesce(nullif(cu.full_name::text, ''), ca.email::text, 'Customer')::text,
      coalesce(ca.email::text, '')::text,
      c.issue_type::text,
      c.severity::text,
      c.status::text,
      c.assigned_to::uuid,
      coalesce(nullif(ass.full_name::text, ''), aa.email::text)::text,
      c.orders_status_at_filing::public.order_status,
      o.status::public.order_status,
      c.created_at::timestamptz,
      c.updated_at::timestamptz,
      c.resolved_at::timestamptz,
      c.raised_by::uuid,
      coalesce(nullif(ru.full_name::text, ''), ra.email::text, 'Admin')::text,
      c.notes::text
    from public.complaints as c
    join public.orders as o on o.id = c.order_id
    left join public.users as cu on cu.id = o.user_id
    left join auth.users as ca on ca.id = o.user_id
    left join public.users as ass on ass.id = c.assigned_to
    left join auth.users as aa on aa.id = c.assigned_to
    left join public.users as ru on ru.id = c.raised_by
    left join auth.users as ra on ra.id = c.raised_by
    order by case c.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
      c.created_at desc;
end;
$$;

revoke all on function public.admin_list_complaints() from public, anon;
grant execute on function public.admin_list_complaints() to authenticated;
notify pgrst, 'reload schema';
