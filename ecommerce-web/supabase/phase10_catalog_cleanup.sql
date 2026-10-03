-- Catalog cleanup for products that were seeded without categories.
-- Safe to run repeatedly.

insert into public.categories (name, slug)
values ('Stationery & art', 'stationery-art')
on conflict (slug) do update
set name = excluded.name;

update public.products
set category_id = (select id from public.categories where slug = 'personal-care')
where id in (46, 47);

update public.products
set category_id = (select id from public.categories where slug = 'stationery-art')
where id in (48, 49);
