-- Keep order-status notifications compatible with both notification schemas:
-- the original schema requires body, while the newer UI reads message.

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_text text;
begin
  if new.status is distinct from old.status and new.user_id is not null then
    notification_text := 'Order #' || new.id || ' is now ' || replace(new.status::text, '_', ' ') || '.';

    insert into public.notifications(user_id, order_id, title, message, body)
    values (new.user_id, new.id, 'Order status updated', notification_text, notification_text);
  end if;

  return new;
end;
$$;

drop trigger if exists order_status_notification on public.orders;
create trigger order_status_notification
after update of status on public.orders
for each row execute function public.notify_order_status_change();
