-- Phase 1 catalog seed and read policies.
-- Run schema.sql first, then this file in the Supabase SQL Editor.

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

with seed(name, sku, barcode, brand_slug, category_slug, description, mrp, selling_price, gst, hsn, rating, review_count, country_of_origin, attributes) as (
  values
    ('Soundcore Life Q30 Hybrid Headphones', 'AUD-Q30-BLK', '0194649001234', 'soundcore', 'electronics', 'Hybrid active noise cancellation, 40-hour battery life and multipoint Bluetooth connection.', 9999, 6999, 18, '85183000', 4.7, 1842, 'Imported', '{"badge":"Best seller","color":"blue","emoji":"🎧","material":"ABS plastic, protein leather ear cushions","warranty":"18 months manufacturer warranty","highlights":["Hybrid active noise cancellation","40-hour battery life","Multipoint Bluetooth"]}'::jsonb),
    ('AeroFlex Everyday Sneakers', 'FASH-AERO-01', '8901000000001', 'aeroflex', 'fashion', 'Lightweight everyday sneakers with a breathable mesh upper and cushioned rubber sole.', 3499, 1899, 18, '64041100', 4.5, 892, 'India', '{"badge":"32% off","color":"sand","emoji":"👟","material":"Mesh upper with rubber sole","warranty":"30-day manufacturing defect cover","highlights":["Lightweight cushioning","Breathable upper","Everyday walking fit"]}'::jsonb),
    ('SmartBrew 1.5L Coffee Maker', 'HOM-SBREW-15', '8901000000002', 'smartbrew', 'home-appliances', 'A 1.5 litre drip coffee maker with reusable filter, keep-warm plate and clear water tank.', 4299, 2499, 18, '85167100', 4.6, 611, 'India', '{"badge":"Deal of the day","color":"mint","emoji":"☕","material":"BPA-free plastic and stainless steel heating plate","warranty":"1 year manufacturer warranty","highlights":["1.5 litre capacity","Auto keep-warm function","Reusable filter"]}'::jsonb),
    ('NovaFit Active Smartwatch', 'ELEC-NOVA-01', '8901000000003', 'novafit', 'electronics', 'Activity and heart-rate tracking smartwatch with a water-resistant case and silicone strap.', 5999, 3299, 18, '91021200', 4.3, 1204, 'Imported', '{"badge":"Limited time","color":"violet","emoji":"⌚","material":"Aluminium case with silicone strap","warranty":"12 months manufacturer warranty","highlights":["Activity tracking","Heart-rate monitoring","Water resistant design"]}'::jsonb),
    ('Linen Lane Textured Throw', 'HOM-LINEN-01', '8901000000004', 'linen-lane', 'home-appliances', 'A 130 cm by 170 cm oatmeal linen throw with a soft woven texture and fringed edge.', 1299, 799, 5, '63012000', 4.8, 344, 'India', '{"badge":"Popular","color":"peach","emoji":"🧺","material":"Cotton and linen blend","warranty":"30-day quality guarantee","highlights":["Machine washable","Soft textured finish","130 cm by 170 cm"]}'::jsonb),
    ('Glow Theory Skin Essentials Kit', 'PER-GLOW-03', '8901000000005', 'glow-theory', 'personal-care', 'A three-piece daily skincare kit containing cleanser, niacinamide serum and moisturiser for a simple morning and evening routine.', 1999, 1299, 18, '33049990', 4.4, 456, 'India', '{"badge":"New arrival","color":"rose","emoji":"🧴","material":"Dermatologically tested skincare formulas","expiry":"See package for batch-specific expiry","packSize":"3 piece kit","highlights":["Cleanser","Niacinamide serum","Moisturiser"]}'::jsonb),
    ('UrbanTrail Gym Duffel Bag', 'SPO-UTRAIL-45', '8901000000006', 'urbantrail', 'sports', 'A 45 litre water-resistant gym duffel with a separate shoe compartment and adjustable shoulder strap.', 1599, 999, 18, '42029200', 4.6, 283, 'India', '{"badge":"Top rated","color":"green","emoji":"🎒","material":"Water-resistant polyester","warranty":"6 months against manufacturing defects","highlights":["Separate shoe compartment","Adjustable shoulder strap","45 litre capacity"]}'::jsonb),
    ('Daily Harvest Pantry Box', 'GRC-PANTRY-01', '8901234567890', 'daily-harvest', 'groceries', 'A standard pantry box with rice, lentils, oats, canned vegetables, pasta and cooking oil. Packed for everyday meals.', 799, 649, 5, '19059090', 4.2, 98, 'India', '{"badge":"Value pack","color":"yellow","emoji":"🥫","expiry":"Minimum 30 days shelf life at delivery","packSize":"Standard box","highlights":["Rice","Lentils","Oats","Canned vegetables","Pasta","Cooking oil"]}'::jsonb)
)
insert into public.products (name, sku, barcode, brand_id, category_id, description, mrp, selling_price, gst, hsn, rating, review_count, country_of_origin, attributes)
select s.name, s.sku, s.barcode, b.id, c.id, s.description, s.mrp, s.selling_price, s.gst, s.hsn, s.rating, s.review_count, s.country_of_origin, s.attributes
from seed s
join public.brands b on b.slug = s.brand_slug
join public.categories c on c.slug = s.category_slug
on conflict (sku) do update set
  name = excluded.name, barcode = excluded.barcode, brand_id = excluded.brand_id,
  category_id = excluded.category_id, description = excluded.description,
  mrp = excluded.mrp, selling_price = excluded.selling_price, gst = excluded.gst,
  hsn = excluded.hsn, rating = excluded.rating, review_count = excluded.review_count,
  country_of_origin = excluded.country_of_origin, attributes = excluded.attributes;

