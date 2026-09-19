'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from './admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'

type Queue = 'picker' | 'delivery'
type FulfilmentOrder = { order_id: number; customer_name: string; total: number; status: string; delivery_slot: string | null; address_line: string; item_count: number }
const pickerStatuses = ['accepted', 'picking', 'packed']
const deliveryStatuses = ['out_for_delivery', 'delivered', 'returned']

export function FulfilmentQueue({ queue }: { queue: Queue }) {
  const [orders, setOrders] = useState<FulfilmentOrder[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [details, setDetails] = useState<Record<number, { notes: string; proof: string }>>({})
  const statuses = queue === 'picker' ? pickerStatuses : deliveryStatuses
  async function load() {
    setLoading(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase browser configuration is missing.'); setLoading(false); return }
    const { data, error: queryError } = await client.rpc('admin_list_fulfilment_orders', { p_queue: queue })
    if (queryError) setError(queryError.message)
    else setOrders((data ?? []) as FulfilmentOrder[])
    setLoading(false)
  }
  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const channel = client.channel(`fulfilment-${queue}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load() }).subscribe()
    void load()
    return () => { void channel.unsubscribe() }
  }, [queue])
  async function update(orderId: number, status: string) {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const detail = details[orderId] ?? { notes: '', proof: '' }
    const { error: updateError } = await client.rpc('admin_update_delivery_details', { p_order_id: orderId, p_status: status, p_delivery_notes: detail.notes || null, p_proof_of_delivery_url: detail.proof || null })
    if (updateError) setError(updateError.message)
    else await load()
  }
  const title = queue === 'picker' ? 'Picker queue' : 'Delivery queue'
  const description = queue === 'picker' ? 'Pick customer orders, confirm quantities and hand packed orders to delivery.' : 'Manage assigned deliveries and update delivery outcomes.'
  return <AdminShell title={title} description={description}><section className="panel table-panel"><div className="panel-heading"><div><h2>Live {queue} work</h2><p>Orders and statuses from Supabase.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}{loading ? <section className="placeholder"><h2>Loading queue…</h2></section> : orders.length ? <div className="inventory-table"><div className="table-head"><span>Order</span><span>Customer</span><span>Total</span><span>Address / slot</span><span>Status and delivery details</span></div>{orders.map(order => { const detail = details[order.order_id] ?? { notes: '', proof: '' }; return <div className="table-row" key={order.order_id}><span><strong>#{order.order_id}</strong><small>{order.item_count} item{order.item_count === 1 ? '' : 's'}</small></span><span>{order.customer_name}</span><span>{money(Number(order.total))}</span><span>{order.address_line || 'No address'}<small>{order.delivery_slot || 'No slot'}</small></span><span><select value={statuses.includes(order.status) ? order.status : statuses[0]} onChange={event => void update(order.order_id, event.target.value)}>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>{queue === 'delivery' && <><input value={detail.notes} placeholder="Delivery note" onChange={event => setDetails(current => ({ ...current, [order.order_id]: { ...detail, notes: event.target.value } }))} /><input value={detail.proof} placeholder="Proof URL" onChange={event => setDetails(current => ({ ...current, [order.order_id]: { ...detail, proof: event.target.value } }))} /></>}</span></div>})}</div> : <section className="placeholder"><h2>No orders in this queue</h2><p>New matching orders will appear here.</p></section>}</section></AdminShell>
}
