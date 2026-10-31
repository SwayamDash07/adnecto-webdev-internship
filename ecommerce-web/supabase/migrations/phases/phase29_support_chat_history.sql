-- Persist the opening assistant question so the full conversation survives
-- ticket creation, navigation, and reloads.
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
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(v_id,auth.uid(),'reply','Hi there, sorry you’re having trouble. What is this about?',auth.uid(),'system','Hi there, sorry you’re having trouble. What is this about?','assistant');
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(v_id,auth.uid(),'created',v_reason,auth.uid(),'customer',case when p_issue_type='other' then 'Other' else v_reason end,'message');
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,sender_id,sender_role,body,message_kind) values(v_id,auth.uid(),'status_changed','We usually reply within 24 hours.',auth.uid(),'system','Thanks, we have raised complaint #'||v_id||' for '||v_reason||case when p_order_id is null then '' else ' on order #'||p_order_id end||'. A support agent will join this chat shortly. We usually reply within 24 hours. You can add more details here while you wait.','assistant');
 insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) select u.id,u.id,'complaint_raised','New complaint #'||v_id||' - '||v_reason||case when p_order_id is null then '' else ' - Order #'||p_order_id end,'A customer is waiting for support.','A customer is waiting for support.',p_order_id,null,v_id from public.users u join public.roles r on r.id=u.role_id where r.name::text in ('store_manager','super_admin','customer_support');
 return v_id;
end $$;

-- Existing tickets already keep the selected issue and acknowledgement. Add
-- the earlier prompt once, before the first customer message in their thread.
insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind,created_at)
select t.id,t.user_id,'reply','Hi there, sorry you’re having trouble. What is this about?',false,t.user_id,'system','Hi there, sorry you’re having trouble. What is this about?','assistant',coalesce((select min(e.created_at) from public.support_ticket_events e where e.ticket_id=t.id and e.event_type='created'),t.created_at)-interval '1 second'
from public.support_tickets t
where exists(select 1 from public.support_ticket_events e where e.ticket_id=t.id and e.message_kind='assistant')
  and not exists(select 1 from public.support_ticket_events e where e.ticket_id=t.id and e.message_kind='assistant' and e.body='Hi there, sorry you’re having trouble. What is this about?');

notify pgrst,'reload schema';
