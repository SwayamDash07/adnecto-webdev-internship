import Link from 'next/link'
import { m } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { panelMotion } from '@/constants/admin-overview'
import { money } from '@/lib/formatters'
import type { Recent } from '@/types/admin-overview'

export function RecentOrdersPanel({ loading, orders, ordersHref }: { loading: boolean; orders: Recent[]; ordersHref: string }) {
  return <m.section className="panel recent-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .08 }}><div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Recent orders</h2><p>Latest customer orders</p></div><Link className="link-button" href={ordersHref}>View all <ArrowRight size={14} /></Link></div><div className="order-list">{loading ? <div className="list-skeleton" /> : orders.length ? orders.slice(0, 6).map((order, index) => <m.div className="order-row admin-order-row" key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}><span className="avatar">{order.customer?.slice(0, 1).toUpperCase() || 'C'}</span><span><strong>Order #{order.id}</strong><small>{order.customer}</small></span><b>{money(order.total)}</b><em className={`status-pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</em></m.div>) : <div className="inline-admin-empty"><strong>No orders yet</strong><span>New customer orders will appear here.</span></div>}</div></m.section>
}
