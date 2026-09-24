'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, CircleAlert, PackageSearch } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { Stats } from './stats'

type Recent = { id: number; customer: string; total: number; status: string }
type TopProduct = { product_id: number; product_name: string; units_sold: number; revenue: number }
type LowStock = { product_id: number; product_name: string; current_stock: number; reorder_level: number }
type SalesPoint = { day: string; revenue: number }

const panelMotion = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: .45, ease: [0.22, 1, 0.36, 1] as const } }
const moneyTooltip = (value: unknown) => [money(Number(value ?? 0)), 'Revenue'] as [string, string]
function compactDay(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

export function Overview() {
  const pathname = usePathname()
  const [orders, setOrders] = useState<Recent[]>([])
  const [sales, setSales] = useState<SalesPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<LowStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    const client = createSupabaseBrowserClient(); if (!client) return
    setError(''); setLoading(true)
    const [recent, daily, products, stock] = await Promise.all([client.from('dashboard_recent_orders').select('*'), client.from('dashboard_daily_sales').select('day,revenue').order('day', { ascending: true }).limit(30), client.from('dashboard_top_products').select('*').limit(5), client.from('dashboard_low_stock').select('*').limit(8)])
    const firstError = recent.error ?? daily.error ?? products.error ?? stock.error
    if (firstError) setError(firstError.message)
    setOrders((recent.data ?? []) as Recent[]); setSales((daily.data ?? []) as SalesPoint[]); setTopProducts((products.data ?? []) as TopProduct[]); setLowStock((stock.data ?? []) as LowStock[]); setLoading(false)
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-overview-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  const ordersHref = `${pathname.replace(/\/$/, '')}/orders`
  return <div className="admin-overview"><Stats />{error && <div className="admin-alert" role="alert"><CircleAlert size={17} />{error}</div>}<div className="dashboard-grid overview-primary-grid"><motion.section className="panel analytics-panel" {...panelMotion}><div className="panel-heading"><div><p className="eyebrow">LAST 30 DAYS</p><h2>Sales overview</h2><p>Revenue from live orders</p></div><span className="panel-chip">Daily revenue</span></div><div className="chart-wrap">{loading ? <div className="chart-skeleton" /> : sales.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={sales} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6355d3" stopOpacity={.28} /><stop offset="100%" stopColor="#6355d3" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" /><XAxis dataKey="day" tickFormatter={compactDay} tickLine={false} axisLine={false} tick={{ fill: '#9299aa', fontSize: 10 }} minTickGap={28} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#9299aa', fontSize: 10 }} tickFormatter={value => `₹${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : value}`} /><Tooltip contentStyle={{ border: '1px solid #e6e8f0', borderRadius: 10, boxShadow: '0 10px 25px #1d264c14', fontSize: 11 }} formatter={moneyTooltip} labelFormatter={value => compactDay(String(value))} /><Area type="monotone" dataKey="revenue" stroke="#6355d3" strokeWidth={2.5} fill="url(#salesFill)" animationDuration={900} animationEasing="ease-out" /></AreaChart></ResponsiveContainer> : <div className="chart-empty"><PackageSearch size={23} /><strong>No sales data yet</strong><span>Revenue will appear here after the first completed order.</span></div>}</div></motion.section><motion.section className="panel recent-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .08 }}><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent orders</h2><p>Latest customer orders</p></div><Link className="link-button" href={ordersHref}>View all <ArrowRight size={14} /></Link></div><div className="order-list">{loading ? <div className="list-skeleton" /> : orders.length ? orders.slice(0, 6).map((order, index) => <motion.div className="order-row admin-order-row" key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}><span className="avatar">{order.customer?.slice(0, 1).toUpperCase() || 'C'}</span><span><strong>Order #{order.id}</strong><small>{order.customer}</small></span><b>{money(order.total)}</b><em className={`status-pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</em></motion.div>) : <div className="inline-admin-empty"><strong>No orders yet</strong><span>New customer orders will appear here.</span></div>}</div></motion.section></div><div className="dashboard-grid overview-secondary-grid"><motion.section className="panel chart-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .14 }}><div className="panel-heading"><div><p className="eyebrow">PRODUCT PERFORMANCE</p><h2>Top products</h2><p>Revenue leaders from live order items</p></div></div><div className="mini-chart">{loading ? <div className="chart-skeleton" /> : topProducts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 12, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#edf0f5" /><XAxis type="number" hide /><YAxis type="category" dataKey="product_name" width={105} tickLine={false} axisLine={false} tick={{ fill: '#626b82', fontSize: 10 }} tickFormatter={value => String(value).length > 17 ? `${String(value).slice(0, 17)}…` : String(value)} /><Tooltip cursor={{ fill: '#f8f8fc' }} contentStyle={{ border: '1px solid #e6e8f0', borderRadius: 10, fontSize: 11 }} formatter={moneyTooltip} /><Bar dataKey="revenue" fill="#6355d3" radius={[0, 5, 5, 0]} barSize={17} animationDuration={800} /></BarChart></ResponsiveContainer> : <div className="chart-empty"><PackageSearch size={22} /><strong>No product sales yet</strong><span>Product performance will appear after orders.</span></div>}</div></motion.section><motion.section className="panel inventory-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .2 }}><div className="panel-heading"><div><p className="eyebrow">STOCK HEALTH</p><h2>Inventory alerts</h2><p>Products at or below reorder level</p></div><Link className="link-button" href="/inventory">Inventory <ArrowRight size={14} /></Link></div><div className="order-list">{loading ? <div className="list-skeleton" /> : lowStock.length ? lowStock.map((item, index) => <motion.div className="order-row inventory-row" key={item.product_id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}><span className="inventory-dot"><CircleAlert size={14} /></span><span><strong>{item.product_name}</strong><small>Reorder at {item.reorder_level}</small></span><b className="low-stock">{item.current_stock} left</b></motion.div>) : <div className="inline-admin-empty healthy"><strong>Inventory is healthy</strong><span>No products need replenishment right now.</span></div>}</div></motion.section></div></div>
}
