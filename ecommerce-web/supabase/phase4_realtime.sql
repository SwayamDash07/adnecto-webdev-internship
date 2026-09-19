-- Enable Supabase Realtime for live order status updates.
-- Safe to run more than once.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['orders','order_items','inventory','products','coupons','support_tickets','purchase_orders','purchase_items','purchase_order_items','delivery_slots','banners','users','notifications'] loop
    if to_regclass('public.' || table_name) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
