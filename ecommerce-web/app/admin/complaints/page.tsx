import { AdminShell } from '@/components/admin/admin-shell'
import { ComplaintsWorkspace } from '@/components/admin/complaints/complaints-workspace'
import { getAdminProfile } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { can } from '@/lib/permission-definitions'
import { getAdminComplaintDetail } from '@/lib/admin-complaint-data'
import type { Complaint } from '@/components/admin/complaints/complaints-workspace'
import type { ComplaintOrder } from '@/components/admin/complaints/ComplaintComposer'

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const rawComplaint = Array.isArray(params.complaint) ? params.complaint[0] : params.complaint
  const complaintKey = typeof rawComplaint === 'string' ? rawComplaint : null
  const numericId = complaintKey && /^-?\d+$/.test(complaintKey) ? Number(complaintKey) : null
  const keyedId = complaintKey?.match(/^([tc])-(\d+)$/)
  const selectedId = numericId && Number.isSafeInteger(numericId) && numericId !== 0
    ? numericId
    : keyedId && Number.isSafeInteger(Number(keyedId[2]))
      ? (keyedId[1] === 't' ? -1 : 1) * Number(keyedId[2])
      : null
  const profile = await getAdminProfile()
  const supabase = await createSupabaseServerClient()
  const canViewStaff = can(profile?.role_name, 'orders:view')
  const [staffResult, customerResult, unreadResult, managersResult, ordersResult, detailResult] = await Promise.all([
    canViewStaff ? supabase.rpc('admin_list_complaints') : Promise.resolve({ data: [], error: null }),
    supabase.rpc('admin_list_customer_support_tickets'),
    supabase.rpc('admin_list_unread_support_tickets'),
    supabase.rpc('admin_list_store_managers'),
    supabase.rpc('admin_list_orders'),
    selectedId !== null ? getAdminComplaintDetail(supabase, selectedId) : Promise.resolve({ data: null, error: '' }),
  ])
  const customers = (customerResult.data ?? []).map((raw: Record<string, unknown>) => ({ ...raw, complaint_id: -Number(raw.ticket_id), source: 'customer' as const, assigned_to: null, assigned_name: null, orders_status_at_filing: raw.current_order_status, raised_by_name: raw.customer_name }))
  const rows = [...(staffResult.data ?? []).map((row: Record<string, unknown>) => ({ ...row, source: 'staff' as const })), ...customers] as unknown as Complaint[]
  const error = staffResult.error?.message ?? customerResult.error?.message ?? ''
  const orders = (ordersResult.data ?? []).map((row: { order_id: number; customer_name: string; total: number; status: string }) => ({ order_id: row.order_id, customer_name: row.customer_name, total: row.total, status: row.status })) as ComplaintOrder[]
  return <AdminShell eyebrow="OPERATIONS" title="Complaints" description="Review order issues, coordinate resolutions, and keep every update on record."><ComplaintsWorkspace role={profile?.role_name ?? ''} initialRows={rows} initialUnreadTicketIds={(unreadResult.data ?? []).map(Number)} initialManagers={(managersResult.data ?? []) as { user_id: string; full_name: string }[]} initialOrders={orders} initialUserId={profile?.id ?? ''} initialError={error} initialSelectedId={selectedId} initialDetail={detailResult.data} initialDetailError={detailResult.error} /></AdminShell>
}