insert into public.inventory (product_id, current_stock, reserved_stock, warehouse_stock, reorder_level)
select p.id, v.stock, 0, v.stock, 5
from (values
  ('AUD-Q30-BLK', 42), ('FASH-AERO-01', 68), ('HOM-SBREW-15', 25), ('ELEC-NOVA-01', 15),
  ('HOM-LINEN-01', 91), ('PER-GLOW-03', 33), ('SPO-UTRAIL-45', 54), ('GRC-PANTRY-01', 120)
) v(sku, stock)
join public.products p on p.sku = v.sku
on conflict (product_id) do update set current_stock = excluded.current_stock, warehouse_stock = excluded.warehouse_stock;

insert into public.product_images (product_id, storage_path, alt_text, sort_order)
select p.id, v.image_url, p.name, v.sort_order
from (values
  ('AUD-Q30-BLK', 'https://images.unsplash.com/photo-1613629758552-443027994609?auto=format&fit=crop&w=900&q=85', 0),
  ('AUD-Q30-BLK', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', 1),
  ('FASH-AERO-01', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', 0),
  ('FASH-AERO-01', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=900&q=85', 1),
  ('HOM-SBREW-15', 'https://images.unsplash.com/photo-1710594935133-17e492868934?auto=format&fit=crop&w=900&q=85', 0),
  ('HOM-SBREW-15', 'https://images.unsplash.com/photo-1519585969732-0d3e30255220?auto=format&fit=crop&w=900&q=85', 1),
  ('ELEC-NOVA-01', 'https://images.unsplash.com/photo-1624096104992-9b4fa3a279dd?auto=format&fit=crop&w=900&q=85', 0),
  ('HOM-LINEN-01', 'https://lmhome.com.au/cdn/shop/products/t_burton_oatmeal_5cc1064e-2619-47ba-a02f-c6a070c4659b.jpg?v=1619401684&width=1600', 0),
  ('PER-GLOW-03', 'https://artisanchemist.com.au/cdn/shop/files/glow-trio-2024.jpg?v=1732001023', 0),
  ('SPO-UTRAIL-45', 'https://cdn.shopify.com/s/files/1/0156/6146/files/images-PowerHoldallGSDarkGreyI4A2J_GB7H_3013.jpg?v=1759483971', 0),
  ('GRC-PANTRY-01', 'https://images.gastronom.ru/NXaPwyc8DjG5MgyND9XFDhJtAMRC1557_ggDx_EDfnM/pr%3Aarticle-cover-image/g%3Ace/rs%3Aauto%3A0%3A0%3A0/L2Ntcy9hbGwtaW1hZ2VzLzUwMTAxYWJlLTQ0YmQtNGYyZS1hN2RjLThhMDBiM2Y2OGExNy5wbmc.webp', 0)
) v(sku, image_url, sort_order)
join public.products p on p.sku = v.sku
where not exists (select 1 from public.product_images i where i.product_id = p.id and i.storage_path = v.image_url);

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.product_images enable row level security;

drop policy if exists "catalog categories are public" on public.categories;
create policy "catalog categories are public" on public.categories for select using (true);
drop policy if exists "catalog brands are public" on public.brands;
create policy "catalog brands are public" on public.brands for select using (true);
drop policy if exists "catalog images are public" on public.product_images;
create policy "catalog images are public" on public.product_images for select using (true);
