'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from '../admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { AdminProduct, PurchaseOrder } from '@/types/admin'

export function LivePurchaseManagerV2() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [form, setForm] = useState({ supplier: '', productId: '', quantity: '1', unitCost: '0' })
  const [error, setError] = useState(''); const [message, setMessage] = useState('')
  async function load() {
    const client = createSupabaseBrowserClient(); if (!client) return
    const [ordersResult, productsResult] = await Promise.all([client.rpc('admin_list_purchase_orders'), client.rpc('admin_list_products')])
    if (ordersResult.error) setError(ordersResult.error.message); else setOrders((ordersResult.data ?? []) as PurchaseOrder[])
    if (!productsResult.error) setProducts((productsResult.data ?? []) as AdminProduct[])
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-purchase-orders-v2-live', ['purchase_orders', 'purchase_items', 'products', 'inventory'], () => { void load() })
  async function createOrder() {
    setError(''); setMessage(''); const client = createSupabaseBrowserClient(); if (!client) return
    const { error: createError } = await client.rpc('admin_create_purchase_order', { p_supplier_name: form.supplier, p_product_id: Number(form.productId), p_quantity: Number(form.quantity), p_unit_cost: Number(form.unitCost) })
    if (createError) setError(createError.message); else { setMessage('Purchase order created.'); setForm({ supplier: '', productId: '', quantity: '1', unitCost: '0' }); await load() }
  }
  return <AdminShell title="Purchase orders" description="Create and review supplier purchase orders backed by Supabase."><div className="management-layout"><section className="panel form-panel"><h2>New purchase order</h2><div className="form-grid"><label>Supplier<input value={form.supplier} onChange={event => setForm({ ...form, supplier: event.target.value })} placeholder="Supplier name" /></label><label>Product<select value={form.productId} onChange={event => setForm({ ...form, productId: event.target.value })}><option value="">Select product</option>{products.map(product => <option key={product.product_id} value={product.product_id}>{product.product_name}</option>)}</select></label><label>Quantity<input type="number" min="1" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></label><label>Unit cost<input type="number" min="0" value={form.unitCost} onChange={event => setForm({ ...form, unitCost: event.target.value })} /></label></div><button className="primary-button" onClick={() => void createOrder()}>Create purchase order</button>{error && <p className="low-stock">{error}</p>}{message && <p className="success-message">{message}</p>}</section><section className="panel table-panel"><div className="panel-heading"><h2>Purchase order queue</h2><button className="secondary-button" onClick={() => void load()}>Refresh</button></div><div className="inventory-table"><div className="table-head"><span>PO</span><span>Supplier</span><span>Status</span><span>Items</span><span>Created</span></div>{orders.map(order => <div className="table-row" key={order.purchase_order_id}><span><strong>PO-{order.purchase_order_id}</strong></span><span>{order.supplier_name}</span><span>{order.status}</span><span>{order.item_count}</span><span>{new Date(order.created_at).toLocaleDateString('en-IN')}</span></div>)}</div></section></div></AdminShell>
}
