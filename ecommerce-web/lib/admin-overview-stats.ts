import { can } from '@/lib/permission-definitions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AdminSummary = { today_sales: number; today_orders: number; pending_deliveries: number; low_stock_items: number; returns_to_review: number }
export type AdminDailySales = { day: string; revenue: number; orders: number }

export async function getAdminOverviewStats(role: string | null) {
  if (!can(role, 'reports:view')) return { summary: null, yesterday: null }
  const supabase = await createSupabaseServerClient()
  const canRevenue = can(role, 'revenue:view')
  const yesterdayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() - 86400000))
  const summaryQuery = supabase.from('dashboard_summary').select(canRevenue ? '*' : 'today_orders,pending_deliveries,low_stock_items').single()
  const yesterdayQuery = canRevenue
    ? supabase.from('dashboard_daily_sales').select('day,revenue,orders').eq('day', yesterdayKey).maybeSingle()
    : supabase.from('dashboard_daily_sales').select('day,orders').eq('day', yesterdayKey).maybeSingle()
  const returnsQuery = can(role, 'refunds:view') ? supabase.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'requested') : Promise.resolve({ count: 0, error: null })
  const [summaryResult, yesterdayResult, returnsResult] = await Promise.all([summaryQuery, yesterdayQuery, returnsQuery])
  if (returnsResult.error) console.error('[admin-overview] Failed to load refund review count:', returnsResult.error.message)
  // Supabase's inferred result for the conditional select above can be a
  // non-object error type. Normalize the selected view row before exposing it.
  const summaryData = summaryResult.data as unknown as Partial<AdminSummary> | null
  return {
    summary: summaryData ? {
      today_sales: Number(summaryData.today_sales ?? 0),
      today_orders: Number(summaryData.today_orders ?? 0),
      pending_deliveries: Number(summaryData.pending_deliveries ?? 0),
      low_stock_items: Number(summaryData.low_stock_items ?? 0),
      returns_to_review: returnsResult.count ?? 0,
    } : null,
    yesterday: yesterdayResult.data as AdminDailySales | null,
  }
}
