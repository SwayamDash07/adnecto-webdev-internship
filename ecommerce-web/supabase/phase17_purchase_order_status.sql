begin;

alter table public.purchase_orders
  add column if not exists sent_at timestamptz,
  add column if not exists received_at timestamptz;

-- The supplier table already has an email column. Keep the established create
-- workflow, with an optional fifth argument so the form can save it when given.
drop function if exists public.admin_create_purchase_order(text, bigint, integer, numeric);
create function public.admin_create_purchase_order(
  p_supplier_name text,
  p_product_id bigint,
  p_quantity integer,
  p_unit_cost numeric,
  p_supplier_email text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id bigint;
  v_order_id bigint;
begin
  if not public.current_role_has_permission('purchase_orders:manage') then
    raise exception 'FORBIDDEN: purchase_orders:manage permission required' using errcode = '42501';
  end if;
  if nullif(trim(p_supplier_name), '') is null or p_quantity < 1 or p_unit_cost < 0 then
    raise exception 'INVALID_PURCHASE_ORDER' using errcode = '22023';
  end if;

  select s.id into v_supplier_id
  from public.suppliers as s
  where lower(s.name) = lower(trim(p_supplier_name))
  limit 1;

  if v_supplier_id is null then
    insert into public.suppliers(name, email)
      values(trim(p_supplier_name), nullif(trim(p_supplier_email), ''))
      returning id into v_supplier_id;
  elsif nullif(trim(p_supplier_email), '') is not null then
    update public.suppliers
      set email = nullif(trim(p_supplier_email), '')
      where id = v_supplier_id;
  end if;

  insert into public.purchase_orders(supplier_id, status)
    values(v_supplier_id, 'draft') returning id into v_order_id;
  insert into public.purchase_items(purchase_order_id, product_id, quantity, unit_cost)
    values(v_order_id, p_product_id, p_quantity, p_unit_cost);
  return v_order_id;
end;
$$;
revoke all on function public.admin_create_purchase_order(text, bigint, integer, numeric, text) from public;
grant execute on function public.admin_create_purchase_order(text, bigint, integer, numeric, text) to authenticated;

create or replace function public.set_purchase_order_status(po_id bigint, new_status text)
returns table(purchase_order_id bigint, status text, sent_at timestamptz, received_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_now timestamptz := now();
begin
  if not public.current_role_has_permission('purchase_orders:manage') then
    raise exception 'FORBIDDEN: purchase_orders:manage permission required' using errcode = '42501';
  end if;

  select po.* into v_order
  from public.purchase_orders as po
  where po.id = $1
  for update;

  if not found then
    raise exception 'PURCHASE_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotent retry: return the existing result without applying the transition twice.
  if v_order.status = $2 then
    return query select v_order.id, v_order.status, v_order.sent_at, v_order.received_at;
    return;
  end if;

  if v_order.status = 'draft' and $2 = 'ordered' then
    update public.purchase_orders as po
      set status = 'ordered', sent_at = coalesce(po.sent_at, v_now)
      where po.id = $1
      returning po.* into v_order;
  elsif v_order.status = 'ordered' and $2 = 'received' then
    update public.purchase_orders as po
      set status = 'received', received_at = coalesce(po.received_at, v_now)
      where po.id = $1
      returning po.* into v_order;
  else
    raise exception 'INVALID_PURCHASE_ORDER_TRANSITION: % -> %', v_order.status, $2
      using errcode = '22023';
  end if;

  return query select v_order.id, v_order.status, v_order.sent_at, v_order.received_at;
end;
$$;

revoke all on function public.set_purchase_order_status(bigint, text) from public;
grant execute on function public.set_purchase_order_status(bigint, text) to authenticated;

-- Extend the existing queue response with the information needed for the email
-- preview and persisted sent/received dates. PO creation currently supports one
-- item, while string_agg also keeps the display safe if the model gains more.
drop function if exists public.admin_list_purchase_orders();
create function public.admin_list_purchase_orders()
returns table(
  purchase_order_id bigint,
  supplier_name text,
  status text,
  created_at timestamptz,
  item_count bigint,
  quantity bigint,
  supplier_email text,
  product_summary text,
  sent_at timestamptz,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_role_has_permission('purchase_orders:manage') then
    raise exception 'FORBIDDEN: purchase_orders:manage permission required' using errcode = '42501';
  end if;

  return query
    select po.id,
      coalesce(s.name, 'Unassigned supplier')::text,
      po.status::text,
      po.created_at,
      count(pi.id)::bigint,
      coalesce(sum(pi.quantity), 0)::bigint,
      s.email::text,
      string_agg(format('%s (SKU %s) x %s', p.name, coalesce(p.sku, '—'), pi.quantity), E'\n- ' order by pi.id)::text,
      po.sent_at,
      po.received_at
    from public.purchase_orders as po
    left join public.suppliers as s on s.id = po.supplier_id
    left join public.purchase_items as pi on pi.purchase_order_id = po.id
    left join public.products as p on p.id = pi.product_id
    group by po.id, s.name, s.email
    order by po.created_at desc;
end;
$$;
grant execute on function public.admin_list_purchase_orders() to authenticated;

commit;
