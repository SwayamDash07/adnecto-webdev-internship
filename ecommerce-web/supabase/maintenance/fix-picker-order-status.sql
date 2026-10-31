-- Allow the existing role-checked delivery/picker RPC to update orders.
-- The previous security-invoker function was blocked by the orders UPDATE
-- policy, causing valid picker order IDs to surface as ORDER_NOT_FOUND.

create or replace function public.admin_update_delivery_details(
  p_order_id bigint,
  p_status public.order_status default null,
  p_assigned_to uuid default null,
  p_delivery_notes text default null,
  p_proof_of_delivery_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role('delivery_boy') or public.has_role('picker') or public.has_role('store_manager') or public.has_role('super_admin')) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  update public.orders
  set status = coalesce(p_status, status),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      delivery_notes = coalesce(p_delivery_notes, delivery_notes),
      proof_of_delivery_url = coalesce(p_proof_of_delivery_url, proof_of_delivery_url)
  where id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
end;
$$;

grant execute on function public.admin_update_delivery_details(bigint, public.order_status, uuid, text, text) to authenticated;
