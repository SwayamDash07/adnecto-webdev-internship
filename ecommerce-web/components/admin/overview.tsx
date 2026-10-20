'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { Stats } from './stats'
import { useAdminOverview } from '@/hooks/use-admin-overview'
import { RecentOrdersPanel } from './overview/RecentOrdersPanel'
import { can } from '@/lib/permission-definitions'
import { NeedsAttentionPanel } from './overview/NeedsAttentionPanel'
import type { AdminDailySales, AdminSummary } from '@/lib/admin-overview-stats'

export function Overview({ role, initialOrders, initialLateOrders, initialLowStock, initialError, initialSummary, initialYesterday, initialManagers }: { role: string | null; initialOrders: import('@/types/admin-overview').Recent[]; initialLateOrders: import('@/types/admin-overview').LateOrder[]; initialLowStock: import('@/types/admin-overview').LowStock[]; initialError: string; initialSummary: AdminSummary | null; initialYesterday: AdminDailySales | null; initialManagers: Array<{ user_id: string; full_name: string }> }) {
  const pathname = usePathname()
  const { orders, lateOrders, lowStock, loading, error, reload } = useAdminOverview({ initialOrders, initialLateOrders, initialLowStock, initialError })
  const base = pathname.replace(/\/$/, '')
  const ordersHref = `${base}/orders`
  const inventoryHref = `${base}/inventory?stock=low`
  const deliveryHref = `${base}/delivery`
  return <div className="admin-overview overview-today-page">
    <Stats role={role} orders={orders} initialSummary={initialSummary} initialYesterday={initialYesterday} />
    {can(role, 'reports:view') && <div className="overview-report-link"><span>Need the longer-term picture?</span><Link href={`${base}/reports`}>View full report <ArrowRight size={14} /></Link></div>}
    {error && <div className="admin-alert" role="alert"><CircleAlert size={17} />{error}</div>}
    <div className="overview-action-grid">
      <NeedsAttentionPanel loading={loading} error={error} orders={orders} lateOrders={lateOrders} lowStock={lowStock} role={role} ordersHref={ordersHref} inventoryHref={inventoryHref} deliveryHref={deliveryHref} initialManagers={initialManagers} onReload={reload} />
      {can(role, 'reports:view') && <RecentOrdersPanel loading={loading} orders={orders} ordersHref={ordersHref} />}
    </div>
  </div>
}
