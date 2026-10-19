-- Staff inbox read state and separate public resolution note.
alter table public.support_tickets add column if not exists last_staff_read_at timestamptz;

create or replace function public.admin_mark_support_ticket_read(p_ticket_id bigint) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if public.current_complaint_staff_role() not in ('store_manager','super_admin','customer_support') then
   raise exception 'COMPLAINT_ACCESS_REQUIRED' using errcode='42501';
 end if;
 update public.support_tickets set last_staff_read_at=now() where id=p_ticket_id;
 if not found then raise exception 'TICKET_NOT_FOUND'; end if;
 return true;
end $$;

create or replace function public.admin_list_unread_support_tickets() returns setof bigint
language plpgsql security definer set search_path=public as $$
begin
 if public.current_complaint_staff_role() not in ('store_manager','super_admin','customer_support') then
   raise exception 'COMPLAINT_ACCESS_REQUIRED' using errcode='42501';
 end if;
 return query select distinct t.id from public.support_tickets t join public.support_ticket_events e on e.ticket_id=t.id
 where e.sender_role='customer' and not e.is_internal
 and e.created_at>coalesce(t.last_staff_read_at,'-infinity'::timestamptz);
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
   v_event:=case when p_status='resolved' then 'Marked resolved by '||coalesce(v_name,'A support agent') else coalesce(v_name,'A support agent')||' changed the status to '||replace(p_status,'_',' ') end;
   insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind)
   values(t.id,auth.uid(),'status_changed',v_event,false,auth.uid(),'system',v_event,'event'); changed:=true;
   if p_status='resolved' then
     insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind)
     values(t.id,auth.uid(),'reply',left(trim(p_resolution_note),1000),false,auth.uid(),'staff',left(trim(p_resolution_note),1000),'message');
   end if;
 end if;
 if nullif(trim(coalesce(p_comment,'')),'') is not null then
   insert into public.support_ticket_events(ticket_id,actor_id,event_type,comment,is_internal,sender_id,sender_role,body,message_kind)
   values(t.id,auth.uid(),'reply',left(trim(p_comment),1000),coalesce(p_internal,false),auth.uid(),'staff',left(trim(p_comment),1000),'message');
   update public.support_tickets set updated_at=now() where id=t.id; if not coalesce(p_internal,false) then changed:=true; end if;
 end if;
 if changed then insert into public.notifications(user_id,recipient_user_id,type,title,message,body,order_id,complaint_id,support_ticket_id) values(t.user_id,t.user_id,'complaint_updated','Support ticket update','Complaint #'||t.id||' has a new update.','There is an update in your support chat.',t.order_id,null,t.id); end if;
 return true;
end $$;

grant execute on function public.admin_mark_support_ticket_read(bigint),public.admin_list_unread_support_tickets() to authenticated;
revoke all on function public.admin_mark_support_ticket_read(bigint),public.admin_list_unread_support_tickets() from public,anon;
notify pgrst,'reload schema';

-- Include the assigned staff member's display name for the inbox header.
do $$
declare def text;
begin
 def:=pg_get_functiondef('public.admin_customer_support_ticket_detail(bigint)'::regprocedure);
 def:=replace(def,
   $old$'raised_by_name',coalesce(nullif(u.full_name,''),a.email,'Customer')$old$,
   $new$'raised_by_name',coalesce(nullif(u.full_name,''),a.email,'Customer'),'assigned_name',(select nullif(trim(au.full_name),'') from public.users au where au.id=t.assigned_to)$new$);
 execute def;
end $$;

-- Add the latest refund status to the read-only ticket order details payload.
do $$
declare def text;
begin
 def:=pg_get_functiondef('public.admin_customer_support_ticket_detail(bigint)'::regprocedure);
 def:=replace(def,
   $old$'payment_status',pay.status,'items',coalesce(items.rows,'[]'::jsonb)$old$,
   $new$'payment_status',pay.status,'refund_status',(select rf.status from public.refunds rf where rf.order_id=o.id order by rf.created_at desc limit 1),'items',coalesce(items.rows,'[]'::jsonb)$new$);
 execute def;
end $$;
