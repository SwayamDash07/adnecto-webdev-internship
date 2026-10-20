import { AdminShell } from '@/components/admin/admin-shell'
import { ComplaintsWorkspace } from '@/components/admin/complaints/complaints-workspace'
import { getAdminProfile } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { can } from '@/lib/permission-definitions'
import type { Complaint } from '@/components/admin/complaints/complaints-workspace'

export default async function ComplaintsPage() {
  const profile = await getAdminProfile()
  const supabase = await createSupabaseServerClient()
  const canViewStaff = can(profile?.role_name, 'orders:view')
  const [staffResult, customerResult, unreadResult, managersResult] = await Promise.all([
    canViewStaff ? supabase.rpc('admin_list_complaints') : Promise.resolve({ data: [], error: null }),
    supabase.rpc('admin_list_customer_support_tickets'),
    supabase.rpc('admin_list_unread_support_tickets'),
    supabase.rpc('admin_list_store_managers'),
  ])
  const customers = (customerResult.data ?? []).map((raw: Record<string, unknown>) => ({ ...raw, complaint_id: -Number(raw.ticket_id), source: 'customer' as const, assigned_to: null, assigned_name: null, orders_status_at_filing: raw.current_order_status, raised_by_name: raw.customer_name }))
  const rows = [...(staffResult.data ?? []).map((row: Record<string, unknown>) => ({ ...row, source: 'staff' as const })), ...customers] as unknown as Complaint[]
  const error = staffResult.error?.message ?? customerResult.error?.message ?? ''
  return <AdminShell eyebrow="OPERATIONS" title="Complaints" description="Review order issues, coordinate resolutions, and keep every update on record."><ComplaintsWorkspace role={profile?.role_name ?? ''} initialRows={rows} initialUnreadTicketIds={(unreadResult.data ?? []).map(Number)} initialManagers={(managersResult.data ?? []) as { user_id: string; full_name: string }[]} initialUserId={profile?.id ?? ''} initialError={error} /></AdminShell>
}
