import 'server-only'
import { can } from '@/lib/permission-definitions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminProfile } from '@/lib/admin-auth'
import type { AdminNotification } from '@/components/admin/admin-notifications-bell'

const notificationTypes = ['late_order_reminder', 'complaint_raised', 'complaint_updated', 'admin_message_done', 'admin_message_reminder']

export async function getAdminShellData(profile: AdminProfile) {
  const supabase = await createSupabaseServerClient()
  const canManageComplaints = can(profile.role_name, 'complaints:manage')
  const canViewNotifications = can(profile.role_name, 'notifications:view')
  const canViewRefunds = can(profile.role_name, 'refunds:view')
  const [complaints, customerTickets, messages, latest, unreadNotifications, refunds] = await Promise.all([
    canManageComplaints ? supabase.rpc('admin_list_complaints') : Promise.resolve({ data: [] }),
    canManageComplaints ? supabase.rpc('admin_list_customer_support_tickets') : Promise.resolve({ data: [] }),
    canViewNotifications ? supabase.rpc('staff_list_admin_messages') : Promise.resolve({ data: [] }),
    canViewNotifications ? supabase.from('notifications').select('id,type,title,body,message,order_id,complaint_id,read_at,created_at').in('type', notificationTypes).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    canViewNotifications ? supabase.from('notifications').select('id', { count: 'exact', head: true }).in('type', notificationTypes).is('read_at', null) : Promise.resolve({ count: 0 }),
    canViewRefunds ? supabase.from('refunds').select('id', { count: 'exact', head: true }).in('status', ['requested','approved','pickup_scheduled','picked_up','received']) : Promise.resolve({ count: 0 }),
  ])
  const openComplaints = [...(complaints.data ?? []), ...(customerTickets.data ?? [])].filter((row: { status?: string }) => row.status === 'open').length
  const unreadMessages = ((messages.data ?? []) as Array<{ read_at: string | null }>).filter(row => !row.read_at).length
  return {
    profile,
    openComplaints,
    openRefunds: refunds.count ?? 0,
    unreadMessages,
    notifications: (latest.data ?? []) as AdminNotification[],
    unreadNotifications: unreadNotifications.count ?? 0,
  }
}
