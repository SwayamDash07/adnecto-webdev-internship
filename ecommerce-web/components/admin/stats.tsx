'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ClipboardList, PackageCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { can } from '@/lib/permission-definitions'
import { money } from '@/lib/formatters'
import type { Recent } from '@/types/admin-overview'
import type { AdminDailySales, AdminSummary } from '@/lib/admin-overview-stats'

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous <= 0) return <span className="overview-delta neutral">— vs yesterday</span>
  const value = Math.round(((current - previous) / previous) * 100)
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
  return <span className={`overview-delta ${value >= 0 ? 'up' : 'down'}`}><Icon size={12} />{Math.abs(value)}% vs yesterday</span>
}

export function Stats({ role, orders, initialSummary, initialYesterday }: { role: string | null; orders: Recent[]; initialSummary: AdminSummary | null; initialYesterday: AdminDailySales | null }) {
  const canRevenue = can(role, 'revenue:view')
  const pathname = usePathname()
  const summary = initialSummary
  const yesterday = initialYesterday
  const loading = false
  const base = pathname.replace(/\/$/, '')
  const todayHref = `${base}/orders?date=today`
  const inventoryHref = `${base}/inventory?stock=low`
  const deliveryHref = `${base}/delivery`
  const pickerCount = orders.filter(order => ['placed', 'accepted', 'picking'].includes(order.status)).length

  if (!can(role, 'reports:view')) return <div className="stat-grid overview-kpis picker-kpis"><Link className="stat-card stat-card-purple overview-kpi-link" href={`${base}/picker`}><span className="stat-icon"><ClipboardList size={18} /></span><small>Orders waiting to be picked</small><strong>{loading ? '—' : pickerCount}</strong><em>Open your picking queue</em></Link></div>

  const value = summary ?? { today_sales: 0, today_orders: 0, pending_deliveries: 0, low_stock_items: 0 }
  const cards = [
    { key: 'today_sales', label: "Today's sales", caption: 'Non-cancelled orders', icon: TrendingUp, tone: 'purple', value: summary ? money(Number(value.today_sales)) : '—', previous: yesterday ? Number(yesterday.revenue) : null, href: todayHref },
    { key: 'today_orders', label: 'Orders today', caption: 'Placed since midnight', icon: ClipboardList, tone: 'orange', value: summary ? String(value.today_orders) : '—', previous: yesterday ? Number(yesterday.orders) : null, href: todayHref },
    { key: 'pending_deliveries', label: 'Pending deliveries', caption: 'Open fulfilment work', icon: PackageCheck, tone: 'green', value: summary ? String(value.pending_deliveries) : '—', href: deliveryHref },
    { key: 'low_stock_items', label: 'Low stock items', caption: 'Low and out of stock', icon: TriangleAlert, tone: 'blue', value: summary ? String(value.low_stock_items) : '—', href: inventoryHref },
  ].filter(card => card.key !== 'today_sales' || canRevenue)
  return <div className="stat-grid overview-kpis">{cards.map(card => { const Icon = card.icon; return <Link className={`stat-card stat-card-${card.tone} overview-kpi-link`} href={card.href} key={card.key}><span className="stat-icon"><Icon size={18} strokeWidth={2.2} /></span><small>{card.label}</small><strong>{loading ? <span className="stat-skeleton" /> : card.value}</strong><em>{card.caption}</em>{card.key === 'today_sales' || card.key === 'today_orders' ? !loading && <Delta current={Number(card.key === 'today_sales' ? value.today_sales : value.today_orders)} previous={card.previous ?? null} /> : null}</Link> })}</div>
}
