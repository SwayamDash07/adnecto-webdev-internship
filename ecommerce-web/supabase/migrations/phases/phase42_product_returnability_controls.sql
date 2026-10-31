-- Product returnability controls: set on creation and edit from Inventory.
begin;

alter table public.products
  add column if not exists is_returnable boolean not null default true;

create or replace function public.admin_list_inventory_with_returnability()
returns table(
  product_id bigint,
  product_name text,
  sku text,
  current_stock integer,
  reserved_stock integer,
  reorder_level integer,
  is_returnable boolean
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('inventory:view') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  return query
    select p.id::bigint, p.name::text, p.sku::text,
      i.current_stock::integer, i.reserved_stock::integer, i.reorder_level::integer,
      coalesce(p.is_returnable, true)
    from public.inventory i
    join public.products p on p.id=i.product_id
    order by p.name;
end;
$$;
revoke all on function public.admin_list_inventory_with_returnability() from public, anon;
grant execute on function public.admin_list_inventory_with_returnability() to authenticated;

create or replace function public.admin_set_product_returnability(
  p_product_id bigint default null,
  p_is_returnable boolean default true
)
returns boolean
language plpgsql security definer set search_path=public as $$
declare old_value boolean;
begin
  if not public.current_role_has_permission('products:edit') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_product_id is null or p_is_returnable is null then
    raise exception 'INVALID_RETURNABILITY_UPDATE';
  end if;
  select is_returnable into old_value from public.products where id=p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if old_value is distinct from p_is_returnable then
    update public.products set is_returnable=p_is_returnable where id=p_product_id;
    insert into public.audit_logs(actor_id,action,table_name,row_id,payload)
    values(auth.uid(),'product_returnability_updated','products',p_product_id::text,
      jsonb_build_object('from',old_value,'to',p_is_returnable));
  end if;
  return p_is_returnable;
end;
$$;
revoke all on function public.admin_set_product_returnability(bigint,boolean) from public, anon;
grant execute on function public.admin_set_product_returnability(bigint,boolean) to authenticated;

create or replace function public.admin_create_product_with_returnability(
  p_name text default '',
  p_sku text default null,
  p_barcode text default null,
  p_brand text default null,
  p_category text default null,
  p_description text default null,
  p_selling_price numeric default 0,
  p_mrp numeric default 0,
  p_gst numeric default 0,
  p_hsn text default null,
  p_stock integer default 0,
  p_is_returnable boolean default true
)
returns bigint
language plpgsql security definer set search_path=public as $$
declare new_product_id bigint;
begin
  if not public.current_role_has_permission('products:create') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  new_product_id := public.admin_upsert_product(
    null, p_name, p_sku, p_barcode, p_brand, p_category, p_description,
    p_selling_price, p_mrp, p_gst, p_hsn, p_stock
  );
  update public.products set is_returnable=coalesce(p_is_returnable, true)
    where id=new_product_id;
  return new_product_id;
end;
$$;
revoke all on function public.admin_create_product_with_returnability(text,text,text,text,text,text,numeric,numeric,numeric,text,integer,boolean) from public, anon;
grant execute on function public.admin_create_product_with_returnability(text,text,text,text,text,text,numeric,numeric,numeric,text,integer,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
