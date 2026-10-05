-- Correct demo-catalog identity and media mappings.
-- This migration only repairs product metadata/media relationships; it does not
-- change product IDs, prices, inventory, cart rows, or order relationships.

insert into public.brands (name, slug)
values
  ('boAt', 'boat'),
  ('Samsung', 'samsung'),
  ('IKEA', 'ikea'),
  ('Dove', 'dove'),
  ('Nike', 'nike'),
  ('Tata Sampann', 'tata-sampann')
on conflict (slug) do update set name = excluded.name;

update public.products set brand_id = (select id from public.brands where slug = 'apple'), category_id = (select id from public.categories where slug = 'electronics') where id = 1;
update public.products set brand_id = (select id from public.brands where slug = 'boat'), category_id = (select id from public.categories where slug = 'electronics') where id = 3;
update public.products set brand_id = (select id from public.brands where slug = 'philips'), category_id = (select id from public.categories where slug = 'home-appliances') where id = 4;
update public.products set brand_id = (select id from public.brands where slug = 'samsung'), category_id = (select id from public.categories where slug = 'electronics') where id = 5;
update public.products set brand_id = (select id from public.brands where slug = 'ikea'), category_id = (select id from public.categories where slug = 'home-appliances') where id = 6;
update public.products set brand_id = (select id from public.brands where slug = 'dove'), category_id = (select id from public.categories where slug = 'personal-care') where id = 7;
update public.products set brand_id = (select id from public.brands where slug = 'nike'), category_id = (select id from public.categories where slug = 'fashion') where id = 8;
update public.products set brand_id = (select id from public.brands where slug = 'tata-sampann'), category_id = (select id from public.categories where slug = 'groceries') where id = 9;

delete from public.product_images where product_id in (1, 3, 4, 5, 6, 7, 8, 9, 21);

insert into public.product_images (product_id, storage_path, alt_text, sort_order)
values
  (1, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85', 'Apple iPhone 15 128GB', 0),
  (3, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', 'boAt Rockerz 450 Bluetooth Headphones', 0),
  (4, 'https://images.philips.com/is/image/philipsconsumer/vrs_dea414b3_1cb4_4b84_9b4dcf797315caca?%24png%24=&hei=630&wid=1200', 'Philips 3000 Series Airfryer L HD9200/90 4.1L', 0),
  (5, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85', 'Samsung Galaxy Watch6', 0),
  (6, 'https://www.ikea.is/static/web/ikea4/images/760/0776004_PE757677_S5.jpg?v=4bab895f', 'IKEA FJÄLLARNIKA Light Warm Duvet 150x200cm', 0),
  (7, 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85', 'Dove Deep Moisture Body Wash 250ml', 0),
  (8, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', 'Nike Air Max SC', 0),
  (9, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=85', 'Tata Sampann Toor Dal 1kg', 0),
  (21, 'https://assets.adidas.com/images/w_600%2Cf_auto%2Cq_auto/3af9217001754805a855af3b00849bd5_9366/Tenis_Runfalcon_3_Branco_HP7546_04_standard.jpg', 'Adidas Runfalcon 3 Shoes', 0);
