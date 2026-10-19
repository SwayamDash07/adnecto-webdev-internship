'use client'

import { Search } from 'lucide-react'
import { orderStatuses } from '@/constants/admin-orders'
import type { AdminOrder, AdminOrderSort } from '@/types/admin-orders'

const quickStatuses = ['placed', 'accepted', 'picking', 'delivered', 'cancelled', 'refunded']
const quickFilters: [string, string][] = [['', 'All'], ...quickStatuses.map(item => [item, item.replaceAll('_', ' ')] as [string, string])]
const label = (status: string) => status.replaceAll('_', ' ')

export function OrderQueueToolbar({ query, setQuery, status, setStatus, sort, setSort, orders, loading, unfulfilledFilter, setUnfulfilledFilter, dateFilter, openRefundCount }: { query: string; setQuery: (value: string) => void; status: string; setStatus: (value: string) => void; sort: AdminOrderSort; setSort: (value: AdminOrderSort) => void; orders: AdminOrder[]; loading: boolean; unfulfilledFilter: boolean; setUnfulfilledFilter: (value: boolean) => void; dateFilter: string; openRefundCount: number }) {
  const countFor = (value: string) => value === '__refunds__' ? openRefundCount : value ? orders.filter(order => order.status === value).length : orders.length
  return <>
    <div className="order-queue-toolbar">
      <label className="order-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order or customer" aria-label="Search orders" /></label>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter orders by status"><option value="">All statuses</option><option value="__refunds__">Returns & refunds ({openRefundCount})</option>{orderStatuses.map(item => <option key={item} value={item}>{label(item)}</option>)}</select>
      <select value={sort} onChange={event => setSort(event.target.value as AdminOrderSort)} aria-label="Sort orders"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest value</option></select>
    </div>
    <div className="order-quick-filters" role="group" aria-label="Quick filter orders by status">
      {quickFilters.map(([value, name]) => <button type="button" key={value || 'all'} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => setStatus(value)}>{name}<span>{countFor(value)}</span></button>)}<button type="button" className={status==='__refunds__'?'active':''} aria-pressed={status==='__refunds__'} onClick={()=>setStatus('__refunds__')}>Returns & refunds<span>{openRefundCount}</span></button>
    </div>
    {(unfulfilledFilter || dateFilter === 'today') && <div className="order-applied-filters">{unfulfilledFilter&&<button onClick={()=>setUnfulfilledFilter(false)}>Unfulfilled orders <span>×</span></button>}{dateFilter==='today'&&<span>Today&apos;s orders</span>}</div>}
    <p className="order-result-count" aria-live="polite">{loading ? 'Loading orders…' : status==='__refunds__' ? `${openRefundCount} open returns and refunds` : `Showing ${orders.filter(order => (!query || `${order.order_id} ${order.customer_name} ${order.customer_email}`.toLowerCase().includes(query.toLowerCase())) && (!status || order.status === status) && (!unfulfilledFilter||['placed','accepted','picking','packed','out_for_delivery'].includes(order.status)) && (dateFilter!=='today'||new Date(order.created_at).toDateString()===new Date().toDateString())).length} orders`}</p>
  </>
}
