-- Segment 1 security hardening. Run after schema.sql and the phase migrations.
-- All statements are idempotent so this can be safely applied in CI and production.

create index if not exists addresses_user_id_idx on public.addresses(user_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists refunds_order_id_idx on public.refunds(order_id);
create index if not exists cart_user_id_idx on public.cart(user_id);
create index if not exists notifications_user_id_read_idx on public.notifications(user_id, read_at);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists users_role_id_idx on public.users(role_id);

do $$ declare table_name text; begin
  foreach table_name in array array['roles','users','addresses','categories','brands','products','product_images','product_variants','product_attributes','product_attribute_values','inventory','inventory_batches','suppliers','purchase_orders','purchase_items','orders','order_items','payments','refunds','coupons','wishlists','cart','reviews','delivery_slots','delivery_staff','notifications','wallet_transactions','reward_points','audit_logs'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Remove broad or duplicate policies before installing the least-privilege set.
drop policy if exists "catalog is public" on public.products;
drop policy if exists "catalog categories are public" on public.categories;
drop policy if exists "catalog brands are public" on public.brands;
drop policy if exists "catalog images are public" on public.product_images;
drop policy if exists "catalog inventory is public" on public.inventory;
drop policy if exists "own addresses" on public.addresses;
drop policy if exists "own orders" on public.orders;
drop policy if exists "staff can read orders" on public.orders;
drop policy if exists "own order items" on public.order_items;
drop policy if exists "own cart" on public.cart;
drop policy if exists "own wishlist" on public.wishlists;
drop policy if exists "own reviews" on public.reviews;
drop policy if exists "own notifications" on public.notifications;
drop policy if exists "own wallet" on public.wallet_transactions;
drop policy if exists "own rewards" on public.reward_points;

create policy "public can read products" on public.products for select using (true);
create policy "public can read categories" on public.categories for select using (true);
create policy "public can read brands" on public.brands for select using (true);
create policy "public can read product images" on public.product_images for select using (true);
create policy "customers manage own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers read own orders" on public.orders for select using (user_id = auth.uid() or public.has_role('store_manager') or public.has_role('accountant') or public.has_role('picker') or public.has_role('delivery_boy'));
create policy "customers read own order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role('store_manager') or public.has_role('picker') or public.has_role('delivery_boy'))));
create policy "customers manage own cart" on public.cart for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers manage own wishlist" on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers manage own reviews" on public.reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "customers update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers read own wallet" on public.wallet_transactions for select using (user_id = auth.uid());
create policy "customers read own rewards" on public.reward_points for select using (user_id = auth.uid());
create policy "staff read inventory" on public.inventory for select using (public.has_role('inventory_manager') or public.has_role('store_manager'));
create policy "staff manage inventory" on public.inventory for all using (public.has_role('inventory_manager') or public.has_role('store_manager')) with check (public.has_role('inventory_manager') or public.has_role('store_manager'));

create or replace function public.write_audit_log() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.audit_logs(actor_id, action, table_name, row_id, payload) values (auth.uid(), TG_OP, TG_TABLE_NAME, coalesce((case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'id', (case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end)->>'user_id'), jsonb_build_object('old', case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end, 'new', case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end)); return coalesce(NEW, OLD); end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['addresses','products','product_variants','inventory','orders','payments','refunds','coupons','purchase_orders','purchase_items'] loop
    execute format('drop trigger if exists audit_%I on public.%I', table_name, table_name);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit_log()', table_name, table_name);
  end loop;
end $$;

create table if not exists public.background_jobs (id bigint generated by default as identity primary key, job_type text not null, payload jsonb not null default '{}'::jsonb, status text not null default 'pending', attempts integer not null default 0, run_at timestamptz not null default now(), created_at timestamptz not null default now());
alter table public.background_jobs enable row level security;
create index if not exists background_jobs_pending_idx on public.background_jobs(status, run_at);
revoke all on public.background_jobs from anon, authenticated;
grant select, insert, update, delete on public.background_jobs to service_role;
