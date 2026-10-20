import { can } from '@/lib/permission-definitions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AdminSummary = { today_sales: number; today_orders: number; pending_deliveries: number; low_stock_items: number }
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
  const [summaryResult, yesterdayResult] = await Promise.all([summaryQuery, yesterdayQuery])
  return {
    summary: summaryResult.data as AdminSummary | null,
    yesterday: yesterdayResult.data as AdminDailySales | null,
  }
}
