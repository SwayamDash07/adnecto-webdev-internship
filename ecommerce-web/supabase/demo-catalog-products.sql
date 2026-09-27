-- Reproducible demo catalog update. Product IDs stay unchanged so existing
-- inventory, cart and order relationships are preserved.

update public.products set
  name = 'Apple iPhone 15 128GB', sku = 'DEMO-IPHONE15-128',
  description = 'A demo listing for Apple iPhone 15 with 128GB storage.',
  mrp = 69900, selling_price = 61999, rating = 4.7, review_count = 1842,
  gst = 18, hsn = '85171300', attributes = jsonb_build_object('badge', 'Popular choice')
where id = 1;

update public.products set
  name = 'boAt Rockerz 450 Bluetooth Headphones', sku = 'DEMO-BOAT-R450',
  description = 'A demo listing for boAt Rockerz 450 wireless headphones.',
  mrp = 2990, selling_price = 1499, rating = 4.5, review_count = 892,
  gst = 18, hsn = '85183000', attributes = jsonb_build_object('badge', 'Best seller')
where id = 3;

update public.products set
  name = 'Philips 3000 Series Airfryer L HD9200/90 4.1L', sku = 'DEMO-PHILIPS-AF41',
  description = 'A demo listing for the Philips 3000 Series Airfryer L HD9200/90 with 4.1 litre capacity.',
  mrp = 9995, selling_price = 7499, rating = 4.6, review_count = 611,
  gst = 18, hsn = '85166000', attributes = jsonb_build_object('badge', 'Top rated')
where id = 4;

update public.products set
  name = 'Samsung Galaxy Watch6', sku = 'DEMO-GALAXY-W6',
  description = 'A demo listing for Samsung Galaxy Watch6.',
  mrp = 33999, selling_price = 24999, rating = 4.3, review_count = 1204,
  gst = 18, hsn = '91021200', attributes = jsonb_build_object('badge', 'New arrival')
where id = 5;

update public.products set
  name = 'IKEA FJÄLLARNIKA Light Warm Duvet 150x200cm', sku = 'DEMO-IKEA-FJALLARNIKA',
  description = 'A demo listing for the IKEA FJÄLLARNIKA light warm duvet, 150x200cm.',
  mrp = 999, selling_price = 699, rating = 4.8, review_count = 344,
  gst = 12, hsn = '94049099', attributes = jsonb_build_object('badge', 'Popular choice')
where id = 6;

update public.products set
  name = 'Dove Deep Moisture Body Wash 250ml', sku = 'DEMO-DOVE-BW250',
  description = 'A demo listing for Dove Deep Moisture body wash.',
  mrp = 299, selling_price = 239, rating = 4.4, review_count = 456,
  gst = 18, hsn = '34013000', attributes = jsonb_build_object('badge', 'Everyday essential')
where id = 7;

update public.products set
  name = 'Nike Air Max SC', sku = 'DEMO-NIKE-AIRMAXSC',
  description = 'A demo listing for Nike Air Max SC sneakers.',
  mrp = 8995, selling_price = 6995, rating = 4.6, review_count = 283,
  gst = 18, hsn = '64041100', attributes = jsonb_build_object('badge', 'Trending')
where id = 8;

update public.products set
  name = 'Tata Sampann Toor Dal 1kg', sku = 'DEMO-TATA-TOOR1K',
  description = 'A demo listing for Tata Sampann Toor Dal.',
  mrp = 199, selling_price = 169, rating = 4.2, review_count = 98,
  gst = 5, hsn = '07136000', attributes = jsonb_build_object('badge', 'Value pick')
where id = 9;

delete from public.product_images where product_id in (1, 3, 4, 5, 6, 7, 8, 9);

insert into public.product_images (product_id, image_url, sort_order) values
  (1, 'https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=900&q=85', 0),
  (3, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', 0),
  (4, 'https://images.philips.com/is/image/philipsconsumer/vrs_dea414b3_1cb4_4b84_9b4dcf797315caca?%24png%24=&hei=630&wid=1200', 0),
  (5, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85', 0),
  (6, 'https://www.ikea.is/static/web/ikea4/images/760/0776004_PE757677_S5.jpg?v=4bab895f', 0),
  (7, 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85', 0),
  (8, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', 0),
  (9, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=85', 0);
