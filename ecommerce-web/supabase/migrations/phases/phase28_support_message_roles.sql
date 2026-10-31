-- Action-based support message roles and explicit assistant/event kinds.
-- This migration deliberately does not rewrite historical message rows.
alter table public.support_ticket_events add column if not exists message_kind text;
alter table public.support_ticket_events alter column sender_role drop default;
alter table public.support_ticket_events alter column sender_id drop default;
alter table public.support_ticket_events alter column body drop default;
alter table public.support_ticket_events drop constraint if exists support_ticket_events_message_kind_check;
alter table public.support_ticket_events add constraint support_ticket_events_message_kind_check check(message_kind in ('message','assistant','event')) not valid;
create or replace function public.support_chat_event_defaults() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.sender_id is null then new.sender_id:=new.actor_id; end if;
 if new.body is null or new.body='' then new.body:=coalesce(new.comment,''); end if;
 if new.event_type in ('status_changed','reopened') then new.sender_role:='system'; if new.message_kind is null then new.message_kind:='event'; end if;
 elsif new.event_type='created' and new.sender_role is null then new.sender_role:='customer';
 elsif new.sender_role is null then raise exception 'SENDER_ROLE_REQUIRED'; end if;
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

create or replace function public.customer_reply_support_ticket(p_ticket_id bigint,p_message text) returns boolean language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype; m record;
begin
 if length(trim(coalesce(p_message,'')))<1 or length(p_message)>1000 then raise exception 'INVALID_MESSAGE'; end if;
 select * into t from public.support_tickets where id=p_ticket_id and user_id=auth.uid() for update; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 if t.status='resolved' then raise exception 'TICKET_RESOLVED'; end if;
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'reply',trim(p_message),false,auth.uid(),'customer',trim(p_message),'message');
 update public.support_tickets set updated_at=now() where id=t.id;
 for m in select u.id from public.users u join public.roles r on r.id=u.role_id where r.name::text in ('store_manager','super_admin','customer_support') loop insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) values(m.id,m.id,'complaint_updated','Customer replied to complaint','Complaint #'||t.id||' has a new customer reply.','Customer complaint #'||t.id||' has a new reply.',t.order_id,null,t.id); end loop;
 return true;
end $$;

create or replace function public.admin_update_customer_support_ticket(p_ticket_id bigint,p_status text default null,p_comment text default null,p_internal boolean default false,p_resolution_note text default null) returns boolean language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype; changed boolean:=false; v_name text; v_event text;
begin
 if public.current_complaint_staff_role() not in ('store_manager','super_admin','customer_support') then raise exception 'COMPLAINT_ACCESS_REQUIRED' using errcode='42501'; end if;
 if p_status is not null and p_status not in ('open','in_progress','resolved') then raise exception 'INVALID_STATUS'; end if;
 if p_status='resolved' and nullif(trim(p_resolution_note),'') is null then raise exception 'RESOLUTION_NOTE_REQUIRED'; end if;
 select * into t from public.support_tickets where id=p_ticket_id for update; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 select nullif(trim(full_name),'') into v_name from public.users where id=auth.uid();
 if p_status is not null and p_status is distinct from t.status then
   update public.support_tickets set status=p_status,resolved_at=case when p_status='resolved' then now() else null end,updated_at=now() where id=t.id;
   v_event:=case when p_status='resolved' then 'Marked resolved by '||coalesce(v_name,'A support agent')||': '||trim(p_resolution_note) else 'Status changed to '||replace(p_status,'_',' ') end;
   insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'status_changed',v_event,false,auth.uid(),'system',v_event,'event'); changed:=true;
 end if;
 if nullif(trim(coalesce(p_comment,'')),'') is not null then
   insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'reply',left(trim(p_comment),1000),coalesce(p_internal,false),auth.uid(),'staff',left(trim(p_comment),1000),'message');
   update public.support_tickets set updated_at=now() where id=t.id; if not coalesce(p_internal,false) then changed:=true; end if;
 end if;
 if changed then insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) values(t.user_id,t.user_id,'complaint_updated','Support ticket update','Complaint #'||t.id||' has a new update.','There is an update in your support chat.',t.order_id,null,t.id); end if;
 return true;
end $$;

create or replace function public.customer_reopen_support_ticket(p_ticket_id bigint) returns boolean language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype;
begin
 select * into t from public.support_tickets where id=p_ticket_id and user_id=auth.uid() for update; if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 if t.status<>'resolved' then raise exception 'TICKET_NOT_RESOLVED'; end if;
 update public.support_tickets set status='open',resolved_at=null,updated_at=now() where id=t.id;
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind) values(t.id,auth.uid(),'reopened','Customer reopened this complaint.',false,auth.uid(),'system','Customer reopened this complaint.','event');
 insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) select u.id,u.id,'complaint_raised','Customer reopened a complaint','Complaint #'||t.id||' was reopened.','Customer complaint #'||t.id||' was reopened.',t.order_id,null,t.id from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text in ('store_manager','super_admin','customer_support'); return true;
end $$;

do $$
declare def text;
begin
 def:=pg_get_functiondef('public.admin_customer_support_ticket_detail(bigint)'::regprocedure);
 def:=replace(def, '''event_type'',e.event_type,''comment'',e.comment,''is_internal'',e.is_internal,''created_at''', '''event_type'',e.event_type,''comment'',e.comment,''body'',e.body,''sender_id'',e.sender_id,''sender_role'',e.sender_role,''message_kind'',e.message_kind,''is_automated'',(e.message_kind=''assistant''),''is_internal'',e.is_internal,''created_at''');
 def:=replace(def, 'coalesce(nullif(eu.full_name,''''),ea.email,''Staff'')', 'coalesce(nullif(trim(eu.full_name),''''),''A support agent'')');
 execute def;
end $$;

create or replace function public.customer_support_chat_messages(p_ticket_id bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; v_user uuid;
begin
 select user_id into v_user from public.support_tickets where id=p_ticket_id and user_id=auth.uid(); if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'sender_id',e.sender_id,'sender_role',e.sender_role,'body',e.body,'is_internal',false,'message_kind',e.message_kind,'created_at',e.created_at,'sender_name',case when e.sender_role='staff' then coalesce(nullif(trim(u.full_name),''),'A support agent') when e.message_kind='assistant' then 'Cartly Assistant' else null end) order by e.created_at,e.id),'[]'::jsonb) into result from public.support_ticket_events e left join public.users u on u.id=e.sender_id where e.ticket_id=p_ticket_id and not e.is_internal; return result;
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

grant execute on function public.customer_reply_support_ticket(bigint,text),public.customer_reopen_support_ticket(bigint),public.admin_update_customer_support_ticket(bigint,text,text,boolean,text) to authenticated;
grant execute on function public.customer_support_chat_messages(bigint),public.admin_take_customer_support_ticket(bigint,boolean) to authenticated;
revoke all on function public.customer_reply_support_ticket(bigint,text),public.customer_reopen_support_ticket(bigint),public.admin_update_customer_support_ticket(bigint,text,text,boolean,text) from public,anon;
revoke all on function public.customer_support_chat_messages(bigint),public.admin_take_customer_support_ticket(bigint,boolean) from public,anon;
notify pgrst,'reload schema';
