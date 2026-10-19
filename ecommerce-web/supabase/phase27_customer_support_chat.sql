-- Customer support chat: extend the existing event stream instead of duplicating messages.
insert into public.roles(name) values('customer_support') on conflict(name) do nothing;
alter table public.support_tickets add column if not exists assigned_to uuid references public.users(id);
alter table public.notifications add column if not exists support_ticket_id bigint;
drop function if exists public.customer_list_notifications();
create function public.customer_list_notifications() returns table(notification_id bigint,order_id bigint,support_ticket_id bigint,title text,message text,read_at timestamptz,created_at timestamptz) language sql security invoker set search_path=public as $$ select n.id,n.order_id,n.support_ticket_id,n.title,n.message,n.read_at,n.created_at from public.notifications n where n.user_id=auth.uid() order by n.created_at desc limit 30 $$;
grant execute on function public.customer_list_notifications() to authenticated;
revoke all on function public.customer_list_notifications() from public,anon;
alter table public.support_ticket_events add column if not exists sender_role text;
alter table public.support_ticket_events add column if not exists body text;
alter table public.support_ticket_events add column if not exists sender_id uuid references public.users(id);
alter table public.support_ticket_events add column if not exists message_kind text check(message_kind in ('message','assistant','event'));
-- Keep historical rows untouched; the action that writes a new row determines its role.
alter table public.support_ticket_events alter column sender_role drop default;
alter table public.support_ticket_events alter column body drop default;
alter table public.support_ticket_events alter column sender_id drop default;
alter table public.support_ticket_events add constraint support_ticket_events_sender_role_check check(sender_role in ('customer','staff','system')) not valid;
create or replace function public.support_chat_event_defaults() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.sender_id is null then new.sender_id:=new.actor_id; end if;
 if new.body is null or new.body='' then new.body:=coalesce(new.comment,''); end if;
 if new.sender_role is null then raise exception 'SENDER_ROLE_REQUIRED'; end if;
 if new.message_kind is null and new.event_type in ('status_changed','reopened') then new.message_kind:='event'; end if;
 return new;
end $$;
drop trigger if exists support_chat_event_defaults on public.support_ticket_events;
create trigger support_chat_event_defaults before insert on public.support_ticket_events for each row execute function public.support_chat_event_defaults();
create or replace function public.customer_start_support_chat(p_order_id bigint,p_issue_type text) returns bigint language plpgsql security definer set search_path=public as $$
declare v_id bigint; v_order public.orders%rowtype; v_state text; v_priority text:='medium'; v_reason text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_order_id is not null then select * into v_order from public.orders where id=p_order_id and user_id=auth.uid(); if not found then raise exception 'ORDER_NOT_FOUND'; end if; end if;
 v_state:=case when p_order_id is null then 'general' when v_order.status='cancelled' then 'cancelled' when v_order.status in ('delivered','returned','refunded') then 'delivered' else 'undelivered' end;
 if not ((v_state='general' and p_issue_type in ('account_login','payment_coupon','product_question','other')) or (v_state='undelivered' and p_issue_type in ('late_delivery','wrong_update','change_address_slot','payment_problem','other')) or (v_state='delivered' and p_issue_type in ('delivered_damaged','wrong_item','missing_item','quality_problem','invoice_problem','other')) or (v_state='cancelled' and p_issue_type in ('refund_not_received','cancelled_without_request','other'))) then raise exception 'INVALID_ISSUE_FOR_ORDER_STATE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||coalesce(p_order_id::text,'general'),0));
 select id into v_id from public.support_tickets where user_id=auth.uid() and order_id is not distinct from p_order_id and status in ('open','in_progress') order by created_at limit 1;
 if v_id is not null then return -v_id; end if;
 if p_issue_type='other' then v_priority:='medium'; end if;
 v_reason:=case p_issue_type when 'late_delivery' then 'Late delivery' when 'wrong_update' then 'Wrong or missing update' when 'change_address_slot' then 'Change address or slot' when 'payment_problem' then 'Payment problem' when 'delivered_damaged' then 'Item damaged or defective' when 'wrong_item' then 'Wrong item received' when 'missing_item' then 'Item missing' when 'quality_problem' then 'Quality problem' when 'invoice_problem' then 'Billing or invoice problem' when 'refund_not_received' then 'Refund not received' when 'cancelled_without_request' then 'Cancelled without my request' when 'account_login' then 'Account or login' when 'payment_coupon' then 'Payment or coupon' when 'product_question' then 'Product question' else 'Other' end;
 if p_issue_type in ('wrong_item','delivered_damaged') then v_priority:='high'; elsif p_issue_type='late_delivery' and v_order.status='out_for_delivery' and coalesce(v_order.delivery_slot_end,now()-interval '1 second')<now() then v_priority:='high'; end if;
 insert into public.support_tickets(user_id,order_id,subject,message,priority,status,issue_type) values(auth.uid(),p_order_id,left(v_reason||case when p_order_id is null then '' else ' - Order #'||p_order_id end,120),v_reason,v_priority,'open',p_issue_type) returning id into v_id;
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(v_id,auth.uid(),'created',v_reason,auth.uid(),'customer',case when p_issue_type='other' then 'Other' else v_reason end,'message');
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(v_id,auth.uid(),'status_changed','We usually reply within 24 hours.',auth.uid(),'system','Thanks, we have raised complaint #'||v_id||' for '||v_reason||case when p_order_id is null then '' else ' on order #'||p_order_id end||'. A support agent will join this chat shortly. We usually reply within 24 hours. You can add more details here while you wait.','assistant');
 insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) select u.id,u.id,'complaint_raised','New complaint #'||v_id||' - '||v_reason||case when p_order_id is null then '' else ' - Order #'||p_order_id end,'A customer is waiting for support.','A customer is waiting for support.',p_order_id,null,v_id from public.users u join public.roles r on r.id=u.role_id where r.name::text in ('store_manager','super_admin','customer_support');
 return v_id;
