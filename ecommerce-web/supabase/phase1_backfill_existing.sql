-- Repairs an existing catalogue whose products already exist but have
-- NULL category_id / brand_id values. This does not create duplicate products
-- and does not overwrite current stock.

insert into public.categories (name, slug)
values
  ('Groceries', 'groceries'),
  ('Electronics', 'electronics'),
  ('Personal care', 'personal-care'),
  ('Home appliances', 'home-appliances'),
  ('Fashion', 'fashion'),
  ('Sports', 'sports')
on conflict (slug) do update set name = excluded.name;

insert into public.brands (name, slug)
values
  ('Soundcore', 'soundcore'),
  ('AeroFlex', 'aeroflex'),
  ('SmartBrew', 'smartbrew'),
  ('NovaFit', 'novafit'),
  ('Linen Lane', 'linen-lane'),
  ('Glow Theory', 'glow-theory'),
  ('UrbanTrail', 'urbantrail'),
  ('Daily Harvest', 'daily-harvest')
on conflict (slug) do update set name = excluded.name;

with mapping(product_name, brand_slug, category_slug) as (
  values
    ('Soundcore Life Q30 Hybrid Headphones', 'soundcore', 'electronics'),
    ('AeroFlex Everyday Sneakers', 'aeroflex', 'fashion'),
    ('SmartBrew 1.5L Coffee Maker', 'smartbrew', 'home-appliances'),
    ('NovaFit Active Smartwatch', 'novafit', 'electronics'),
    ('Linen Lane Textured Throw', 'linen-lane', 'home-appliances'),
    ('Glow Theory Skin Essentials Kit', 'glow-theory', 'personal-care'),
    ('UrbanTrail Gym Duffel Bag', 'urbantrail', 'sports'),
    ('Daily Harvest Pantry Box', 'daily-harvest', 'groceries')
)
update public.products p
set category_id = c.id,
    brand_id = b.id
from mapping m
join public.categories c on c.slug = m.category_slug
join public.brands b on b.slug = m.brand_slug
where lower(trim(p.name)) = lower(trim(m.product_name));

-- Add only missing inventory rows. Existing stock is preserved.
insert into public.inventory (product_id, current_stock, reserved_stock, warehouse_stock, reorder_level)
select p.id, 0, 0, 0, 5
from public.products p
left join public.inventory i on i.product_id = p.id
where i.product_id is null;

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "catalog categories are public" on public.categories;
create policy "catalog categories are public" on public.categories for select using (true);
drop policy if exists "catalog brands are public" on public.brands;
create policy "catalog brands are public" on public.brands for select using (true);
drop policy if exists "catalog images are public" on public.product_images;
create policy "catalog images are public" on public.product_images for select using (true);
