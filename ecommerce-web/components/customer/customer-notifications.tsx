'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

type Notification = { notification_id: number; order_id: number | null; title: string; message: string; read_at: string | null; created_at: string }

export function CustomerNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  async function load() {
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data } = await client.rpc('customer_list_notifications')
    setItems((data ?? []) as Notification[])
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('customer-notifications-live', ['notifications'], () => { void load() })
  async function markRead(id: number) {
    const client = createSupabaseBrowserClient(); if (!client) return
    await client.rpc('customer_mark_notification_read', { p_notification_id: id }); await load()
  }
  return <section className="panel notifications-panel"><div className="panel-heading"><div><p className="eyebrow">STAY IN THE LOOP</p><h2>Notifications</h2><p>Live updates about your orders and deliveries.</p></div></div>{items.length ? <div className="order-list">{items.map(item => <div className={`order-row ${item.read_at ? 'is-read' : ''}`} key={item.notification_id}><span><strong>{item.title}</strong><small>{item.message}</small></span><em>{new Date(item.created_at).toLocaleString('en-IN')}</em>{!item.read_at && <button className="link-button" onClick={() => void markRead(item.notification_id)}>Mark read</button>}</div>)}</div> : <div className="inline-empty"><span>✦</span><div><strong>You&apos;re all caught up</strong><p>Order and delivery updates will appear here.</p></div></div>}</section>
}