end $$;
create or replace function public.customer_send_support_chat_message(p_ticket_id bigint,p_body text) returns boolean language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype; n integer;
begin
 if length(trim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'INVALID_MESSAGE'; end if;
 select * into t from public.support_tickets where id=p_ticket_id and user_id=auth.uid() for update; if not found then raise exception 'TICKET_NOT_FOUND'; end if; if t.status='resolved' then raise exception 'TICKET_RESOLVED'; end if;
 select count(*) into n from public.support_ticket_events where ticket_id=t.id and sender_role='customer' and event_type='reply'; if n>=10 and not exists(select 1 from public.support_ticket_events where ticket_id=t.id and sender_role='staff' and not is_internal) then raise exception 'WAIT_FOR_SUPPORT'; end if;
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'reply',trim(p_body),auth.uid(),'customer',trim(p_body),'message'); update public.support_tickets set updated_at=now() where id=t.id; return true;
end $$;
create or replace function public.customer_support_chat_messages(p_ticket_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; v_user uuid;
begin
 select user_id into v_user from public.support_tickets where id=p_ticket_id and user_id=auth.uid(); if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'sender_id',e.sender_id,'sender_role',e.sender_role,'body',e.body,'is_internal',false,'message_kind',e.message_kind,'created_at',e.created_at,'sender_name',case when e.sender_role='staff' then coalesce(nullif(u.full_name,''),'A support agent') when e.message_kind='assistant' then 'Cartly Assistant' else null end) order by e.created_at,e.id),'[]'::jsonb) into result from public.support_ticket_events e left join public.users u on u.id=e.sender_id where e.ticket_id=p_ticket_id and not e.is_internal; return result;
end $$;
create or replace function public.admin_take_customer_support_ticket(p_ticket_id bigint,p_reassign boolean default false) returns boolean language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype; v_name text;
begin
 if public.current_complaint_staff_role() not in ('store_manager','super_admin','customer_support') then raise exception 'COMPLAINT_ACCESS_REQUIRED' using errcode='42501'; end if;
 select * into t from public.support_tickets where id=p_ticket_id for update; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 if t.assigned_to is not null and t.assigned_to<>auth.uid() and not coalesce(p_reassign,false) then return false; end if;
 select nullif(trim(full_name),'') into v_name from public.users where id=auth.uid();
 update public.support_tickets set assigned_to=auth.uid(),status='in_progress',updated_at=now() where id=t.id;
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'status_changed',coalesce(v_name,'A support agent')||' from Support joined the chat.',auth.uid(),'system',coalesce(v_name,'A support agent')||' from Support joined the chat.','event');
 insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) values(t.user_id,t.user_id,'complaint_updated','Support joined your chat','A support agent has joined complaint #'||t.id||'.','A support agent has joined your chat.',t.order_id,null,t.id);
 return true;
end $$;
grant execute on function public.customer_start_support_chat(bigint,text),public.customer_send_support_chat_message(bigint,text),public.customer_support_chat_messages(bigint),public.admin_take_customer_support_ticket(bigint,boolean) to authenticated;
revoke all on function public.customer_start_support_chat(bigint,text),public.customer_send_support_chat_message(bigint,text),public.customer_support_chat_messages(bigint) from public,anon;
revoke all on function public.admin_take_customer_support_ticket(bigint,boolean) from public,anon;
-- Allow limited support staff into complaint operations, never general admin routes.
notify pgrst,'reload schema';
-- Register the new role only after phase26 has committed.
insert into public.roles(name) values('customer_support') on conflict(name) do nothing;
do $$
declare def text;
begin
 foreach def in array array[
   pg_get_functiondef('public.admin_list_customer_support_tickets()'::regprocedure),
   pg_get_functiondef('public.admin_customer_support_ticket_detail(bigint)'::regprocedure),
   pg_get_functiondef('public.admin_update_customer_support_ticket(bigint,text,text,boolean,text)'::regprocedure)
 ] loop
   def:=replace(def, 'in (''store_manager'',''super_admin'')', 'in (''store_manager'',''super_admin'',''customer_support'')');
   def:=replace(def, 'user_id,recipient_user_id,type,title,message,body,order_id,complaint_id)', 'user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id)');
   def:=replace(def, 't.order_id,null);', 't.order_id,null,t.id);');
   execute def;
 end loop;
end $$;
drop policy if exists "staff read support events" on public.support_ticket_events;
create policy "staff read support events" on public.support_ticket_events for select to authenticated using(public.current_complaint_staff_role() in ('store_manager','super_admin','customer_support'));
drop policy if exists "support participants read photos" on storage.objects;
create policy "support participants read photos" on storage.objects for select to authenticated using(bucket_id='support-photos' and (storage.foldername(name))[1]='support' and ((storage.foldername(name))[2]=auth.uid()::text or public.current_complaint_staff_role() in ('store_manager','super_admin','customer_support')));
