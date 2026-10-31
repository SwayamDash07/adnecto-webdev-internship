-- Make the public catalogue render stock and product photography.
-- Run this once in the Supabase SQL Editor.

alter table public.inventory enable row level security;
drop policy if exists "catalog inventory is public" on public.inventory;
create policy "catalog inventory is public"
  on public.inventory for select
  using (true);

alter table public.product_images enable row level security;
drop policy if exists "catalog images are public" on public.product_images;
create policy "catalog images are public"
  on public.product_images for select
  using (true);

with image_seed(product_name, image_url, sort_order) as (
  values
    ('Soundcore Life Q30 Hybrid Headphones', 'https://images.unsplash.com/photo-1613629758552-443027994609?auto=format&fit=crop&w=900&q=85', 0),
    ('AeroFlex Everyday Sneakers', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', 0),
    ('SmartBrew 1.5L Coffee Maker', 'https://images.unsplash.com/photo-1710594935133-17e492868934?auto=format&fit=crop&w=900&q=85', 0),
    ('NovaFit Active Smartwatch', 'https://images.unsplash.com/photo-1624096104992-9b4fa3a279dd?auto=format&fit=crop&w=900&q=85', 0),
    ('Linen Lane Textured Throw', 'https://lmhome.com.au/cdn/shop/products/t_burton_oatmeal_5cc1064e-2619-47ba-a02f-c6a070c4659b.jpg?v=1619401684&width=1600', 0),
    ('Glow Theory Skin Essentials Kit', 'https://artisanchemist.com.au/cdn/shop/files/glow-trio-2024.jpg?v=1732001023', 0),
    ('UrbanTrail Gym Duffel Bag', 'https://cdn.shopify.com/s/files/1/0156/6146/files/images-PowerHoldallGSDarkGreyI4A2J_GB7H_3013.jpg?v=1759483971', 0),
    ('Daily Harvest Pantry Box', 'https://images.gastronom.ru/NXaPwyc8DjG5MgyND9XFDhJtAMRC1557_ggDx_EDfnM/pr%3Aarticle-cover-image/g%3Ace/rs%3Aauto%3A0%3A0%3A0/L2Ntcy9hbGwtaW1hZ2VzLzUwMTAxYWJlLTQ0YmQtNGYyZS1hN2RjLThhMDBiM2Y2OGExNy5wbmc.webp', 0)
)
insert into public.product_images (product_id, storage_path, alt_text, sort_order)
select p.id, s.image_url, p.name, s.sort_order
from image_seed s
join public.products p on lower(trim(p.name)) = lower(trim(s.product_name))
where not exists (
  select 1
  from public.product_images pi
  where pi.product_id = p.id
    and pi.storage_path = s.image_url
);

