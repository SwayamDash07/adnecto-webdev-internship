'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminShell } from './admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

type SalesRow = { day: string; order_count: number; revenue: number }
type ProductRow = { product_id: number; product_name: string; units_sold: number; revenue: number }
type InventoryRow = { product_id: number; product_name: string; current_stock: number; reserved_stock: number; reorder_level: number; low_stock: boolean }

export function ReportWorkspace() {
  const [period, setPeriod] = useState<'30' | 'month'>('30')
  const [sales, setSales] = useState<SalesRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const from = useMemo(() => { const date = new Date(); if (period === 'month') date.setDate(1); else date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10) }, [period])
  const to = new Date().toISOString().slice(0, 10)
  async function load() {
    setLoading(true); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase browser configuration is missing.'); setLoading(false); return }
    const [salesResult, productsResult, inventoryResult] = await Promise.all([
      client.rpc('admin_sales_report', { p_from: from, p_to: to }),
      client.rpc('admin_top_products_report', { p_from: from, p_to: to }),
      client.rpc('admin_inventory_report'),
    ])
    const firstError = salesResult.error ?? productsResult.error ?? inventoryResult.error
    if (firstError) setError(firstError.message)
    else { setSales((salesResult.data ?? []) as SalesRow[]); setProducts((productsResult.data ?? []) as ProductRow[]); setInventory((inventoryResult.data ?? []) as InventoryRow[]) }
    setLoading(false)
  }
  useEffect(() => { void load() }, [from])
  useRealtimeReload('admin-reports-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  function exportCsv() {
    const rows = [['day', 'orders', 'revenue'], ...sales.map(row => [row.day, String(row.order_count), String(row.revenue)])]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `cartly-sales-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  const totalRevenue = sales.reduce((sum, row) => sum + Number(row.revenue), 0)
  const totalOrders = sales.reduce((sum, row) => sum + Number(row.order_count), 0)
  return <AdminShell title="Reports & exports" description="Live sales, product performance and inventory reports from Supabase."><section className="panel"><div className="panel-heading"><div><h2>Report centre</h2><p>{from} to {to}</p></div><div className="report-toolbar"><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>This month</button><button className={period === '30' ? 'active' : ''} onClick={() => setPeriod('30')}>Last 30 days</button><button onClick={exportCsv} disabled={!sales.length}>Export sales CSV</button><button onClick={() => void load()}>Refresh</button></div></div>{error && <p className="low-stock">{error}</p>}{loading ? <section className="placeholder"><h2>Loading live reports…</h2></section> : <><div className="stat-grid"><div className="stat-card"><small>Revenue</small><strong>{money(totalRevenue)}</strong><em>Non-cancelled orders</em></div><div className="stat-card"><small>Orders</small><strong>{totalOrders}</strong><em>Selected period</em></div><div className="stat-card"><small>Low-stock items</small><strong>{inventory.filter(row => row.low_stock).length}</strong><em>Inventory threshold</em></div></div><div className="dashboard-grid"><section className="panel"><h2>Sales by day</h2><div className="order-list">{sales.length ? sales.map(row => <div className="order-row" key={row.day}><span>{row.day}</span><b>{money(Number(row.revenue))}</b><em>{row.order_count} orders</em></div>) : <p>No sales in this period.</p>}</div></section><section className="panel"><h2>Top products</h2><div className="order-list">{products.length ? products.slice(0, 10).map(row => <div className="order-row" key={row.product_id}><span><strong>{row.product_name}</strong><small>{row.units_sold} units</small></span><b>{money(Number(row.revenue))}</b></div>) : <p>No product sales in this period.</p>}</div></section></div><section className="panel table-panel"><h2>Inventory report</h2><div className="inventory-table"><div className="table-head"><span>Product</span><span>Available</span><span>Reserved</span><span>Reorder level</span><span>State</span></div>{inventory.map(row => <div className="table-row" key={row.product_id}><span>{row.product_name}</span><span>{row.current_stock}</span><span>{row.reserved_stock}</span><span>{row.reorder_level}</span><span className={row.low_stock ? 'low-stock' : 'in-stock'}>{row.low_stock ? 'Low stock' : 'Healthy'}</span></div>)}</div></section></>}</section></AdminShell>
}
