-- Run after phase34_add_admin_role.sql has been committed, and after the
-- existing role, RBAC, customer support, and staff messaging migrations.

insert into public.roles(name)
values ('admin'), ('delivery_boy')
on conflict (name) do nothing;

-- Treat regular admins as full operational administrators for existing SQL
-- policies and RPCs. The account API separately enforces that only
-- super_admin can add/remove admin accounts.
create or replace function public.current_role()
returns text language sql stable security definer set search_path=public as $$
  select case when r.name::text='admin' then 'super_admin' else r.name::text end
  from public.users u join public.roles r on r.id=u.role_id
  where u.id=auth.uid()
  limit 1
$$;
revoke all on function public.current_role() from public,anon;
grant execute on function public.current_role() to authenticated;

create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select case public.current_role()
    when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','messages:send')
    when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view')
    when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
    when 'customer_support' then p_permission in ('complaints:manage','notifications:view')
    when 'delivery_boy' then p_permission in ('orders:view','delivery:manage','notifications:view')
    else false
  end
$$;
revoke all on function public.current_role_has_permission(text) from public,anon;
grant execute on function public.current_role_has_permission(text) to authenticated;

create or replace function public.current_complaint_staff_role()
returns text language sql stable security definer set search_path=public as $$
  select case when r.name::text='admin' then 'super_admin' else r.name::text end
  from public.users u join public.roles r on r.id=u.role_id
  where u.id=auth.uid()
$$;
revoke all on function public.current_complaint_staff_role() from public,anon;
grant execute on function public.current_complaint_staff_role() to authenticated;

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u join public.roles r on r.id=u.role_id
    where u.id=auth.uid() and (r.name=required_role or r.name::text in ('super_admin','admin'))
  )
$$;
revoke all on function public.has_role(public.app_role) from public,anon;
grant execute on function public.has_role(public.app_role) to authenticated;

-- Keep direct role changes main-admin-only even though current_role() grants
-- regular admins the same operational privileges as the main administrator.
create or replace function public.enforce_user_role_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_main_role integer; v_count integer; v_actor_is_main_admin boolean;
begin
  select id into v_main_role from public.roles where name::text='super_admin';
  select exists(
    select 1 from public.users u join public.roles r on r.id=u.role_id
    where u.id=auth.uid() and r.name::text='super_admin'
  ) into v_actor_is_main_admin;
  if tg_op='DELETE' then
    if old.role_id=v_main_role then
      perform pg_advisory_xact_lock(hashtext('cartly-main-admin-count'));
      select count(*) into v_count from public.users where role_id=v_main_role;
      if v_count<=1 then raise exception 'LAST_SUPER_ADMIN' using errcode='23514'; end if;
    end if;
    return old;
  elsif tg_op='UPDATE' and new.role_id is distinct from old.role_id then
    if auth.uid() is not null and not v_actor_is_main_admin then raise exception 'FORBIDDEN_ROLE_CHANGE' using errcode='42501'; end if;
    if old.role_id=v_main_role and new.role_id is distinct from old.role_id then
      perform pg_advisory_xact_lock(hashtext('cartly-main-admin-count'));
      select count(*) into v_count from public.users where role_id=v_main_role;
      if v_count<=1 then raise exception 'LAST_SUPER_ADMIN' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end
$$;

revoke insert,delete on public.users from anon,authenticated;
notify pgrst,'reload schema';
