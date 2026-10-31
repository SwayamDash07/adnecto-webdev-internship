-- Segment 8 performance and release preparation.
-- Run after all previous segment migrations.

-- The original payments table predates reporting timestamps.
alter table public.payments add column if not exists created_at timestamptz not null default now();

create index if not exists products_active_created_idx on public.products(is_active, created_at desc);
create index if not exists products_active_category_price_idx on public.products(is_active, category_id, selling_price);
create index if not exists orders_created_status_idx on public.orders(created_at desc, status);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_product_idx on public.order_items(order_id, product_id);
create index if not exists payments_status_created_idx on public.payments(status, created_at desc);
create index if not exists refunds_created_idx on public.refunds(created_at desc);
create index if not exists product_images_product_sort_idx on public.product_images(product_id, sort_order);

-- Keep planner statistics current after catalog/inventory imports.
analyze public.products;
analyze public.inventory;
analyze public.orders;
analyze public.order_items;
analyze public.payments;

create or replace function public.release_smoke_test()
returns table(check_name text, passed boolean, details text)
language sql security invoker set search_path = public as $$
  select 'products have active index'::text, exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'products_active_created_idx'), 'Catalog pagination index'::text
  union all select 'orders have status index', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_created_status_idx'), 'Order lifecycle index'::text
  union all select 'payment event table exists', to_regclass('public.payment_events') is not null, 'Webhook idempotency storage'::text;
$$;
grant execute on function public.release_smoke_test() to authenticated;
