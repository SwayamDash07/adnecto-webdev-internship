'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { can } from '@/lib/permission-definitions'

export type AdminNotification = { id: number; type: string; title: string; body: string; message?: string; order_id: number|null; complaint_id: number|null; read_at: string|null; created_at: string }
const portalBase=process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN?`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}`:'/404'
function relative(value:string){const mins=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return mins<1?'Just now':mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`}

export function AdminNotificationsBell({role}:{role:string}){
  const [items,setItems]=useState<AdminNotification[]>([])
  const [unreadCount,setUnreadCount]=useState(0)
  const [userId,setUserId]=useState('')
  const [open,setOpen]=useState(false)
  const load=useCallback(async()=>{
    const client=createSupabaseBrowserClient();if(!client)return
    const {data:{user}}=await client.auth.getUser();if(!user)return
    setUserId(user.id)
    const [latest,unread]=await Promise.all([
      client.from('notifications').select('id,type,title,body,message,order_id,complaint_id,read_at,created_at').in('type',['late_order_reminder','complaint_raised','complaint_updated','admin_message_done','admin_message_reminder']).order('created_at',{ascending:false}).limit(10),
      client.from('notifications').select('id',{count:'exact',head:true}).in('type',['late_order_reminder','complaint_raised','complaint_updated','admin_message_done','admin_message_reminder']).is('read_at',null),
    ])
    const {data}=latest
    setItems((data??[]) as AdminNotification[])
    const {data:messages}=await client.rpc('staff_list_admin_messages')
    const unreadMessages=((messages??[]) as Array<{read_at:string|null}>).filter(item=>!item.read_at).length
    setUnreadCount((unread.count??0)+unreadMessages)
  },[])
  useEffect(()=>{
    if(!can(role, 'notifications:view'))return
    void load()
    const client=createSupabaseBrowserClient();if(!client)return
    const channel=client.channel('admin-notifications-live').on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>void load()).subscribe()
    const timer=setInterval(()=>void load(),60000)
    return()=>{clearInterval(timer);void channel.unsubscribe()}
  },[role,load])
  if(!can(role, 'notifications:view'))return null
  const unread=unreadCount
  async function markAll(){const client=createSupabaseBrowserClient();if(!client||!userId)return;await client.from('notifications').update({read_at:new Date().toISOString()}).or(`recipient_user_id.eq.${userId},user_id.eq.${userId}`).is('read_at',null);await client.rpc('staff_mark_all_admin_messages_read');await load()}
  async function follow(item:AdminNotification){const client=createSupabaseBrowserClient();if(client&&!item.read_at)await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);const target=item.complaint_id?`${portalBase}/complaints?complaint=${item.complaint_id}`:item.order_id?`${portalBase}/orders?search=${item.order_id}`:`${portalBase}/notifications`;window.location.assign(target)}
  return <div className="admin-notifications-wrap"><button className="admin-notifications-trigger" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Bell size={18}/>{unread>0&&<span>{unread>9?'9+':unread}</span>}</button>{open&&<section className="admin-notifications-popover" aria-label="Recent notifications"><header><strong>Notifications</strong><button onClick={()=>void markAll()} disabled={!unread}><CheckCheck size={14}/>Mark all as read</button></header>{items.length?items.map(item=><button className={`admin-notification-item ${item.read_at?'read':''}`} key={item.id} onClick={()=>void follow(item)}><span className="admin-notification-dot"/><span><strong>{item.title}</strong><small>{item.body||item.message}</small><em>{relative(item.created_at)}</em></span></button>):<div className="admin-notifications-empty">You&apos;re all caught up.</div>}<Link href={`${portalBase}/notifications`} onClick={()=>setOpen(false)}>Open Messages</Link></section>}</div>
}
