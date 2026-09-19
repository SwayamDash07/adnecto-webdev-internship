-- Phase 2: live admin order queue and controlled status changes.

create or replace function public.admin_list_orders()
returns table (
  order_id bigint,
  customer_name text,
  customer_email text,
  total numeric,
  status public.order_status,
  created_at timestamptz,
  delivery_slot text,
  address_line text,
  item_count bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_role('store_manager') or public.has_role('picker') or public.has_role('accountant')) then
    raise exception 'ADMIN_ROLE_REQUIRED';
  end if;
  return query
    select o.id,
           coalesce(u.full_name, split_part(coalesce(a.email, ''), '@', 1), 'Customer'),
           coalesce(a.email, ''),
           o.total,
           o.status,
           o.created_at,
           o.delivery_slot,
           concat_ws(', ', ad.line1, ad.city, ad.postal_code),
           count(oi.id)
    from public.orders o
    left join public.users pu on pu.id = o.user_id
    left join auth.users a on a.id = o.user_id
    left join public.addresses ad on ad.id = o.address_id
    left join public.order_items oi on oi.order_id = o.id
    left join public.users u on u.id = o.user_id
    group by o.id, u.full_name, a.email, ad.line1, ad.city, ad.postal_code
    order by o.created_at desc;
end;
$$;

create or replace function public.admin_update_order_status(p_order_id bigint, p_status public.order_status)
returns public.order_status
language plpgsql security definer set search_path = public
as $$
declare v_status public.order_status;
begin
  if not public.has_role('store_manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
  update public.orders set status = p_status where id = p_order_id returning status into v_status;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id, action, table_name, row_id, payload)
  values (auth.uid(), 'order_status_updated', 'orders', p_order_id::text, jsonb_build_object('status', p_status::text));
  return v_status;
end;
$$;

grant execute on function public.admin_list_orders() to authenticated;
grant execute on function public.admin_update_order_status(bigint, public.order_status) to authenticated;
