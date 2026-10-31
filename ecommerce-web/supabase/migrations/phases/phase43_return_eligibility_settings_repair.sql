-- Repair customer return eligibility when the settings row is missing.
-- A missing window previously caused NULL eligibility results and a generic UI message.
begin;

insert into public.returns_settings(
  id, return_window_days, refund_eta, auto_approve_max_amount,
  auto_approve_reasons, max_open_requests_per_customer,
  pickup_reschedules_allowed, request_sla_hours, attachments_enabled
)
values(
  true, 7, '5-7 business days', 5000,
  array['changed my mind','wrong item','damaged or defective','not as described'],
  5, 1, 24, false
)
on conflict (id) do nothing;

create or replace function public.get_return_eligibility(p_order_id bigint default null)
returns table(
  order_item_id bigint,
  product_id bigint,
  ordered_quantity integer,
  refundable_quantity integer,
  return_possible boolean,
  refund_only_possible boolean,
  deadline timestamptz,
  reason_code text
)
language plpgsql stable security definer set search_path=public as $$
declare
  o public.orders%rowtype;
  payment_method text;
  payment_status text;
  window_days integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found or (o.user_id<>auth.uid() and not public.current_role_has_permission('refunds:view')) then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  select method,status into payment_method,payment_status
    from public.payments where order_id=p_order_id order by id desc limit 1;
  select coalesce((select s.return_window_days from public.returns_settings s where s.id=true),7)
    into window_days;

  return query
  select oi.id, oi.product_id, oi.quantity,
    greatest(0, oi.quantity-coalesce((
      select sum(ri.quantity)::integer from public.refund_items ri
      join public.refunds rf on rf.id=ri.refund_id
      where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')
    ),0)),
    (coalesce(pr.is_returnable,true)
      and o.status='delivered' and o.delivered_at is not null
      and o.delivered_at<=now() and o.delivered_at>=now()-make_interval(days=>window_days)
      and lower(coalesce(payment_status,'')) in ('paid','captured','succeeded','completed')
      and oi.quantity>coalesce((
        select sum(ri.quantity)::integer from public.refund_items ri
        join public.refunds rf on rf.id=ri.refund_id
        where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')
      ),0)),
    (o.status='delivered' and o.delivered_at is not null
      and o.delivered_at<=now() and o.delivered_at>=now()-make_interval(days=>window_days)
      and lower(coalesce(payment_status,'')) in ('paid','captured','succeeded','completed')
      and oi.quantity>coalesce((
        select sum(ri.quantity)::integer from public.refund_items ri
        join public.refunds rf on rf.id=ri.refund_id
        where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')
      ),0)),
    o.delivered_at+make_interval(days=>window_days),
    case
      when o.status<>'delivered' then 'not_delivered'
      when o.delivered_at is null or o.delivered_at>now()
        or o.delivered_at<now()-make_interval(days=>window_days) then 'window_closed'
      when lower(coalesce(payment_status,'')) not in ('paid','captured','succeeded','completed') then 'not_paid'
      when oi.quantity<=coalesce((
        select sum(ri.quantity)::integer from public.refund_items ri
        join public.refunds rf on rf.id=ri.refund_id
        where ri.order_item_id=oi.id and rf.status not in ('rejected','cancelled')
      ),0) then 'already_requested'
      when not coalesce(pr.is_returnable,true) then 'not_returnable'
      else null
    end
  from public.order_items oi
  join public.products pr on pr.id=oi.product_id
  where oi.order_id=p_order_id
  order by oi.id;
end;
$$;

revoke all on function public.get_return_eligibility(bigint) from public, anon;
grant execute on function public.get_return_eligibility(bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
