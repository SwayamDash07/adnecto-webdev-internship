import { ReportWorkspace, type InventoryRow, type ProductRow, type RefundReportRow, type SalesRow } from '@/components/admin/report-workspace'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const today = dayKey(new Date())
  const period = ['today', '7', '30', 'month', 'custom'].includes(String(params.period)) ? String(params.period) : '30'
  const customTo = typeof params.to === 'string' ? params.to : today
  const customFrom = typeof params.from === 'string' ? params.from : dayKey(new Date(Date.now() - 6 * 86400000))
  const from = period === 'custom' ? customFrom : period === 'today' ? today : period === 'month' ? `${today.slice(0, 7)}-01` : dayKey(new Date(Date.now() - (Number(period) - 1) * 86400000))
  const to = period === 'custom' ? customTo : today
  const supabase = await createSupabaseServerClient()
  const [sales, products, inventory, refunds] = await Promise.all([
    supabase.rpc('admin_sales_report', { p_from: from, p_to: to }),
    supabase.rpc('admin_top_products_report', { p_from: from, p_to: to }),
    supabase.rpc('admin_inventory_report'),
    supabase.rpc('refund_report', { p_from: from, p_to: to }),
  ])
  const hasError = Boolean(sales.error || products.error || inventory.error || refunds.error)
  if (hasError) console.error('[admin-reports] Failed to load report data:', sales.error?.message ?? products.error?.message ?? inventory.error?.message ?? refunds.error?.message)
  const error = hasError ? 'Some report data could not be loaded. Please retry.' : ''
  return <ReportWorkspace initialData={{ period, from, to, customFrom, customTo, sales: (sales.data ?? []) as SalesRow[], products: (products.data ?? []) as ProductRow[], inventory: (inventory.data ?? []) as InventoryRow[], refunds: (refunds.data ?? []) as RefundReportRow[], error }} />
}
