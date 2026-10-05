'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from '../admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { PurchaseOrder } from '@/types/admin'

export function LivePurchaseManager() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]); const [error, setError] = useState('')
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('admin_list_purchase_orders'); if (queryError) setError(queryError.message); else setOrders((data ?? []) as PurchaseOrder[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-purchase-orders-live', ['purchase_orders', 'purchase_items'], () => { void load() })
  return <AdminShell title="Purchase orders" description="Review supplier purchase orders and goods-received workflow from Supabase."><section className="panel table-panel"><div className="panel-heading"><div><h2>Purchase order queue</h2><p>Supplier orders and received-item counts.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}{orders.length ? <div className="inventory-table"><div className="table-head"><span>PO</span><span>Supplier</span><span>Status</span><span>Items</span><span>Created</span></div>{orders.map(order => <div className="table-row" key={order.purchase_order_id}><span><strong>PO-{order.purchase_order_id}</strong></span><span>{order.supplier_name}</span><span>{order.status}</span><span>{order.item_count}</span><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span></div>)}</div> : <section className="placeholder"><h2>No purchase orders</h2><p>Create supplier purchase orders in the database to see them here.</p></section>}</section></AdminShell>
}
