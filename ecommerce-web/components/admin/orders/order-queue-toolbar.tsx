'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { orderStatuses } from '@/constants/admin-orders'
import type { AdminOrderSort } from '@/types/admin-orders'

export function OrderQueueToolbar({ query, setQuery, status, setStatus, sort, setSort, loading, orderCount }: { query: string; setQuery: (value: string) => void; status: string; setStatus: (value: string) => void; sort: AdminOrderSort; setSort: (value: AdminOrderSort) => void; loading: boolean; orderCount: number }) {
  return <div className="table-toolbar"><label className="table-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search order or customer" aria-label="Search orders" /></label><label className="table-filter"><SlidersHorizontal size={14} /><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter orders by status"><option value="">All statuses</option>{orderStatuses.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label><select className="table-sort" value={sort} onChange={event => setSort(event.target.value as AdminOrderSort)} aria-label="Sort orders"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest value</option></select><span className="table-count">{loading ? 'Loading orders' : `${orderCount} orders`}</span></div>
}
