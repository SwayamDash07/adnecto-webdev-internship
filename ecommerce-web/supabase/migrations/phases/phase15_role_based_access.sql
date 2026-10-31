-- Role-based access controls. Apply after phase14_late_orders_complaints.sql.
-- Roles are resolved from public.users/public.roles on every call; no JWT role claims are trusted.

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select r.name::text from public.users u join public.roles r on r.id = u.role_id where u.id = auth.uid() limit 1
$$;
revoke all on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated;

create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.current_role()
    when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send')
    when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view')
    when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
    else false end
$$;
revoke all on function public.current_role_has_permission(text) from public, anon;
grant execute on function public.current_role_has_permission(text) to authenticated;

-- Prevent direct table writes from bypassing permission-specific RPC checks.
revoke insert, update, delete on public.products, public.coupons, public.inventory from anon, authenticated;
revoke insert, delete on public.users from anon, authenticated;
drop policy if exists "rbac users self or main admin read" on public.users;
create policy "rbac users self or main admin read" on public.users as restrictive for select to authenticated
  using (id = auth.uid() or public.current_role_has_permission('team:manage'));
create or replace function public.enforce_user_role_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_main_role integer; v_count integer;
begin
  select id into v_main_role from public.roles where name::text='super_admin';
  if tg_op='DELETE' then
    if old.role_id=v_main_role then
      perform pg_advisory_xact_lock(hashtext('cartly-main-admin-count'));
      select count(*) into v_count from public.users where role_id=v_main_role;
      if v_count<=1 then raise exception 'LAST_SUPER_ADMIN' using errcode='23514'; end if;
    end if;
    return old;
  elsif tg_op='UPDATE' and new.role_id is distinct from old.role_id then
    if auth.uid() is not null and public.current_role() is distinct from 'super_admin' then raise exception 'FORBIDDEN_ROLE_CHANGE' using errcode='42501'; end if;
    if old.role_id=v_main_role and new.role_id is distinct from old.role_id then
      perform pg_advisory_xact_lock(hashtext('cartly-main-admin-count'));
      select count(*) into v_count from public.users where role_id=v_main_role;
      if v_count<=1 then raise exception 'LAST_SUPER_ADMIN' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rbac_user_role_guard on public.users;
create trigger rbac_user_role_guard before update of role_id on public.users for each row execute function public.enforce_user_role_change();
drop trigger if exists rbac_user_delete_guard on public.users;
create trigger rbac_user_delete_guard before delete on public.users for each row execute function public.enforce_user_role_change();
drop policy if exists "rbac orders role scoped read" on public.orders;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "staff can read orders" on public.orders;
create policy "rbac orders role scoped read" on public.orders for select to authenticated
  using (user_id = auth.uid() or (public.current_role_has_permission('orders:view') and (public.current_role() <> 'picker' or status in ('accepted','picking'))));
drop policy if exists "rbac order items role scoped read" on public.order_items;
drop policy if exists "customers read own order items" on public.order_items;
create policy "rbac order items role scoped read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or (public.current_role_has_permission('orders:view') and (public.current_role() <> 'picker' or o.status in ('accepted','picking'))))));

-- Status writes are guarded even when made through SECURITY DEFINER functions.
create or replace function public.enforce_order_status_permission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := public.current_role();
begin
  if new.status is not distinct from old.status or auth.uid() is null then return new; end if;
  if v_role = 'picker' then
    if old.status <> 'picking' or new.status <> 'packed' then raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode = '42501'; end if;
  elsif v_role = 'store_manager' or v_role = 'super_admin' then
    if not ((old.status = 'placed' and new.status in ('accepted','cancelled')) or
      (old.status = 'accepted' and new.status in ('picking','cancelled')) or
      (old.status = 'picking' and new.status = 'packed') or
      (old.status = 'packed' and new.status = 'out_for_delivery') or
      (old.status = 'out_for_delivery' and new.status = 'delivered') or
      (old.status = 'delivered' and new.status = 'returned') or
      (new.status = 'refunded' and old.status in ('cancelled','returned'))) then
      raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023';
    end if;
  else
    raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rbac_order_status_guard on public.orders;
