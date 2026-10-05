import { m } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PackageSearch } from 'lucide-react'
import { panelMotion } from '@/constants/admin-overview'
import { moneyTooltip } from '@/lib/admin/overview-formatters'
import type { TopProduct } from '@/types/admin-overview'

export function TopProductsChart({ loading, topProducts }: { loading: boolean; topProducts: TopProduct[] }) {
  return <m.section className="panel chart-panel" {...panelMotion} transition={{ ...panelMotion.transition, delay: .14 }}><div className="panel-heading"><div><p className="eyebrow">PRODUCT PERFORMANCE</p><h2>Top products</h2><p>Revenue leaders from live order items</p></div></div><div className="mini-chart">{loading ? <div className="chart-skeleton" /> : topProducts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 12, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#edf0f5" /><XAxis type="number" hide /><YAxis type="category" dataKey="product_name" width={105} tickLine={false} axisLine={false} tick={{ fill: '#626b82', fontSize: 10 }} tickFormatter={value => String(value).length > 17 ? `${String(value).slice(0, 17)}…` : String(value)} /><Tooltip cursor={{ fill: '#f8f8fc' }} contentStyle={{ border: '1px solid #e6e8f0', borderRadius: 10, fontSize: 11 }} formatter={moneyTooltip} /><Bar dataKey="revenue" fill="#6355d3" radius={[0, 5, 5, 0]} barSize={17} animationDuration={800} /></BarChart></ResponsiveContainer> : <div className="chart-empty"><PackageSearch size={22} /><strong>No product sales yet</strong><span>Product performance will appear after orders.</span></div>}</div></m.section>
}
