'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from '../admin-shell'
import { emptyProductForm, type InventoryAdjustment } from '@/lib/services/admin'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

export function InventoryManager() {
  const [adjustment, setAdjustment] = useState<InventoryAdjustment>({ product: 'Soundcore Life Q30', warehouse: 'Mumbai Central', quantity: '', reason: 'Stock correction', batch: '', expiry: '' })
  const [items, setItems] = useState<Array<{ product_id: number; product_name: string; sku: string | null; current_stock: number; reserved_stock: number; reorder_level: number }>>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function load() {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const { data, error: queryError } = await client.rpc('admin_list_inventory')
    if (queryError) setError(queryError.message)
    else setItems((data ?? []) as typeof items)
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-inventory-live', ['inventory', 'products'], () => { void load() })
  async function saveAdjustment() {
    setError(''); setMessage('')
    const item = items.find(entry => entry.product_name === adjustment.product)
    const delta = Number(adjustment.quantity)
    if (!item || !Number.isInteger(delta) || delta === 0) { setError('Choose a product and enter a non-zero whole-number adjustment.'); return }
    const client = createSupabaseBrowserClient()
    if (!client) return
    const { error: updateError } = await client.rpc('admin_adjust_inventory_with_batch', { p_product_id: item.product_id, p_delta: delta, p_reason: adjustment.reason, p_batch_number: adjustment.batch || null, p_expiry_date: adjustment.expiry || null })
    if (updateError) setError(updateError.message)
    else { setMessage('Inventory updated in Supabase.'); setAdjustment(current => ({ ...current, quantity: '' })); await load() }
  }
  return <AdminShell title="Inventory controls" description="Adjust stock, manage batches, warehouses, expiry dates, suppliers and purchase history."><div className="management-layout"><section className="panel form-panel"><h2>Stock adjustment</h2><p>Current stock is read from Supabase and adjustments are audited.</p><div className="form-grid"><label>Product<select value={adjustment.product} onChange={event => setAdjustment({ ...adjustment, product: event.target.value })}>{items.map(item => <option key={item.product_id}>{item.product_name}</option>)}</select></label><label>Warehouse<select value={adjustment.warehouse} onChange={event => setAdjustment({ ...adjustment, warehouse: event.target.value })}><option>Mumbai Central</option><option>Bengaluru South</option><option>Delhi NCR</option></select></label><label>Quantity<input value={adjustment.quantity} onChange={event => setAdjustment({ ...adjustment, quantity: event.target.value })} placeholder="+20 or -5" /></label><label>Reason<select value={adjustment.reason} onChange={event => setAdjustment({ ...adjustment, reason: event.target.value })}><option>Stock correction</option><option>Wastage</option><option>Damaged goods</option><option>Stock transfer</option></select></label><label>Batch number<input value={adjustment.batch} onChange={event => setAdjustment({ ...adjustment, batch: event.target.value })} /></label><label>Expiry date<input type="date" value={adjustment.expiry} onChange={event => setAdjustment({ ...adjustment, expiry: event.target.value })} /></label></div><button className="primary-button" onClick={() => void saveAdjustment()}>Save adjustment</button>{error && <p className="low-stock">{error}</p>}{message && <p className="success-message">{message}</p>}</section><section className="panel table-panel"><div className="panel-heading"><div><h2>Live inventory</h2><p>Available, reserved and reorder thresholds.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div><div className="inventory-table"><div className="table-head"><span>Product</span><span>SKU</span><span>Available</span><span>Reserved</span><span>Reorder at</span></div>{items.map(item => <div className="table-row" key={item.product_id}><span><strong>{item.product_name}</strong></span><span>{item.sku ?? '—'}</span><span className={item.current_stock <= item.reorder_level ? 'low-stock' : ''}>{item.current_stock}</span><span>{item.reserved_stock}</span><span>{item.reorder_level}</span></div>)}</div></section></div></AdminShell>
}
