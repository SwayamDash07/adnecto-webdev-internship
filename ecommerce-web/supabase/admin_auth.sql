-- Run this once in the Supabase SQL Editor after schema.sql/live_reporting.sql.
-- super_admin is the main administrator. Other staff roles can use the panel,
-- but only super_admin can manage administrator accounts.
-- After creating the first admin in Supabase Authentication, promote that user
-- by replacing the email below and running this statement:
-- update public.users
-- set role_id = (select id from public.roles where name = 'super_admin')
-- where id = (select id from auth.users where email = 'main-admin@example.com');

insert into public.roles (name)
values ('customer'), ('delivery_boy'), ('cashier'), ('picker'),
       ('store_manager'), ('inventory_manager'), ('accountant'), ('super_admin')
on conflict (name) do nothing;

create or replace function public.get_my_admin_profile()
returns table (
  id uuid,
  email text,
  full_name text,
  role_name public.app_role,
  is_main_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         coalesce(a.email, '')::text,
         coalesce(nullif(u.full_name, ''), split_part(coalesce(a.email, ''), '@', 1))::text,
         r.name,
         (r.name = 'super_admin')
  from public.users u
  join public.roles r on r.id = u.role_id
  join auth.users a on a.id = u.id
  where u.id = auth.uid()
    and r.name <> 'customer';
$$;

grant execute on function public.get_my_admin_profile() to authenticated;
