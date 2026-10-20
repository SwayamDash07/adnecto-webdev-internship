import { AdminShell } from '@/components/admin/admin-shell'
import AdminOrderQueue from '@/components/admin/admin-order-queue'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminOrder } from '@/types/admin-orders'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const [{ data: orders, error }, { data: refunds }] = await Promise.all([
    supabase.rpc('admin_list_orders'),
    supabase.from('refunds').select('order_id').in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'received']),
  ])
  return <AdminShell title="Order management" description="View and advance real customer orders through fulfilment."><AdminOrderQueue initialOrders={(orders ?? []) as AdminOrder[]} initialRefundOrderIds={[...new Set((refunds ?? []).map(row => Number(row.order_id)))]} initialError={error?.message ?? ''} initialNow={new Date().toISOString()} initialFilters={{ search: typeof params.search === 'string' ? params.search : '', date: typeof params.date === 'string' ? params.date : '', status: typeof params.status === 'string' ? params.status : '' }} /></AdminShell>
}
