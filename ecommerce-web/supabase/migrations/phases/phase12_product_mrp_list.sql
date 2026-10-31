-- Include MRP in the existing product list RPC response.
-- PostgreSQL cannot change a function's OUT/RETURNS TABLE shape with CREATE OR REPLACE,
-- so recreate this zero-argument RPC with its expanded result type.
drop function if exists public.admin_list_products();

create function public.admin_list_products()
returns table (
  product_id bigint,
  product_name text,
  sku text,
  category_name text,
  brand_name text,
  selling_price numeric,
  mrp numeric,
  current_stock integer,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('store_manager') then
    raise exception 'MANAGER_ROLE_REQUIRED';
  end if;

  return query
  select
    p.id::bigint,
    p.name::text,
    p.sku::text,
    c.name::text,
    b.name::text,
    p.selling_price::numeric,
    p.mrp::numeric,
    coalesce(i.current_stock, 0)::integer,
    p.is_active
  from public.products p
  left join public.categories c on c.id = p.category_id
  left join public.brands b on b.id = p.brand_id
  left join public.inventory i on i.product_id = p.id
  order by p.name;
end;
$$;

grant execute on function public.admin_list_products() to authenticated;