create trigger rbac_order_status_guard before update of status on public.orders for each row execute function public.enforce_order_status_permission();

create or replace function public.admin_update_order_status(p_order_id bigint, p_status public.order_status)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare v_old public.order_status; v_new public.order_status;
begin
  if not public.current_role_has_permission('orders:update_status') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select status into v_old from public.orders where id=p_order_id for update;
  if v_old is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if public.current_role()='picker' and not (v_old='picking' and p_status='packed') then raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode='42501'; end if;
  update public.orders set status=p_status, cancelled_at=case when p_status='cancelled' then coalesce(cancelled_at,now()) else cancelled_at end where id=p_order_id returning status into v_new;
  if p_status in ('cancelled','returned','refunded') then perform public.restore_order_stock(p_order_id); end if;
  insert into public.audit_logs(actor_id,action,table_name,row_id,payload) values(auth.uid(),'order_status_updated','orders',p_order_id::text,jsonb_build_object('from',v_old::text,'to',p_status::text));
  return v_new;
end $$;
grant execute on function public.admin_update_order_status(bigint, public.order_status) to authenticated;

-- An RPC view scopes picker order visibility to work-in-progress statuses.
create or replace function public.admin_list_orders()
returns table(order_id bigint, customer_name text, customer_email text, total numeric, status public.order_status, created_at timestamptz, delivery_slot text, address_line text, item_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.current_role_has_permission('orders:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select o.id, coalesce(u.full_name,split_part(coalesce(a.email,''),'@',1),'Customer')::text,
    coalesce(a.email,'')::text, case when public.current_role()='picker' then null else o.total end,
    o.status,o.created_at,o.delivery_slot,concat_ws(', ',ad.line1,ad.city,ad.postal_code),count(oi.id)::bigint
  from public.orders o left join public.users u on u.id=o.user_id left join auth.users a on a.id=o.user_id
  left join public.addresses ad on ad.id=o.address_id left join public.order_items oi on oi.order_id=o.id
  where public.current_role()<>'picker' or o.status in ('accepted','picking')
  group by o.id,u.full_name,a.email,ad.line1,ad.city,ad.postal_code
  order by o.created_at desc;
end $$;
grant execute on function public.admin_list_orders() to authenticated;

-- Product row guard: managers may edit descriptive fields, but cannot create, disable, or alter price/MRP.
create or replace function public.enforce_product_permission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text := public.current_role();
begin
  if auth.uid() is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='INSERT' then
    if coalesce(v_role,'') <> 'super_admin' then raise exception 'FORBIDDEN_PRODUCT_CREATE' using errcode='42501'; end if;
  elsif tg_op='UPDATE' then
    if coalesce(v_role,'') not in ('super_admin','store_manager') then raise exception 'FORBIDDEN_PRODUCT_EDIT' using errcode='42501'; end if;
    if v_role='store_manager' and (new.selling_price is distinct from old.selling_price or new.mrp is distinct from old.mrp or new.is_active is distinct from old.is_active) then
      raise exception 'FORBIDDEN_PRODUCT_FIELD' using errcode='42501';
    end if;
  elsif tg_op='DELETE' and coalesce(v_role,'') <> 'super_admin' then raise exception 'FORBIDDEN_PRODUCT_DELETE' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists rbac_products_guard on public.products;
create trigger rbac_products_guard before insert or update or delete on public.products for each row execute function public.enforce_product_permission();

create or replace function public.enforce_coupon_permission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.current_role() is distinct from 'super_admin' then raise exception 'FORBIDDEN_COUPON_MANAGE' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists rbac_coupons_guard on public.coupons;
create trigger rbac_coupons_guard before insert or update or delete on public.coupons for each row execute function public.enforce_coupon_permission();

-- Narrow grants prevent direct table access; the authenticated server-side/RPC functions remain the supported path.
revoke all on function public.admin_toggle_product(bigint,boolean) from public, anon, authenticated;
grant execute on function public.admin_toggle_product(bigint,boolean) to authenticated;
create or replace function public.admin_toggle_product(p_product_id bigint,p_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('products:disable') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  update public.products set is_active=p_active where id=p_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if; return p_active;
end $$;

create or replace function public.admin_list_inventory()
returns table(product_id bigint,product_name text,sku text,current_stock integer,reserved_stock integer,reorder_level integer)
language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('inventory:view') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select p.id::bigint,p.name::text,p.sku::text,i.current_stock::integer,i.reserved_stock::integer,i.reorder_level::integer
  from public.inventory i join public.products p on p.id=i.product_id order by p.name;
end $$;

create or replace function public.admin_adjust_inventory_with_batch(p_product_id bigint,p_delta integer,p_reason text default 'Stock correction',p_batch_number text default null,p_expiry_date date default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_stock integer;
begin
  if not public.current_role_has_permission('inventory:adjust') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_delta=0 then raise exception 'INVALID_DELTA'; end if;
  update public.inventory set current_stock=current_stock+p_delta,warehouse_stock=warehouse_stock+p_delta
    where product_id=p_product_id and current_stock+p_delta>=reserved_stock returning current_stock into v_stock;
  if v_stock is null then raise exception 'INVENTORY_NOT_FOUND_OR_BELOW_RESERVED'; end if;
  if p_delta>0 then insert into public.inventory_batches(product_id,batch_number,expiry_date,quantity) values(p_product_id,coalesce(nullif(trim(p_batch_number),''),'UNBATCHED'),p_expiry_date,p_delta); end if;
  insert into public.inventory_movements(product_id,quantity,movement_type,reference_type,reference_id,batch_number,reason,actor_id)
    values(p_product_id,abs(p_delta),case when p_delta>0 then 'adjustment' else 'wastage' end,'manual_adjustment',p_product_id::text,p_batch_number,p_reason,auth.uid());
  return v_stock;
end $$;
grant execute on function public.admin_adjust_inventory_with_batch(bigint,integer,text,text,date) to authenticated;

create or replace function public.admin_adjust_inventory(p_product_id bigint,p_delta integer,p_reason text default 'Stock correction')
returns integer language plpgsql security definer set search_path=public as $$
declare v_stock integer;
begin
  if not public.current_role_has_permission('inventory:adjust') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_delta=0 then raise exception 'INVALID_DELTA'; end if;
  update public.inventory set current_stock=current_stock+p_delta,warehouse_stock=warehouse_stock+p_delta
    where product_id=p_product_id and current_stock+p_delta>=reserved_stock returning current_stock into v_stock;
  if v_stock is null then raise exception 'INVENTORY_NOT_FOUND_OR_BELOW_RESERVED'; end if;
  insert into public.audit_logs(actor_id,action,table_name,row_id,payload) values(auth.uid(),'inventory_adjusted','inventory',p_product_id::text,jsonb_build_object('delta',p_delta,'reason',coalesce(p_reason,'Stock correction'),'current_stock',v_stock));
  return v_stock;
end $$;
grant execute on function public.admin_adjust_inventory(bigint,integer,text) to authenticated;

create or replace function public.admin_update_delivery_details(p_order_id bigint,p_status public.order_status default null,p_assigned_to uuid default null,p_delivery_notes text default null,p_proof_of_delivery_url text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.current_role()='picker' then
    if p_status is distinct from 'packed'::public.order_status or p_assigned_to is not null or p_delivery_notes is not null or p_proof_of_delivery_url is not null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  elsif not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  update public.orders set status=coalesce(p_status,status),assigned_to=coalesce(p_assigned_to,assigned_to),delivery_notes=coalesce(p_delivery_notes,delivery_notes),proof_of_delivery_url=coalesce(p_proof_of_delivery_url,proof_of_delivery_url) where id=p_order_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
end $$;
grant execute on function public.admin_update_delivery_details(bigint,public.order_status,uuid,text,text) to authenticated;

create or replace function public.admin_receive_purchase(p_purchase_order_id bigint,p_product_id bigint,p_quantity integer,p_batch_number text default null,p_expiry_date date default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('purchase_orders:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_quantity<=0 then raise exception 'INVALID_QUANTITY'; end if;
  insert into public.purchase_receipts(purchase_order_id,product_id,quantity,batch_number,expiry_date,received_by) values(p_purchase_order_id,p_product_id,p_quantity,p_batch_number,p_expiry_date,auth.uid());
  insert into public.inventory_batches(product_id,batch_number,expiry_date,quantity) values(p_product_id,coalesce(p_batch_number,'UNBATCHED'),p_expiry_date,p_quantity);
  insert into public.inventory(product_id,current_stock,warehouse_stock) values(p_product_id,p_quantity,p_quantity)
    on conflict(product_id) do update set current_stock=inventory.current_stock+excluded.current_stock,warehouse_stock=inventory.warehouse_stock+excluded.warehouse_stock;
  insert into public.inventory_movements(product_id,quantity,movement_type,reference_type,reference_id,batch_number,actor_id) values(p_product_id,p_quantity,'purchase','purchase_order',p_purchase_order_id::text,p_batch_number,auth.uid());
  return true;
end $$;
grant execute on function public.admin_receive_purchase(bigint,bigint,integer,text,date) to authenticated;

create or replace function public.admin_create_purchase_order(p_supplier_name text,p_product_id bigint,p_quantity integer,p_unit_cost numeric)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_supplier_id bigint; v_order_id bigint;
begin
  if not public.current_role_has_permission('purchase_orders:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if nullif(trim(p_supplier_name),'') is null or p_quantity<1 or p_unit_cost<0 then raise exception 'INVALID_PURCHASE_ORDER'; end if;
  select id into v_supplier_id from public.suppliers where lower(name)=lower(trim(p_supplier_name)) limit 1;
  if v_supplier_id is null then insert into public.suppliers(name) values(trim(p_supplier_name)) returning id into v_supplier_id; end if;
  insert into public.purchase_orders(supplier_id,status) values(v_supplier_id,'draft') returning id into v_order_id;
  insert into public.purchase_items(purchase_order_id,product_id,quantity,unit_cost) values(v_order_id,p_product_id,p_quantity,p_unit_cost);
  return v_order_id;
end $$;
grant execute on function public.admin_create_purchase_order(text,bigint,integer,numeric) to authenticated;

create or replace function public.admin_list_purchase_orders()
returns table(purchase_order_id bigint,supplier_name text,status text,created_at timestamptz,item_count bigint)
language plpgsql security definer set search_path=public as $$
begin
  if not public.current_role_has_permission('purchase_orders:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return query select po.id,coalesce(s.name,'Unassigned supplier')::text,po.status::text,po.created_at,count(pi.id)::bigint
    from public.purchase_orders po left join public.suppliers s on s.id=po.supplier_id left join public.purchase_items pi on pi.purchase_order_id=po.id
    group by po.id,s.name order by po.created_at desc;
end $$;
grant execute on function public.admin_list_purchase_orders() to authenticated;

create or replace function public.admin_list_fulfilment_orders(p_queue text default 'all')
returns table(order_id bigint,customer_name text,total numeric,status public.order_status,delivery_slot text,address_line text,item_count bigint)
language plpgsql security definer set search_path=public as $$
begin
  if p_queue='all' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='picker' and not public.current_role_has_permission('picker:use') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='delivery' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue not in ('all','picker','delivery') then raise exception 'INVALID_FULFILMENT_QUEUE'; end if;
  return query select o.id::bigint,coalesce(nullif(u.full_name::text,''),'Customer')::text,
    case when public.current_role()='picker' then null else o.total end,o.status::public.order_status,o.delivery_slot::text,
    concat_ws(', ',ad.line1,ad.city,ad.postal_code)::text,count(oi.id)::bigint
  from public.orders o left join public.users u on u.id=o.user_id left join public.addresses ad on ad.id=o.address_id left join public.order_items oi on oi.order_id=o.id
  where (p_queue='all' or (p_queue='picker' and o.status in ('accepted','picking')) or (p_queue='delivery' and o.status in ('packed','out_for_delivery')))
  group by o.id,u.full_name,ad.line1,ad.city,ad.postal_code order by o.created_at desc;
end $$;
grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;

notify pgrst, 'reload schema';
