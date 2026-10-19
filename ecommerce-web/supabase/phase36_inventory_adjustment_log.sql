-- Read-only view of manual inventory corrections.
create or replace function public.admin_list_inventory_adjustments(
  p_limit int default 20,
  p_offset int default 0,
  p_search text default null
)
returns table(
  adjustment_id bigint,
  created_at timestamptz,
  product_name text,
  sku text,
  warehouse text,
  quantity_change integer,
  reason text,
  done_by text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_role_has_permission('inventory:view') then
    raise exception 'INVENTORY_VIEW_PERMISSION_REQUIRED' using errcode='42501';
  end if;

  return query
  select
    movement.id,
    movement.created_at,
    product.name::text,
    product.sku::text,
    coalesce(nullif(movement.warehouse, ''), 'default')::text,
    case when movement.movement_type='adjustment' then movement.quantity else -movement.quantity end,
    coalesce(nullif(movement.reason, ''), initcap(replace(movement.movement_type, '_', ' ')))::text,
    coalesce(
      nullif(staff.full_name, ''),
      nullif(account.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(account.email, ''), '@', 1), ''),
      'Staff member'
    )::text
  from public.inventory_movements movement
  join public.products product on product.id=movement.product_id
  left join public.users staff on staff.id=movement.actor_id
  left join auth.users account on account.id=movement.actor_id
  where movement.reference_type='manual_adjustment'
    and (
      nullif(trim(p_search), '') is null
      or product.name ilike '%'||trim(p_search)||'%'
      or coalesce(product.sku, '') ilike '%'||trim(p_search)||'%'
      or coalesce(movement.warehouse, '') ilike '%'||trim(p_search)||'%'
      or coalesce(movement.reason, '') ilike '%'||trim(p_search)||'%'
      or coalesce(staff.full_name, account.raw_user_meta_data->>'full_name', account.email, '') ilike '%'||trim(p_search)||'%'
    )
  order by movement.created_at desc, movement.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_inventory_adjustments(int,int,text) from public, anon, service_role;
grant execute on function public.admin_list_inventory_adjustments(int,int,text) to authenticated;
notify pgrst, 'reload schema';
