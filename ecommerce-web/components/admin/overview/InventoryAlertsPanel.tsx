import Link from 'next/link'
import { m } from 'framer-motion'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { panelMotion } from '@/constants/admin-overview'
import type { LowStock } from '@/types/admin-overview'

export function InventoryAlertsPanel({ loading, lowStock }: { loading: boolean; lowStock: LowStock[] }) {
  return <m.section className="panel inventory-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .2 }}><div className="panel-heading"><div><p className="eyebrow">STOCK HEALTH</p><h2>Inventory alerts</h2><p>Products at or below reorder level</p></div><Link className="link-button" href="/inventory">Inventory <ArrowRight size={14} /></Link></div><div className="order-list">{loading ? <div className="list-skeleton" /> : lowStock.length ? lowStock.map((item, index) => <m.div className="order-row inventory-row" key={item.product_id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}><span className="inventory-dot"><CircleAlert size={14} /></span><span><strong>{item.product_name}</strong><small>Reorder at {item.reorder_level}</small></span><b className="low-stock">{item.current_stock} left</b></m.div>) : <div className="inline-admin-empty healthy"><strong>Inventory is healthy</strong><span>No products need replenishment right now.</span></div>}</div></m.section>
}
