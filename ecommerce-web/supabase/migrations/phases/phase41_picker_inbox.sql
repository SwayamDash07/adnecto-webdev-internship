-- Automatically accept new COD orders and prepaid orders after verified capture,
-- so paid/confirmed orders flow into the picker queue without manager approval.
-- Unpaid prepaid orders stay placed and cannot be picked. Apply after phase40_returns_refunds.sql.
begin;

-- Permit only the owning customer’s guarded checkout transition when a real
-- COD payment row exists or a prepaid payment has been captured/paid.
create or replace function public.enforce_order_status_permission()
returns trigger language plpgsql security definer set search_path=public as $$
declare role_name text := public.current_role();
begin
  if new.status is not distinct from old.status or auth.uid() is null then return new; end if;

  if old.user_id = auth.uid() and old.status in ('placed', 'accepted') and new.status = 'cancelled' then
    return new;
  end if;

  if old.user_id = auth.uid()
    and old.status = 'placed'
    and new.status = 'accepted'
    and exists (
      select 1 from public.payments p
      where p.order_id = old.id
        and (
          lower(p.method) in ('cod', 'cash on delivery')
          or (lower(p.method) not in ('cod', 'cash on delivery') and lower(p.status) in ('captured', 'paid'))
        )
    ) then
    return new;
  end if;

  if role_name = 'picker' then
    if old.status <> 'picking' or new.status <> 'packed' then raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode='42501'; end if;
  elsif role_name in ('store_manager', 'super_admin', 'admin') then
    if not ((old.status = 'placed' and new.status in ('accepted', 'cancelled'))
      or (old.status = 'accepted' and new.status in ('picking', 'cancelled'))
      or (old.status = 'picking' and new.status = 'packed')
      or (old.status = 'packed' and new.status = 'out_for_delivery')
      or (old.status = 'out_for_delivery' and new.status = 'delivered')
      or (old.status = 'delivered' and new.status = 'returned')
      or (new.status = 'refunded' and old.status in ('cancelled', 'returned', 'delivered'))) then
      raise exception 'INVALID_STATUS_TRANSITION' using errcode='22023';
    end if;
  else
    raise exception 'FORBIDDEN_STATUS_TRANSITION' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.auto_accept_confirmed_checkout_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare should_accept boolean;
begin
  should_accept := lower(coalesce(new.method, '')) in ('cod', 'cash on delivery')
    or (lower(coalesce(new.method, '')) not in ('cod', 'cash on delivery')
      and lower(coalesce(new.status, '')) in ('captured', 'paid'));

  if should_accept and auth.uid() is not null then
    update public.orders o
      set status = 'accepted'
      where o.id = new.order_id
        and o.user_id = auth.uid()
        and o.status = 'placed';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_accept_cod_checkout_order on public.payments;
create trigger auto_accept_cod_checkout_order
after insert on public.payments
for each row execute function public.auto_accept_confirmed_checkout_order();

drop trigger if exists auto_accept_captured_checkout_order on public.payments;
create trigger auto_accept_captured_checkout_order
after update of status on public.payments
for each row execute function public.auto_accept_confirmed_checkout_order();

revoke all on function public.auto_accept_confirmed_checkout_order() from public, anon, authenticated;

-- The old phase22 seed marked product id 9 as non-returnable. Product IDs vary
-- between environments; AirPods are returnable, so repair by product name.
update public.products
set is_returnable = true
where lower(name) like '%airpod%'
  and is_returnable is distinct from true;

-- Backfill successful orders created before this migration. Pending/failed
-- prepaid attempts remain placed and are not exposed to pickers.
update public.orders o
set status = 'accepted'
where o.status = 'placed'
  and exists (
    select 1 from public.payments p
    where p.order_id = o.id
      and (
        lower(p.method) in ('cod', 'cash on delivery')
        or (lower(p.method) not in ('cod', 'cash on delivery') and lower(p.status) in ('captured', 'paid'))
      )
  );

commit;
notify pgrst, 'reload schema';
