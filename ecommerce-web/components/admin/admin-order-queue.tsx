'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAdminOrderQueue } from '@/hooks/use-admin-order-queue'
import { OrderQueueToolbar } from './orders/order-queue-toolbar'
import { OrderQueueTable } from './orders/order-queue-table'
import { money } from '@/lib/formatters'

export default function AdminOrderQueue({ initialOrders, initialRefundOrderIds, initialError, initialNow, initialFilters }: { initialOrders: import('@/types/admin-orders').AdminOrder[]; initialRefundOrderIds: number[]; initialError: string; initialNow: string; initialFilters: { search: string; date: string; status: string } }) {
  const queue = useAdminOrderQueue({ initialOrders, initialRefundOrderIds, initialError, initialNow, initialFilters })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  useEffect(() => {
    if (!queue.loading && !queue.error) setLastUpdated(new Date())
  }, [queue.loading, queue.error, queue.orders])

  const today = new Date().toDateString()
  const revenueToday = queue.orders.filter(order => new Date(order.created_at).toDateString() === today && !['cancelled', 'refunded', 'returned'].includes(order.status)).reduce((total, order) => total + Number(order.total), 0)
  const pendingCount = queue.orders.filter(order => ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery'].includes(order.status)).length
  const cancelledCount = queue.orders.filter(order => order.status === 'cancelled').length

  return <section className="panel admin-table-panel order-queue-panel">
    <header className="order-queue-heading"><div><p className="eyebrow">FULFILMENT WORKSPACE</p><h2>Live order queue</h2><p>Orders and fulfilment status from Supabase.</p></div><div className="order-refresh-group"><span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for orders'}</span><button type="button" className="secondary-button" onClick={() => void queue.load()} disabled={queue.loading}><RefreshCw size={15} className={queue.loading ? 'order-refreshing' : ''} />{queue.loading ? 'Refreshing' : 'Refresh'}</button></div></header>
    <div className="order-summary-strip" aria-label="Order summary">
      <article><span>Total orders</span><strong>{queue.loading ? '—' : queue.orders.length}</strong></article>
      <article><span>Pending</span><strong>{queue.loading ? '—' : pendingCount}</strong></article>
      <article><span>Revenue today</span><strong>{queue.loading ? '—' : money(revenueToday)}</strong></article>
      <article><span>Cancelled</span><strong>{queue.loading ? '—' : cancelledCount}</strong></article>
    </div>
    <OrderQueueToolbar query={queue.query} setQuery={queue.setQuery} status={queue.status} setStatus={queue.setStatus} sort={queue.sort} setSort={queue.setSort} orders={queue.orders} loading={queue.loading} unfulfilledFilter={queue.unfulfilledFilter} setUnfulfilledFilter={queue.setUnfulfilledFilter} dateFilter={queue.dateFilter} openRefundCount={queue.openRefundCount} />
    <OrderQueueTable loading={queue.loading} error={queue.error} allOrders={queue.orders} visibleOrders={queue.visibleOrders} page={queue.page} setPage={queue.setPage} busy={queue.busy} updateStatus={queue.updateStatus} query={queue.query} status={queue.status} setQuery={queue.setQuery} setStatus={queue.setStatus} onRetry={() => void queue.load()} />
  </section>
}
