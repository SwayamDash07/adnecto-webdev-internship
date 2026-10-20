import { AdminShell } from '@/components/admin/admin-shell'
import { Overview } from '@/components/admin/overview'
import { getAdminProfile } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { can } from '@/lib/permission-definitions'
import type { LateOrder, LowStock, Recent } from '@/types/admin-overview'
import { getAdminOverviewStats } from '@/lib/admin-overview-stats'

export default async function AdminPage() {
  const profile = await getAdminProfile()
  const supabase = await createSupabaseServerClient()
  const [{ data: recentRows, error: ordersError }, stats, managersResult] = await Promise.all([supabase.rpc('admin_list_orders'), getAdminOverviewStats(profile?.role_name ?? null), can(profile?.role_name, 'complaints:raise') ? supabase.rpc('admin_list_store_managers') : Promise.resolve({ data: [] })])
  const recent = (recentRows ?? []).map((row: { order_id: number; customer_name: string; total: number; status: string; created_at: string; delivery_slot_start: string | null; delivery_slot_end: string | null }) => ({ id: row.order_id, customer: row.customer_name, total: row.total, status: row.status, created_at: row.created_at, delivery_slot_start: row.delivery_slot_start, delivery_slot_end: row.delivery_slot_end })) as Recent[]
  let lateOrders: LateOrder[] = []
  let lowStock: LowStock[] = []
  let dataError = ordersError?.message ?? ''
  if (profile?.role_name && can(profile.role_name, 'reports:view')) {
    const [stock, late] = await Promise.all([supabase.from('dashboard_low_stock').select('*').limit(8), supabase.rpc('admin_list_late_orders')])
    if (stock.error) dataError ||= stock.error.message
    if (late.error) dataError ||= late.error.message
    lowStock = (stock.data ?? []) as LowStock[]
    lateOrders = (late.data ?? []).map((row: { order_id: number; customer_name: string; total: number; status: string; created_at: string; delivery_slot_start: string | null; delivery_slot_end: string | null; last_reminded_at: string | null; open_complaint_id: number | null }) => ({ id: row.order_id, customer: row.customer_name, total: row.total, status: row.status, created_at: row.created_at, delivery_slot_start: row.delivery_slot_start, delivery_slot_end: row.delivery_slot_end, last_reminded_at: row.last_reminded_at, open_complaint_id: row.open_complaint_id })) as LateOrder[]
  }
  const name = profile?.full_name?.trim() || 'there'
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()))
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date())
  return <AdminShell title={`Good ${greeting}, ${name}`} description={today}><Overview role={profile?.role_name ?? null} initialOrders={recent} initialLateOrders={lateOrders} initialLowStock={lowStock} initialError={dataError} initialSummary={stats.summary} initialYesterday={stats.yesterday} initialManagers={(managersResult.data ?? []) as { user_id: string; full_name: string }[]} /></AdminShell>
}
