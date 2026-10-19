import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { money } from '@/lib/formatters'
import type { Recent } from '@/types/admin-overview'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (parts[0]?.slice(0, 2) || 'CU').toUpperCase()
}
function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function RecentOrdersPanel({ loading, orders, ordersHref }: { loading: boolean; orders: Recent[]; ordersHref: string }) {
  return <section className="panel recent-panel overview-recent-panel"><div className="panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent orders</h2><p>Most recently placed orders</p></div><Link className="link-button" href={ordersHref}>View all <ArrowRight size={14} /></Link></div><div className="order-list">{loading ? <div className="list-skeleton" /> : orders.length ? orders.slice(0, 6).map(order => <Link className="order-row admin-order-row overview-order-link" href={`${ordersHref}?search=${order.id}`} key={order.id}><span className="avatar" aria-hidden="true">{initials(order.customer || '')}</span><span className="overview-order-customer"><strong>Order #{order.id} · {order.customer}</strong><small>{relativeTime(order.created_at)}</small></span><b className="overview-order-total">{money(Number(order.total))}</b><span className={`order-status-pill order-status-${order.status.replaceAll('_', '-')}`}><i />{order.status.replaceAll('_', ' ')}</span></Link>) : <div className="inline-admin-empty"><strong>No orders yet</strong><span>New customer orders will appear here.</span></div>}</div></section>
}
