'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { Stats } from './stats'

type Recent = { id: number; customer: string; total: number; status: string }
type TopProduct = { product_id: number; product_name: string; units_sold: number; revenue: number }
type LowStock = { product_id: number; product_name: string; current_stock: number; reorder_level: number }

export function Overview() {
  const pathname = usePathname()
  const [orders, setOrders] = useState<Recent[]>([])
  const [sales, setSales] = useState<{ day: string; revenue: number }[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<LowStock[]>([])
  async function load() {
    const client = createSupabaseBrowserClient(); if (!client) return
    const [recent, daily, products, stock] = await Promise.all([
      client.from('dashboard_recent_orders').select('*'),
      client.from('dashboard_daily_sales').select('day,revenue').order('day', { ascending: true }).limit(30),
      client.from('dashboard_top_products').select('*').limit(5),
      client.from('dashboard_low_stock').select('*').limit(8),
    ])
    setOrders((recent.data ?? []) as Recent[]); setSales((daily.data ?? []) as { day: string; revenue: number }[])
    setTopProducts((products.data ?? []) as TopProduct[]); setLowStock((stock.data ?? []) as LowStock[])
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-overview-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  const ordersHref = `${pathname.replace(/\/$/, '')}/orders`
  return <><Stats /><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Revenue performance from live orders</p></div></div><div className="order-list">{sales.length ? sales.map(item => <div className="order-row" key={item.day}><span>{item.day}</span><b>{money(item.revenue)}</b></div>) : <p>No sales recorded yet.</p>}</div></section><section className="panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest customer orders</p></div><a className="link-button" href={ordersHref}>View all</a></div><div className="order-list">{orders.length ? orders.map(order => <div className="order-row" key={order.id}><span className="avatar">{order.customer?.[0] ?? '?'}</span><span><strong>#{order.id}</strong><small>{order.customer}</small></span><b>{money(order.total)}</b><em>{order.status}</em></div>) : <p>No orders recorded yet.</p>}</div></section></div><div className="dashboard-grid"><section className="panel"><h2>Top products</h2><div className="order-list">{topProducts.length ? topProducts.map(product => <div className="order-row" key={product.product_id}><span><strong>{product.product_name}</strong><small>{product.units_sold} units sold</small></span><b>{money(product.revenue)}</b></div>) : <p>No product sales recorded yet.</p>}</div></section><section className="panel"><h2>Inventory alerts</h2><div className="order-list">{lowStock.length ? lowStock.map(item => <div className="order-row" key={item.product_id}><span><strong>{item.product_name}</strong><small>Reorder at {item.reorder_level}</small></span><b className="low-stock">{item.current_stock} left</b></div>) : <p>All inventory levels are healthy.</p>}</div></section></div></>
}
