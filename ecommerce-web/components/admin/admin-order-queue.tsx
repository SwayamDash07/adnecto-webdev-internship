'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'

type AdminOrder = { order_id: number; customer_name: string; customer_email: string; total: number; status: string; created_at: string; delivery_slot: string | null; address_line: string; item_count: number }
const statuses = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded']

export default function AdminOrderQueue() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  async function load() {
    setLoading(true)
    setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase browser configuration is missing. Check .env.local and restart Next.js.'); setLoading(false); return }
    const { data, error: queryError } = await client.rpc('admin_list_orders')
    if (queryError) setError(`Could not load orders: ${queryError.message}`)
    else setOrders((data ?? []) as AdminOrder[])
    setLoading(false)
  }
  useEffect(() => {
    const client = createSupabaseBrowserClient(); if (!client) return
    const channel = client.channel('admin-orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load() }).subscribe()
    void load()
    return () => { void channel.unsubscribe() }
  }, [])
  async function updateStatus(orderId: number, status: string) {
    setBusy(orderId)
    setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase browser configuration is missing.'); setBusy(null); return }
    const { error: updateError } = await client.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status })
    if (updateError) setError(`Could not update order: ${updateError.message}`)
    else await load()
    setBusy(null)
  }
  return <section className="panel table-panel"><div className="panel-heading"><div><h2>Live order queue</h2><p>Orders and fulfilment status from Supabase.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}{loading ? <section className="placeholder"><h2>Loading orders…</h2><p>Checking Supabase for the latest customer orders.</p></section> : orders.length ? <div className="inventory-table"><div className="table-head"><span>Order</span><span>Customer</span><span>Total</span><span>Address</span><span>Status</span></div>{orders.map(order => <div className="table-row" key={order.order_id}><span><strong>#{order.order_id}</strong><small>{new Date(order.created_at).toLocaleDateString('en-IN')}</small></span><span>{order.customer_name}<small>{order.customer_email}</small></span><span>{money(Number(order.total))}<small>{order.item_count} item{order.item_count === 1 ? '' : 's'}</small></span><span>{order.address_line || 'No address'}</span><span><select value={order.status} disabled={busy === order.order_id} onChange={event => void updateStatus(order.order_id, event.target.value)}>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></span></div>)}</div> : <section className="placeholder"><h2>No orders yet</h2><p>The admin RPC returned zero orders. Verify the order exists in Supabase.</p></section>}</section>
}
