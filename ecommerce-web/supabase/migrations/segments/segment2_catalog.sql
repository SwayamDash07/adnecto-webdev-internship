-- Segment 2 catalog and product-system migration.
-- Run after schema.sql and phase1 catalog migrations.

create extension if not exists pg_trgm;

alter table public.products add column if not exists slug text;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists video_url text;
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists serving_size text;
alter table public.products add column if not exists unit text;
alter table public.products add column if not exists is_subscription boolean not null default false;
alter table public.products add column if not exists min_order_quantity integer not null default 1;
alter table public.products add column if not exists max_order_quantity integer;
alter table public.products drop constraint if exists products_product_type_check;
alter table public.products add constraint products_product_type_check check (product_type in ('simple','variable','loose_weight','combo','subscription','gift_pack'));
alter table public.products add constraint products_quantity_bounds_check check (min_order_quantity > 0 and (max_order_quantity is null or max_order_quantity >= min_order_quantity));

alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists sort_order integer not null default 0;
alter table public.categories add column if not exists is_active boolean not null default true;

alter table public.product_images add column if not exists media_type text not null default 'image';
alter table public.product_images add column if not exists width integer;
alter table public.product_images add column if not exists height integer;

create table if not exists public.product_relations (
  product_id bigint not null references public.products(id) on delete cascade,
  related_product_id bigint not null references public.products(id) on delete cascade,
  relation_type text not null check (relation_type in ('related','frequently_bought_together','upsell','cross_sell')),
  sort_order integer not null default 0,
  primary key (product_id, related_product_id, relation_type),
  check (product_id <> related_product_id)
);

create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_sku_idx on public.products(sku);
create index if not exists products_barcode_idx on public.products(barcode);
create index if not exists products_brand_idx on public.products(brand_id);
create index if not exists products_price_idx on public.products(selling_price);
create index if not exists products_weight_idx on public.products(weight);
create index if not exists products_dietary_idx on public.products(is_organic, is_vegetarian, is_gluten_free);
create index if not exists categories_parent_sort_idx on public.categories(parent_id, sort_order, name);
create index if not exists product_relations_product_idx on public.product_relations(product_id, relation_type, sort_order);

alter table public.product_relations enable row level security;
drop policy if exists "catalog relations are public" on public.product_relations;
create policy "catalog relations are public" on public.product_relations for select using (true);

create or replace function public.search_catalog(
  p_query text default null,
  p_category_id bigint default null,
  p_brand_id bigint default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_weight numeric default null,
  p_max_weight numeric default null,
  p_min_rating numeric default null,
  p_in_stock boolean default false,
  p_organic boolean default null,
  p_vegetarian boolean default null,
  p_gluten_free boolean default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns setof public.products
language sql stable security invoker set search_path = public
as $$
  select p.* from public.products p
  left join public.inventory i on i.product_id = p.id
  where p.is_active
    and (p_query is null or trim(p_query) = '' or p.search_vector @@ websearch_to_tsquery('simple', p_query) or p.name ilike '%' || trim(p_query) || '%' or p.sku ilike '%' || trim(p_query) || '%' or p.barcode ilike '%' || trim(p_query) || '%' or similarity(p.name, trim(p_query)) >= 0.25)
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_brand_id is null or p.brand_id = p_brand_id)
    and (p_min_price is null or p.selling_price >= p_min_price)
    and (p_max_price is null or p.selling_price <= p_max_price)
    and (p_min_weight is null or p.weight >= p_min_weight)
    and (p_max_weight is null or p.weight <= p_max_weight)
    and (p_min_rating is null or p.rating >= p_min_rating)
    and (not p_in_stock or coalesce(i.current_stock, 0) > 0)
    and (p_organic is null or p.is_organic = p_organic)
    and (p_vegetarian is null or p.is_vegetarian = p_vegetarian)
    and (p_gluten_free is null or p.is_gluten_free = p_gluten_free)
  order by case when p_query is null or trim(p_query) = '' then 0 else similarity(p.name, trim(p_query)) end desc, p.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;
grant execute on function public.search_catalog(text,bigint,bigint,numeric,numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,integer,integer) to anon, authenticated;

-- Seed one representative row for each supported product type when the base catalog has products.
update public.products set product_type = 'simple' where product_type is null or product_type = '';
with ranked as (select id, row_number() over (order by id) as position from public.products)
update public.products p set product_type = case ranked.position when 1 then 'simple' when 2 then 'variable' when 3 then 'loose_weight' when 4 then 'combo' when 5 then 'subscription' when 6 then 'gift_pack' else p.product_type end from ranked where p.id = ranked.id and ranked.position <= 6;
insert into public.product_variants(product_id, name, sku, price, weight, stock)
select p.id, 'Standard', p.sku || '-STD', p.selling_price, p.weight, coalesce(i.current_stock, 0)
from public.products p left join public.inventory i on i.product_id = p.id
where p.product_type = 'variable' and not exists (select 1 from public.product_variants v where v.product_id = p.id);
