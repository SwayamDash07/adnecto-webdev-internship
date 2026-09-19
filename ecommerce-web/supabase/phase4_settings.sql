-- Phase 4: delivery-slot administration.

alter table public.delivery_slots enable row level security;
drop policy if exists "delivery slots are public" on public.delivery_slots;
create policy "delivery slots are public" on public.delivery_slots for select using (true);

create or replace function public.admin_list_delivery_slots()
returns table (slot_id bigint, starts_at timestamptz, ends_at timestamptz, capacity integer)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('store_manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
  return query select d.id, d.starts_at, d.ends_at, d.capacity from public.delivery_slots d order by d.starts_at;
end; $$;

create or replace function public.admin_upsert_delivery_slot(p_slot_id bigint default null, p_starts_at timestamptz default null, p_ends_at timestamptz default null, p_capacity integer default 0)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.has_role('store_manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at or p_capacity < 1 then raise exception 'INVALID_DELIVERY_SLOT'; end if;
  if p_slot_id is null then insert into public.delivery_slots(starts_at, ends_at, capacity) values (p_starts_at, p_ends_at, p_capacity) returning id into v_id;
  else update public.delivery_slots set starts_at = p_starts_at, ends_at = p_ends_at, capacity = p_capacity where id = p_slot_id returning id into v_id; end if;
  if v_id is null then raise exception 'DELIVERY_SLOT_NOT_FOUND'; end if; return v_id;
end; $$;

grant execute on function public.admin_list_delivery_slots() to authenticated;
grant execute on function public.admin_upsert_delivery_slot(bigint,timestamptz,timestamptz,integer) to authenticated;
