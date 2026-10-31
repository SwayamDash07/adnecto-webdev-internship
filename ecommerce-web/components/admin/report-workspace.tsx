'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Download, PackageSearch, RefreshCw } from 'lucide-react'
import { AdminShell } from './admin-shell'
import { money } from '@/lib/formatters'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

export type SalesRow = { day: string; order_count: number; revenue: number }
export type ProductRow = { product_id: number; product_name: string; units_sold: number; revenue: number }
export type InventoryRow = { product_id: number; product_name: string; current_stock: number; reserved_stock: number; reorder_level: number; low_stock: boolean }
export type RefundReportRow = { refund_amount: number; refund_count: number; reason: string; reason_count: number; delivered_count: number; request_count: number; return_rate: number }
type Period = 'today' | '7' | '30' | 'month' | 'custom'
type InventoryState = 'all' | 'healthy' | 'low' | 'out'

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDate(value: string, withYear = true) { const date = new Date(`${value}T12:00:00`); const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${date.getDate()} ${months[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}` }
function compactMoney(value: number) { return `₹${Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}` }
function completeDailySeries(rows: SalesRow[], from: string, to: string) {
  const byDay = new Map(rows.map(row => [row.day, row]))
  const result: Array<SalesRow & { orders: number; label: string }> = []
  const current = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  while (current <= end) {
    const day = dateKey(current)
    const row = byDay.get(day)
    result.push({ day, revenue: Number(row?.revenue ?? 0), order_count: Number(row?.order_count ?? 0), orders: Number(row?.order_count ?? 0), label: formatDate(day, false) })
    current.setDate(current.getDate() + 1)
  }
  return result
}
export function ReportWorkspace({ initialData }: { initialData: { period: string; from: string; to: string; customFrom: string; customTo: string; sales: SalesRow[]; products: ProductRow[]; inventory: InventoryRow[]; refunds: RefundReportRow[]; error: string } }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [period, setPeriod] = useState<Period>(initialData.period as Period)
  const [customFrom, setCustomFrom] = useState(initialData.customFrom)
  const [customTo, setCustomTo] = useState(initialData.customTo)
  const [compare, setCompare] = useState(false)
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue')
  const [productMetric, setProductMetric] = useState<'revenue' | 'units'>('revenue')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [sales, setSales] = useState<SalesRow[]>(initialData.sales)
  const [products, setProducts] = useState<ProductRow[]>(initialData.products)
  const [inventory, setInventory] = useState<InventoryRow[]>(initialData.inventory)
  const [refunds, setRefunds] = useState<RefundReportRow[]>(initialData.refunds)
  const [error, setError] = useState(initialData.error)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date())
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<InventoryState>('all')
  const [inventorySort, setInventorySort] = useState<'state' | 'name' | 'available' | 'reserved' | 'reorder'>('state')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventoryPageSize, setInventoryPageSize] = useState(10)
  const [dailyPage, setDailyPage] = useState(1)

  const to = period === 'custom' ? customTo : dateKey(new Date())
  const from = useMemo(() => {
    const today = new Date()
    if (period === 'custom') return customFrom
    if (period === 'today') return dateKey(today)
    if (period === 'month') return dateKey(new Date(today.getFullYear(), today.getMonth(), 1))
    const start = new Date(today)
    start.setDate(start.getDate() - (Number(period) - 1))
    return dateKey(start)
  }, [period, customFrom])
  const dateDescription = `${formatDate(from)} – ${formatDate(to)}`

  useEffect(() => {
    setPeriod(initialData.period as Period)
    setCustomFrom(initialData.customFrom)
    setCustomTo(initialData.customTo)
    setSales(initialData.sales)
    setProducts(initialData.products)
    setInventory(initialData.inventory)
    setRefunds(initialData.refunds)
    setError(initialData.error)
    setLoading(false)
    setLastUpdated(new Date())
  }, [initialData.period, initialData.customFrom, initialData.customTo, initialData.sales, initialData.products, initialData.inventory, initialData.refunds, initialData.error])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('period', period)
      if (period === 'custom') { url.searchParams.set('from', customFrom); url.searchParams.set('to', customTo) }
      else { url.searchParams.delete('from'); url.searchParams.delete('to') }
      setLoading(true)
      startTransition(() => router.replace(url.pathname + url.search, { scroll: false }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [period, customFrom, customTo, router])
  useEffect(() => { setDailyPage(1) }, [from, to])
  function load() { setLoading(true); startTransition(() => router.refresh()) }
  useRealtimeReload('admin-reports-live', ['orders', 'order_items', 'inventory'], load)

  function exportCsv() {
    const rows = [['day', 'orders', 'revenue'], ...sales.map(row => [row.day, String(row.order_count), String(row.revenue)])]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `cartly-sales-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  function exportInventory() {
    const rows = [['product', 'available', 'reserved', 'reorder level', 'state'], ...inventory.map(row => [row.product_name, String(row.current_stock), String(row.reserved_stock), String(row.reorder_level), row.current_stock <= 0 ? 'Out of stock' : row.low_stock ? 'Low' : 'Healthy'])]
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `cartly-inventory-${dateKey(new Date())}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  const lowStockCount = inventory.filter(row => row.low_stock && row.current_stock > 0).length
  const outOfStockCount = inventory.filter(row => row.current_stock <= 0).length
  const chartData = completeDailySeries(sales, from, to)
  const rankedProducts = [...products].sort((a, b) => productMetric === 'revenue' ? Number(b.revenue) - Number(a.revenue) : Number(b.units_sold) - Number(a.units_sold))
  const shownProducts = rankedProducts.slice(0, showAllProducts ? rankedProducts.length : 5)
  const maxProductMetric = Math.max(...rankedProducts.map(item => Number(productMetric === 'revenue' ? item.revenue : item.units_sold)), 1)
  const refundAmount = refunds.reduce((sum, row) => sum + Number(row.refund_amount), 0)
  const refundCount = refunds.reduce((sum, row) => sum + Number(row.refund_count), 0)
  const requestCount = refunds[0]?.request_count ?? 0
  const deliveredCount = refunds[0]?.delivered_count ?? 0
  const returnRate = refunds[0]?.return_rate ?? 0
  const netRevenue = sales.reduce((sum, row) => sum + Number(row.revenue), 0)
  const refundShare = netRevenue > 0 ? refundAmount / netRevenue * 100 : 0
  const reasonRows = refunds.filter(row => Number(row.reason_count) > 0).sort((a, b) => Number(b.reason_count) - Number(a.reason_count))

  const filteredInventory = inventory.filter(row => {
    const matchesText = row.product_name.toLowerCase().includes(inventorySearch.trim().toLowerCase())
    const state = row.current_stock <= 0 ? 'out' : row.low_stock ? 'low' : 'healthy'
    return matchesText && (inventoryFilter === 'all' || inventoryFilter === state)
  }).sort((a, b) => {
    if (inventorySort === 'name') return a.product_name.localeCompare(b.product_name)
    if (inventorySort === 'available') return a.current_stock - b.current_stock
    if (inventorySort === 'reserved') return b.reserved_stock - a.reserved_stock
    if (inventorySort === 'reorder') return a.reorder_level - b.reorder_level
    const rank = (item: InventoryRow) => item.current_stock <= 0 ? 0 : item.low_stock ? 1 : 2
    return rank(a) - rank(b) || a.product_name.localeCompare(b.product_name)
  })
  const inventoryPages = Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize))
  const visibleInventory = filteredInventory.slice((inventoryPage - 1) * inventoryPageSize, inventoryPage * inventoryPageSize)
  const dailyPageSize = 7
  const dailyPages = Math.max(1, Math.ceil(chartData.length / dailyPageSize))
  const dailyRows = [...chartData].sort((a, b) => b.day.localeCompare(a.day)).slice((dailyPage - 1) * dailyPageSize, dailyPage * dailyPageSize)
  const presets: Array<[Period, string]> = [['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['month', 'This month'], ['custom', 'Custom']]
  const action = <div className="report-header-controls">
    <div className="report-presets" role="group" aria-label="Report date presets">{presets.map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div>
    {period === 'custom' && <div className="report-custom-range"><label><span className="sr-only">Start date</span><input aria-label="Start date" type="date" value={customFrom} max={customTo} onChange={event => setCustomFrom(event.target.value)} /></label><span>to</span><label><span className="sr-only">End date</span><input aria-label="End date" type="date" value={customTo} min={customFrom} max={dateKey(new Date())} onChange={event => setCustomTo(event.target.value)} /></label></div>}
    <button className="report-export-button" onClick={exportCsv} disabled={!sales.length}><Download size={15} />Export CSV</button>
    <div className="report-refresh-block"><button className="report-refresh-button" aria-label="Refresh reports" onClick={() => void load()}><RefreshCw size={16} /></button><span>Last updated {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
  </div>
  return <AdminShell eyebrow="ANALYTICS" title="Report centre" description={dateDescription} action={action}>
    {error && <div className="report-error" role="alert"><span>{error}</span><button className="report-outline-button" onClick={() => void load()}>Retry</button></div>}
    <div className="report-compare-row"><label className="report-switch"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} /><span aria-hidden="true" /><b>Compare to previous period</b></label><span>Comparison metrics aren’t available from the current report data.</span></div>

    <div className="report-main-grid">
      <section className="report-card report-sales-card"><div className="report-card-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>Sales by day</h2><p>Daily trend for {dateDescription}</p></div><div className="report-segment" role="group" aria-label="Sales chart metric"><button className={metric === 'revenue' ? 'active' : ''} onClick={() => setMetric('revenue')}>Revenue</button><button className={metric === 'orders' ? 'active' : ''} onClick={() => setMetric('orders')}>Orders</button></div></div>
        {loading ? <div className="report-chart-skeleton" /> : sales.length ? <><div className="report-chart" role="img" aria-label={`Sales chart displaying ${metric} by day for ${dateDescription}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 12, left: 2, bottom: 0 }}><defs><linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6355d3" stopOpacity={.22} /><stop offset="95%" stopColor="#6355d3" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#828ca0', fontSize: 11 }} minTickGap={24} /><YAxis tickLine={false} axisLine={false} width={62} tick={{ fill: '#828ca0', fontSize: 10 }} tickFormatter={value => metric === 'revenue' ? compactMoney(Number(value)) : String(value)} /><Tooltip formatter={(value, name) => [metric === 'revenue' ? money(Number(value)) : Number(value), metric === 'revenue' ? 'Revenue' : 'Orders']} labelFormatter={(_, payload) => payload?.[0]?.payload?.day ? formatDate(String(payload[0].payload.day)) : ''} contentStyle={{ border: '1px solid #e4e7f0', borderRadius: 11, boxShadow: '0 8px 28px #18244015', fontSize: 12 }} /><Area type="monotone" dataKey={metric} stroke="#6355d3" strokeWidth={2.5} fill="url(#reportRevenueFill)" activeDot={{ r: 5, strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></div><DailyBreakdown rows={dailyRows} page={dailyPage} pages={dailyPages} setPage={setDailyPage} /></> : <div className="report-empty"><CalendarDays size={23} /><strong>No sales in this period</strong><span>Try a different range to see sales activity.</span><button onClick={() => setPeriod('30')}>Try a different range</button></div>}
      </section>
      <section className="report-card report-products-card"><div className="report-card-heading"><div><p className="eyebrow">PRODUCT PERFORMANCE</p><h2>Top products</h2><p>Best performers in the selected period</p></div><div className="report-segment" role="group" aria-label="Top products metric"><button className={productMetric === 'revenue' ? 'active' : ''} onClick={() => setProductMetric('revenue')}>Revenue</button><button className={productMetric === 'units' ? 'active' : ''} onClick={() => setProductMetric('units')}>Units</button></div></div>
        {loading ? <div className="report-list-skeleton">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div> : shownProducts.length ? <div className="report-ranked-list">{shownProducts.map((row, index) => { const amount = Number(productMetric === 'revenue' ? row.revenue : row.units_sold); return <article className="report-ranked-product" key={row.product_id}><span className="report-rank">{index + 1}</span><span className="report-product-placeholder"><PackageSearch size={17} /></span><div className="report-product-info"><strong title={row.product_name}>{row.product_name}</strong><small>{row.units_sold} unit{Number(row.units_sold) === 1 ? '' : 's'} sold</small><span className="report-product-bar"><i style={{ width: `${Math.max(3, (amount / maxProductMetric) * 100)}%` }} /></span></div><strong className="report-product-value">{productMetric === 'revenue' ? money(Number(row.revenue)) : `${row.units_sold} unit${Number(row.units_sold) === 1 ? '' : 's'}`}</strong></article> })}{products.length > 5 && <button className="report-view-all" onClick={() => setShowAllProducts(value => !value)}>{showAllProducts ? 'Show top 5' : `View all ${products.length} products`}</button>}</div> : <div className="report-empty compact"><PackageSearch size={22} /><strong>No product sales in this period</strong></div>}
      </section>
    </div>

    <section className="report-card refund-report-card" aria-label="Refund and return report"><div className="report-card-heading"><div><p className="eyebrow">RETURNS</p><h2>Refunds and return rate</h2><p>Based on the same net revenue used across reporting</p></div><span className="refund-report-range">{dateDescription}</span></div><div className="refund-report-kpis"><article><small>Refunded</small><strong>{money(refundAmount)}</strong></article><article><small>Refund count</small><strong>{refundCount}</strong></article><article><small>Refunds / net revenue</small><strong>{refundShare.toFixed(1)}%</strong></article><article><small>Return rate</small><strong>{(Number(returnRate) * 100).toFixed(1)}%</strong><span>{requestCount} requests / {deliveredCount} delivered orders</span></article></div><div className="refund-report-reasons"><strong>Return reasons</strong>{reasonRows.length ? reasonRows.map(row => <div key={row.reason}><span>{row.reason}</span><b>{row.reason_count}</b></div>) : <p>No return requests in this period.</p>}</div></section>

    <section className="report-card report-inventory-card"><div className="report-card-heading report-inventory-heading"><div><p className="eyebrow">STOCK HEALTH</p><h2>Inventory report</h2><p>{inventory.length} products · {lowStockCount} low stock · {outOfStockCount} out of stock</p></div><button className="report-outline-button" onClick={exportInventory} disabled={!filteredInventory.length}><Download size={14} />Export</button></div>
      <div className="report-inventory-toolbar"><label className="report-search"><PackageSearch size={16} /><input value={inventorySearch} onChange={event => { setInventorySearch(event.target.value); setInventoryPage(1) }} placeholder="Search products" aria-label="Search inventory" /></label><select value={inventoryFilter} aria-label="Filter inventory state" onChange={event => { setInventoryFilter(event.target.value as InventoryState); setInventoryPage(1) }}><option value="all">All states</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></select><span className="report-filter-count">{filteredInventory.length} products</span></div>
      {loading ? <div className="report-table-skeleton">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div> : filteredInventory.length ? <><div className="report-inventory-table-wrap"><table className="report-inventory-table"><thead><tr><th><button onClick={() => setInventorySort('name')}>Product</button></th><th className="report-number"><button onClick={() => setInventorySort('available')}>Available</button></th><th className="report-number"><button onClick={() => setInventorySort('reserved')}>Reserved</button></th><th className="report-number"><button onClick={() => setInventorySort('reorder')}>Reorder level</button></th><th>Stock level</th><th><button onClick={() => setInventorySort('state')}>State</button></th></tr></thead><tbody>{visibleInventory.map(row => <InventoryTableRow key={row.product_id} row={row} />)}</tbody></table></div><div className="report-inventory-cards">{visibleInventory.map(row => <InventoryCard key={row.product_id} row={row} />)}</div><div className="report-pagination"><label>Rows per page<select value={inventoryPageSize} onChange={event => { setInventoryPageSize(Number(event.target.value)); setInventoryPage(1) }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><span>Page {inventoryPage} of {inventoryPages}</span><div><button disabled={inventoryPage <= 1} onClick={() => setInventoryPage(value => value - 1)}>Previous</button><button disabled={inventoryPage >= inventoryPages} onClick={() => setInventoryPage(value => value + 1)}>Next</button></div></div></> : <div className="report-empty compact"><PackageSearch size={22} /><strong>No inventory matches these filters</strong><button onClick={() => { setInventorySearch(''); setInventoryFilter('all') }}>Clear filters</button></div>}
    </section>
  </AdminShell>
}

function DailyBreakdown({ rows, page, pages, setPage }: { rows: SalesRow[]; page: number; pages: number; setPage: (page: number | ((current: number) => number)) => void }) {
  return <div className="report-daily-breakdown"><div className="report-breakdown-title"><strong>Daily breakdown</strong><span>{rows.length} days shown</span></div><div className="report-daily-head"><span>Date</span><span>Orders</span><span>Revenue</span></div>{rows.map(row => <div className="report-daily-row" key={row.day}><span>{formatDate(row.day, false)}</span><span>{row.order_count} order{Number(row.order_count) === 1 ? '' : 's'}</span><strong>{money(Number(row.revenue))}</strong></div>)}<div className="report-daily-pagination"><span>Page {page} of {pages}</span><div><button disabled={page <= 1} onClick={() => setPage(value => Number(value) - 1)}>Previous</button><button disabled={page >= pages} onClick={() => setPage(value => Number(value) + 1)}>Next</button></div></div></div>
}

function InventoryStatePill({ row }: { row: InventoryRow }) {
  const state = row.current_stock <= 0 ? 'out' : row.low_stock ? 'low' : 'healthy'
  const label = state === 'out' ? 'Out of stock' : state === 'low' ? 'Low stock' : 'Healthy'
  return <span className={`report-state-pill ${state}`}><i />{label}</span>
}
function InventoryProgress({ row }: { row: InventoryRow }) {
  const target = Math.max(1, row.reorder_level)
  return <div className={`report-stock-progress ${row.current_stock <= 0 ? 'out' : row.low_stock ? 'low' : ''}`} role="img" aria-label={`${row.current_stock} available, reorder level ${row.reorder_level}`}><i style={{ width: `${Math.min(100, Math.max(0, row.current_stock / target * 100))}%` }} /></div>
}
function InventoryTableRow({ row }: { row: InventoryRow }) {
  return <tr><td title={row.product_name}>{row.product_name}</td><td className="report-number">{row.current_stock}</td><td className="report-number">{row.reserved_stock}</td><td className="report-number">{row.reorder_level}</td><td><InventoryProgress row={row} /></td><td><InventoryStatePill row={row} /></td></tr>
}
function InventoryCard({ row }: { row: InventoryRow }) {
  return <article className="report-inventory-mobile-card"><div><strong>{row.product_name}</strong><InventoryStatePill row={row} /></div><InventoryProgress row={row} /><dl><div><dt>Available</dt><dd>{row.current_stock}</dd></div><div><dt>Reserved</dt><dd>{row.reserved_stock}</dd></div><div><dt>Reorder level</dt><dd>{row.reorder_level}</dd></div></dl></article>
}
