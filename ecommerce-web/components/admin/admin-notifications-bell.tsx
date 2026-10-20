'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { can } from '@/lib/permission-definitions'

export type AdminNotification = { id: number; type: string; title: string; body: string; message?: string; order_id: number|null; complaint_id: number|null; read_at: string|null; created_at: string }
const portalBase=process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN?`/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}`:'/404'
function relative(value:string){const mins=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return mins<1?'Just now':mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`}

export function AdminNotificationsBell({role,initialItems,initialUnreadCount,userId}:{role:string;initialItems:AdminNotification[];initialUnreadCount:number;userId:string}){
  const router=useRouter()
  const [items,setItems]=useState<AdminNotification[]>(initialItems)
  const [unreadCount,setUnreadCount]=useState(initialUnreadCount)
  const [open,setOpen]=useState(false)
  useEffect(()=>{setItems(initialItems);setUnreadCount(initialUnreadCount)},[initialItems,initialUnreadCount])
  useEffect(()=>{
    if(!can(role, 'notifications:view'))return
    const client=createSupabaseBrowserClient();if(!client)return
    const channel=client.channel(`admin-notifications-live-${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>router.refresh()).on('postgres_changes',{event:'*',schema:'public',table:'admin_message_recipients'},()=>router.refresh()).subscribe()
    const timer=setInterval(()=>router.refresh(),60000)
    return()=>{clearInterval(timer);void client.removeChannel(channel)}
  },[role,router])
  if(!can(role, 'notifications:view'))return null
  const unread=unreadCount
  async function markAll(){const client=createSupabaseBrowserClient();if(!client||!userId)return;await client.from('notifications').update({read_at:new Date().toISOString()}).or(`recipient_user_id.eq.${userId},user_id.eq.${userId}`).is('read_at',null);await client.rpc('staff_mark_all_admin_messages_read');router.refresh()}
  async function follow(item:AdminNotification){const client=createSupabaseBrowserClient();if(client&&!item.read_at)await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);const target=item.complaint_id?`${portalBase}/complaints?complaint=${item.complaint_id}`:item.order_id?`${portalBase}/orders?search=${item.order_id}`:`${portalBase}/notifications`;router.refresh();window.location.assign(target)}
  return <div className="admin-notifications-wrap"><button className="admin-notifications-trigger" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Bell size={18}/>{unread>0&&<span>{unread>9?'9+':unread}</span>}</button>{open&&<section className="admin-notifications-popover" aria-label="Recent notifications"><header><strong>Notifications</strong><button onClick={()=>void markAll()} disabled={!unread}><CheckCheck size={14}/>Mark all as read</button></header>{items.length?items.map(item=><button className={`admin-notification-item ${item.read_at?'read':''}`} key={item.id} onClick={()=>void follow(item)}><span className="admin-notification-dot"/><span><strong>{item.title}</strong><small>{item.body||item.message}</small><em>{relative(item.created_at)}</em></span></button>):<div className="admin-notifications-empty">You&apos;re all caught up.</div>}<Link href={`${portalBase}/notifications`} onClick={()=>setOpen(false)}>Open Messages</Link></section>}</div>
}
