-- Razorpay test-mode payment metadata and secure capture confirmation.
alter table public.payments add column if not exists gateway_order_id text;
alter table public.payments add column if not exists gateway_payment_id text;
alter table public.payments add column if not exists gateway_signature text;

create or replace function public.customer_mark_payment_captured(
  p_order_id bigint,
  p_gateway_order_id text,
  p_gateway_payment_id text,
  p_gateway_signature text
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.payments p
  set status = 'captured', gateway_order_id = p_gateway_order_id,
      gateway_payment_id = p_gateway_payment_id, gateway_signature = p_gateway_signature
  from public.orders o
  where p.order_id = p_order_id and o.id = p.order_id and o.user_id = auth.uid();
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  return true;
end;
$$;

grant execute on function public.customer_mark_payment_captured(bigint,text,text,text) to authenticated;

create or replace function public.customer_set_gateway_order(p_order_id bigint, p_gateway_order_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.payments p set gateway_order_id = p_gateway_order_id
  from public.orders o where p.order_id = p_order_id and o.id = p.order_id and o.user_id = auth.uid();
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  return true;
end;
$$;

grant execute on function public.customer_set_gateway_order(bigint,text) to authenticated;

create or replace function public.system_mark_payment_failed(p_gateway_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order_id bigint;
begin
  select p.order_id into v_order_id from public.payments p where p.gateway_order_id = p_gateway_order_id and p.status = 'pending' for update;
  if v_order_id is null then return; end if;
  update public.payments set status = 'failed' where order_id = v_order_id;
  update public.orders set status = 'cancelled' where id = v_order_id and status = 'placed';
  update public.inventory i set current_stock = i.current_stock + items.quantity,
                                warehouse_stock = i.warehouse_stock + items.quantity
  from (select product_id, sum(quantity)::integer quantity from public.order_items where order_id = v_order_id group by product_id) items
  where i.product_id = items.product_id;
end;
$$;

grant execute on function public.system_mark_payment_failed(text) to service_role;
