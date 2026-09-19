'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'

type Order = { id: number; status: string; total: number; created_at: string; delivery_slot: string | null }

export function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.from('orders').select('id,status,total,created_at,delivery_slot').order('created_at', { ascending: false }); if (queryError) setError(queryError.message); else setOrders((data ?? []) as Order[]) }
  useEffect(() => {
    let channel: ReturnType<NonNullable<ReturnType<typeof createSupabaseBrowserClient>>['channel']> | null = null
    void (async () => {
      const client = createSupabaseBrowserClient(); if (!client) return
      await load()
      const { data: { user } } = await client.auth.getUser()
      if (!user) return
      channel = client.channel(`customer-orders-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => { void load() }).subscribe()
    })()
    return () => { if (channel) void channel.unsubscribe() }
  }, [])
  async function cancel(orderId: number) {
    if (!window.confirm('Cancel this order? Stock will be returned and the payment will be marked for refund.')) return
    setBusy(orderId); setError(''); const client = createSupabaseBrowserClient(); if (!client) return
    const { error: cancelError } = await client.rpc('customer_cancel_order', { p_order_id: orderId })
    if (cancelError) setError(cancelError.message); else await load(); setBusy(null)
  }
  return <section className="panel table-panel"><div className="panel-heading"><div><h2>Your orders</h2><p>Orders placed from your account.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}{orders.length ? <div className="inventory-table"><div className="table-head"><span>Order</span><span>Date</span><span>Total</span><span>Status</span><span>Action</span></div>{orders.map(order => <div className="table-row" key={order.id}><span><strong>#{order.id}</strong></span><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span><span>{money(Number(order.total))}</span><span>{order.status.replaceAll('_', ' ')}</span><span><Link className="link-button" href={`/customer/orders/tracking?id=${order.id}`}>Track</Link>{['placed', 'accepted'].includes(order.status) && <button className="link-button" disabled={busy === order.id} onClick={() => void cancel(order.id)}>{busy === order.id ? 'Cancelling…' : 'Cancel'}</button>}</span></div>)}</div> : <section className="placeholder"><h2>No orders yet</h2><p>Your completed orders will appear here.</p></section>}</section>
}
