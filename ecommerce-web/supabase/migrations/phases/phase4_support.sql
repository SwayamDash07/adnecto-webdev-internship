-- Phase 4: customer support ticket creation and history.

alter table public.support_tickets enable row level security;
drop policy if exists "customers read own tickets" on public.support_tickets;
create policy "customers read own tickets" on public.support_tickets
  for select using (user_id = auth.uid());

create or replace function public.customer_create_support_ticket(
  p_subject text,
  p_message text,
  p_priority text default 'medium',
  p_order_id bigint default null
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(p_subject), '') is null or nullif(trim(p_message), '') is null then raise exception 'TICKET_CONTENT_REQUIRED'; end if;
  if p_order_id is not null and not exists (select 1 from public.orders where id = p_order_id and user_id = auth.uid()) then raise exception 'ORDER_NOT_FOUND'; end if;
  if lower(coalesce(p_priority, 'medium')) not in ('low', 'medium', 'high') then raise exception 'INVALID_PRIORITY'; end if;
  insert into public.support_tickets(user_id, order_id, subject, message, priority)
  values (auth.uid(), p_order_id, trim(p_subject), trim(p_message), lower(coalesce(p_priority, 'medium')))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.customer_list_support_tickets()
returns table (ticket_id bigint, order_id bigint, subject text, message text, priority text, status text, created_at timestamptz)
language sql security invoker set search_path = public
as $$
  select id, order_id, subject, message, priority, status, created_at
  from public.support_tickets
  where user_id = auth.uid()
  order by created_at desc;
$$;

grant execute on function public.customer_create_support_ticket(text,text,text,bigint) to authenticated;
grant execute on function public.customer_list_support_tickets() to authenticated;

