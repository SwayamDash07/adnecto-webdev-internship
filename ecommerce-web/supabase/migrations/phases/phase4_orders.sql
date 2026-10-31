-- Phase 4: customer cancellation before fulfilment begins.

create or replace function public.customer_cancel_order(p_order_id bigint)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_status public.order_status; v_total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select status, total into v_status, v_total from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_status not in ('placed', 'accepted') then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;
  update public.orders set status = 'cancelled' where id = p_order_id;
  update public.inventory i set current_stock = i.current_stock + items.quantity,
                                warehouse_stock = i.warehouse_stock + items.quantity
  from (select product_id, sum(quantity)::integer as quantity from public.order_items where order_id = p_order_id group by product_id) items
  where i.product_id = items.product_id;
  update public.payments set status = 'refunded' where order_id = p_order_id;
  insert into public.refunds(order_id, amount, reason) values (p_order_id, v_total, 'Customer cancelled before fulfilment');
  insert into public.audit_logs(actor_id, action, table_name, row_id, payload)
  values (auth.uid(), 'order_cancelled_by_customer', 'orders', p_order_id::text, jsonb_build_object('amount', v_total));
  return true;
end;
$$;

grant execute on function public.customer_cancel_order(bigint) to authenticated;

