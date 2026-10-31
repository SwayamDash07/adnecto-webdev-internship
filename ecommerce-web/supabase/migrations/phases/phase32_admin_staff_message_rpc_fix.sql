-- Repair Messages RPC resolution, server authorization, and PostgREST grants.
-- Run after phase31_admin_staff_messages.sql.
do $$ begin
 if to_regprocedure('public.staff_list_admin_messages()') is null then
   raise exception 'Apply supabase/migrations/phases/phase31_admin_staff_messages.sql before this migration.';
 end if;
end $$;

create or replace function public.current_role_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
 select case public.current_role()
   when 'super_admin' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','products:create','products:disable','customers:view','coupons:manage','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','revenue:view','complaints:raise','complaints:manage','team:manage','notifications:view','notifications:send','messages:send')
   when 'store_manager' then p_permission in ('orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view')
   when 'picker' then p_permission in ('orders:view','orders:update_status','picker:use','notifications:view')
   when 'customer_support' then p_permission in ('complaints:manage','notifications:view')
   else false end
$$;
revoke all on function public.current_role_has_permission(text) from public,anon;
grant execute on function public.current_role_has_permission(text) to authenticated;

create or replace function public.admin_list_sent_staff_messages()
returns table(message_id bigint,message_type text,title text,body text,created_at timestamptz,recipient_count bigint,read_count bigint,done_count bigint,acknowledged_count bigint)
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('messages:send') then raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501'; end if;
 return query select m.id,m.message_type,m.title,m.body,m.created_at,count(r.id),count(r.id) filter(where r.read_at is not null),count(r.id) filter(where r.done_at is not null),count(r.id) filter(where r.acknowledged_at is not null)
 from public.admin_messages m left join public.admin_message_recipients r on r.message_id=m.id where m.sender_id=auth.uid() group by m.id order by m.created_at desc;
end $$;

create or replace function public.admin_send_staff_message(p_type text,p_title text,p_body text,p_recipient_ids uuid[])
returns bigint language plpgsql security definer set search_path=public as $$
declare mid bigint;
begin
 if not public.current_role_has_permission('messages:send') then raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501'; end if;
 if p_type not in ('alert','issue','announcement') or nullif(trim(p_title),'') is null or nullif(trim(p_body),'') is null or coalesce(cardinality(p_recipient_ids),0)=0 then raise exception 'INVALID_MESSAGE'; end if;
 insert into public.admin_messages(sender_id,message_type,title,body) values(auth.uid(),p_type,trim(p_title),trim(p_body)) returning id into mid;
 insert into public.admin_message_recipients(message_id,recipient_id)
 select mid,u.id from public.users u join public.roles ro on ro.id=u.role_id where u.id=any(p_recipient_ids) and ro.name::text in ('store_manager','picker','customer_support');
 if not found then raise exception 'NO_VALID_RECIPIENTS'; end if;
 return mid;
end $$;

create or replace function public.admin_list_staff_message_targets()
returns table(user_id uuid,full_name text,role_name text)
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('messages:send') then raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501'; end if;
 return query select u.id,coalesce(u.full_name,'Staff')::text,ro.name::text from public.users u join public.roles ro on ro.id=u.role_id where ro.name::text in ('store_manager','picker','customer_support') order by u.full_name;
end $$;

create or replace function public.admin_remind_staff_message(p_message_id bigint)
returns integer language plpgsql security definer set search_path=public as $$
declare r record; total integer:=0;
begin
 if not public.current_role_has_permission('messages:send') then raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.admin_messages where id=p_message_id and sender_id=auth.uid()) then raise exception 'MESSAGE_NOT_FOUND' using errcode='42501'; end if;
 for r in select mr.id,mr.recipient_id,m.title from public.admin_message_recipients mr join public.admin_messages m on m.id=mr.message_id where m.id=p_message_id and ((m.message_type='announcement' and mr.acknowledged_at is null) or (m.message_type in ('alert','issue') and mr.done_at is null)) and (mr.reminder_at is null or mr.reminder_at<now()-interval '30 minutes') loop
   update public.admin_message_recipients set reminder_at=now() where id=r.id;
   insert into public.notifications(user_id,recipient_user_id,type,title,message,body) values(r.recipient_id,r.recipient_id,'admin_message_reminder','Reminder: '||r.title,'Please review this staff message.','Please review this staff message.');
   total:=total+1;
 end loop;
 return total;
end $$;

create or replace function public.admin_staff_message_recipients(p_message_id bigint)
returns table(recipient_id uuid,full_name text,role_name text,read_at timestamptz,done_at timestamptz,acknowledged_at timestamptz,done_note text)
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('messages:send') then raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.admin_messages where id=p_message_id and sender_id=auth.uid()) then raise exception 'MESSAGE_NOT_FOUND' using errcode='42501'; end if;
 return query select r.recipient_id,coalesce(u.full_name,'Staff')::text,ro.name::text,r.read_at,r.done_at,r.acknowledged_at,r.done_note from public.admin_message_recipients r join public.users u on u.id=r.recipient_id left join public.roles ro on ro.id=u.role_id where r.message_id=p_message_id order by u.full_name;
end $$;

revoke all on function public.admin_list_sent_staff_messages(),public.admin_send_staff_message(text,text,text,uuid[]),public.admin_list_staff_message_targets(),public.admin_remind_staff_message(bigint),public.admin_staff_message_recipients(bigint) from public,anon;
grant execute on function public.admin_list_sent_staff_messages(),public.admin_send_staff_message(text,text,text,uuid[]),public.admin_list_staff_message_targets(),public.admin_remind_staff_message(bigint),public.admin_staff_message_recipients(bigint) to authenticated;

revoke all on function public.get_my_admin_profile(),public.staff_list_admin_messages(),public.staff_update_admin_message(bigint,text,text),public.staff_mark_all_admin_messages_read() from public,anon;
grant execute on function public.get_my_admin_profile(),public.staff_list_admin_messages(),public.staff_update_admin_message(bigint,text,text),public.staff_mark_all_admin_messages_read() to authenticated;
notify pgrst,'reload schema';
