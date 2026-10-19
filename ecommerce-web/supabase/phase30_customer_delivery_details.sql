-- Expose only the customer's checkout instructions and preferences in the
-- delivery queue. Staff-entered delivery notes and proof URLs are not customer data.

drop function if exists public.admin_list_fulfilment_orders(text);

create function public.admin_list_fulfilment_orders(p_queue text default 'all')
returns table(
  order_id bigint,
  customer_name text,
  total numeric,
  status public.order_status,
  delivery_slot text,
  delivery_slot_start timestamptz,
  delivery_slot_end timestamptz,
  delivered_at timestamptz,
  address_line text,
  item_count bigint,
  delivery_instructions text,
  contactless_delivery boolean,
  substitute_unavailable boolean
)
language plpgsql security definer set search_path=public as $$
begin
  if p_queue='all' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='picker' and not public.current_role_has_permission('picker:use') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue='delivery' and not public.current_role_has_permission('delivery:manage') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_queue not in ('all','picker','delivery') then raise exception 'INVALID_FULFILMENT_QUEUE'; end if;
  return query
    select o.id::bigint,
      coalesce(nullif(u.full_name::text,''),'Customer')::text,
      case when public.current_role()='picker' then null else o.total end,
      o.status,
      o.delivery_slot::text,
      o.delivery_slot_start,
      o.delivery_slot_end,
      o.delivered_at,
      concat_ws(', ',ad.line1,ad.city,ad.postal_code)::text,
      count(oi.id)::bigint,
      coalesce(nullif(btrim(o.delivery_instructions),''),nullif(btrim(ad.delivery_instructions),''))::text,
      coalesce(o.contactless_delivery,false),
      coalesce(o.substitute_unavailable,false)
    from public.orders o
    left join public.users u on u.id=o.user_id
    left join public.addresses ad on ad.id=o.address_id
    left join public.order_items oi on oi.order_id=o.id
    where (p_queue='all'
      or (p_queue='picker' and o.status in ('accepted','picking'))
      or (p_queue='delivery' and o.status in ('packed','out_for_delivery')))
    group by o.id,u.full_name,ad.line1,ad.city,ad.postal_code,ad.delivery_instructions
    order by o.delivery_slot_start nulls last,o.created_at desc;
end $$;

grant execute on function public.admin_list_fulfilment_orders(text) to authenticated;
revoke all on function public.admin_list_fulfilment_orders(text) from public, anon;

notify pgrst, 'reload schema';
