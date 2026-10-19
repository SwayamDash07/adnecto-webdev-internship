import { AdminShell } from '@/components/admin/admin-shell'
import AdminOrderQueue from '@/components/admin/admin-order-queue'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminOrder } from '@/types/admin-orders'

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: orders, error }, { data: refunds }] = await Promise.all([
    supabase.rpc('admin_list_orders'),
    supabase.from('refunds').select('order_id').in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'received']),
  ])
  return <AdminShell title="Order management" description="View and advance real customer orders through fulfilment."><AdminOrderQueue initialOrders={(orders ?? []) as AdminOrder[]} initialRefundOrderIds={[...new Set((refunds ?? []).map(row => Number(row.order_id)))]} initialError={error?.message ?? ''} initialNow={new Date().toISOString()} /></AdminShell>
}
