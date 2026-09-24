-- Expose only storefront availability, not exact inventory quantities.
create or replace view public.catalog_product_availability as
select
  p.id as product_id,
  (coalesce(i.current_stock, 0) - coalesce(i.reserved_stock, 0) > 0) as in_stock
from public.products p
left join public.inventory i on i.product_id = p.id
where p.is_active = true;

alter view public.catalog_product_availability set (security_invoker = false);
grant select on public.catalog_product_availability to anon, authenticated;
