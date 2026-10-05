'use client'

import { useAdminOrderQueue } from '@/hooks/use-admin-order-queue'
import { OrderQueueToolbar } from './orders/order-queue-toolbar'
import { OrderQueueTable } from './orders/order-queue-table'

export default function AdminOrderQueue() {
  const queue = useAdminOrderQueue()
  return <section className="panel table-panel admin-table-panel"><div className="panel-heading"><div><p className="eyebrow">FULFILMENT WORKSPACE</p><h2>Live order queue</h2><p>Orders and fulfilment status from Supabase.</p></div><button className="secondary-button" onClick={() => void queue.load()} disabled={queue.loading}>{queue.loading ? 'Refreshing' : 'Refresh'}</button></div>{queue.error && <p className="low-stock" role="alert">{queue.error}</p>}<OrderQueueToolbar query={queue.query} setQuery={queue.setQuery} status={queue.status} setStatus={queue.setStatus} sort={queue.sort} setSort={queue.setSort} loading={queue.loading} orderCount={queue.visibleOrders.length} /><OrderQueueTable loading={queue.loading} visibleOrders={queue.visibleOrders} pageRows={queue.pageRows} page={queue.page} totalPages={queue.totalPages} setPage={queue.setPage} busy={queue.busy} updateStatus={queue.updateStatus} query={queue.query} status={queue.status} /></section>
}
