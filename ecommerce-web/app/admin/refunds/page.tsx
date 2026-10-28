import Link from 'next/link'
import { AdminShell } from '@/components/admin/admin-shell'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function RefundsPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('refunds').select('id,order_id,type,status,reason,amount,final_amount,created_at,pickup_slot,orders(total,user_id,payments(method))').order('created_at', { ascending: true })
  const rows = data ?? []
  const count = (statuses: string[]) => rows.filter(row => statuses.includes(row.status)).length
  const money = (amount: number) => `₹${Number(amount).toFixed(2)}`
  const portalOrders = `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}/orders`
  return <AdminShell title="Returns & refunds" description="Review customer requests and follow each return through its refund.">
    <section className="report-kpi-grid" aria-label="Refund summary">
      {[['Requested', count(['requested'])], ['In pickup', count(['approved','pickup_scheduled','picked_up'])], ['To refund', count(['received','approved'])], ['Refunded this week', count(['refunded'])], ['Refunded total this month', rows.filter(row => row.status === 'refunded').reduce((sum,row) => sum + Number(row.final_amount ?? row.amount),0)]].map(([label,value]) => <article className="report-kpi-card" key={String(label)}><span>{label}</span><strong>{typeof value === 'number' && String(label).includes('total') ? money(value) : value}</strong></article>)}
    </section>
    {error ? <section className="panel"><p>We couldn’t load refund requests.</p><Link href={portalOrders.replace(/orders$/, 'refunds')}>Retry</Link></section> : rows.length ? <section className="panel table-panel"><div className="inventory-table"><div className="table-head"><span>Request #</span><span>Order</span><span>Type</span><span>Reason</span><span>Amount</span><span>Status</span><span>Age</span><span>Actions</span></div>{rows.map(row => <div className="table-row" key={row.id}><strong>RF-{row.id}</strong><Link href={`${portalOrders}?status=__refunds__&order=${row.order_id}`}>#{row.order_id}</Link><span>{row.type === 'return_and_refund' ? 'Return and refund' : 'Refund only'}</span><span>{row.reason}</span><span>{money(Number(row.final_amount ?? row.amount))}</span><span className={`refund-status-pill ${row.status}`}>{row.status.replaceAll('_',' ')}</span><span>{Math.max(0,Math.floor((Date.now()-Date.parse(row.created_at))/86400000))}d</span><Link href={`${portalOrders}?status=__refunds__&order=${row.order_id}`}>Open details</Link></div>)}</div></section> : <section className="panel"><h2>No return or refund requests</h2><p>New requests will appear here.</p></section>}
  </AdminShell>
}
