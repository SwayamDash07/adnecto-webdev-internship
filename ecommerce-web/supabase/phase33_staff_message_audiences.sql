-- Server-resolved audiences for admin-to-staff messages.
-- Apply after phase31_admin_staff_messages.sql and phase32_admin_staff_message_rpc_fix.sql.

alter table public.admin_messages
  add column if not exists audience_mode text,
  add column if not exists audience_roles text[];

alter table public.admin_messages drop constraint if exists admin_messages_audience_mode_check;
alter table public.admin_messages add constraint admin_messages_audience_mode_check
  check (audience_mode is null or audience_mode in ('everyone','roles','people'));

create or replace function public.admin_list_staff_message_targets()
returns table(user_id uuid,full_name text,role_name text)
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('messages:send') then
   raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 return query
 select u.id,coalesce(nullif(u.full_name,''),'Staff')::text,ro.name::text
 from public.users u
 join public.roles ro on ro.id=u.role_id
 join auth.users au on au.id=u.id
 where ro.name::text in ('store_manager','customer_support','picker')
   and u.id<>auth.uid()
   and au.deleted_at is null
   and (au.banned_until is null or au.banned_until<=now())
 order by coalesce(nullif(u.full_name,''),'Staff');
end $$;

drop function if exists public.admin_send_staff_message(text,text,text,uuid[],text,text[]);
drop function if exists public.admin_send_staff_message(text,text,text,uuid[]);
create function public.admin_send_staff_message(
  p_type text,
  p_title text,
  p_body text,
  p_recipient_ids uuid[],
  p_audience_mode text default 'people',
  p_audience_roles text[] default null
)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_message_id bigint;
  v_recipient_ids uuid[];
  v_roles text[];
  v_requested uuid[];
begin
 if not public.current_role_has_permission('messages:send') then
   raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 if p_type is null or p_type not in ('alert','issue','announcement')
    or nullif(trim(p_title),'') is null
    or char_length(trim(p_title))>80
    or nullif(trim(p_body),'') is null
    or char_length(trim(p_body))>500 then
   raise exception 'INVALID_MESSAGE' using errcode='22023';
 end if;
 if p_audience_mode is null or p_audience_mode not in ('everyone','roles','people') then
   raise exception 'INVALID_AUDIENCE_MODE' using errcode='22023';
 end if;

 if p_audience_mode='everyone' then
   select coalesce(array_agg(distinct u.id),array[]::uuid[]) into v_recipient_ids
   from public.users u join public.roles ro on ro.id=u.role_id join auth.users au on au.id=u.id
   where ro.name::text in ('store_manager','customer_support','picker')
     and u.id<>auth.uid() and au.deleted_at is null
     and (au.banned_until is null or au.banned_until<=now());
   v_roles:=null;
 elsif p_audience_mode='roles' then
   if coalesce(cardinality(p_audience_roles),0)=0
      or exists(select 1 from unnest(p_audience_roles) role_name where role_name not in ('store_manager','customer_support','picker')) then
     raise exception 'INVALID_AUDIENCE_ROLES' using errcode='22023';
   end if;
   select array_agg(distinct role_name order by role_name) into v_roles
   from unnest(p_audience_roles) role_name;
   select coalesce(array_agg(distinct u.id),array[]::uuid[]) into v_recipient_ids
   from public.users u join public.roles ro on ro.id=u.role_id join auth.users au on au.id=u.id
   where ro.name::text=any(v_roles) and u.id<>auth.uid() and au.deleted_at is null
     and (au.banned_until is null or au.banned_until<=now());
 else
   select coalesce(array_agg(distinct id),array[]::uuid[]) into v_requested
   from unnest(coalesce(p_recipient_ids,array[]::uuid[])) id where id<>auth.uid();
   if exists(
     select 1 from unnest(v_requested) requested_id
     where not exists(
       select 1 from public.users u join public.roles ro on ro.id=u.role_id join auth.users au on au.id=u.id
       where u.id=requested_id and ro.name::text in ('store_manager','customer_support','picker')
         and au.deleted_at is null and (au.banned_until is null or au.banned_until<=now())
     )
   ) then raise exception 'INVALID_OR_INACTIVE_STAFF_RECIPIENT' using errcode='22023'; end if;
   v_recipient_ids:=v_requested;
   v_roles:=null;
 end if;

 if coalesce(cardinality(v_recipient_ids),0)=0 then
   raise exception 'NO_VALID_RECIPIENTS' using errcode='22023';
 end if;

 insert into public.admin_messages(sender_id,message_type,title,body,audience_mode,audience_roles)
 values(auth.uid(),p_type,trim(p_title),trim(p_body),p_audience_mode,v_roles)
 returning id into v_message_id;
 insert into public.admin_message_recipients(message_id,recipient_id)
 select v_message_id,recipient_id from unnest(v_recipient_ids) recipient_id;

 return jsonb_build_object('message_id',v_message_id,'recipient_count',cardinality(v_recipient_ids));
end $$;

drop function if exists public.admin_list_sent_staff_messages();
create function public.admin_list_sent_staff_messages()
returns table(
 message_id bigint,message_type text,title text,body text,created_at timestamptz,
 recipient_count bigint,read_count bigint,done_count bigint,acknowledged_count bigint,
 audience_mode text,audience_roles text[],audience_label text
)
language plpgsql security definer set search_path=public as $$
begin
 if not public.current_role_has_permission('messages:send') then
   raise exception 'MESSAGES_SEND_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 return query
 select m.id,m.message_type,m.title,m.body,m.created_at,count(r.id),
   count(r.id) filter(where r.read_at is not null),
   count(r.id) filter(where r.done_at is not null),
   count(r.id) filter(where r.acknowledged_at is not null),
   m.audience_mode,m.audience_roles,
   case
     when m.audience_mode='everyone' then 'All staff'::text
     when m.audience_mode='roles' then coalesce((
       select string_agg(case role_name when 'store_manager' then 'Store managers' when 'customer_support' then 'Customer support' when 'picker' then 'Pickers' else initcap(replace(role_name,'_',' ')) end, ', ' order by role_name)
       from unnest(m.audience_roles) role_name
     ),'Selected roles')
     when m.audience_mode='people' or m.audience_mode is null then coalesce((
       select string_agg(coalesce(nullif(u.full_name,''),'Staff'),', ' order by coalesce(nullif(u.full_name,''),'Staff'))
       from public.admin_message_recipients mr join public.users u on u.id=mr.recipient_id
       where mr.message_id=m.id
     ),'Individual staff')
     else 'Staff recipients'::text
   end
 from public.admin_messages m left join public.admin_message_recipients r on r.message_id=m.id
 where m.sender_id=auth.uid()
 group by m.id order by m.created_at desc;
end $$;

revoke all on function public.admin_send_staff_message(text,text,text,uuid[],text,text[]),public.admin_list_sent_staff_messages(),public.admin_list_staff_message_targets() from public,anon;
grant execute on function public.admin_send_staff_message(text,text,text,uuid[],text,text[]),public.admin_list_sent_staff_messages(),public.admin_list_staff_message_targets() to authenticated;
notify pgrst,'reload schema';
