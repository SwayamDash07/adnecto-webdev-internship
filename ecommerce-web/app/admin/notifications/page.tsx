import { AdminStaffMessages, type SentMessage, type StaffMessage, type Target } from '@/components/admin/admin-staff-messages'
import { getAdminProfile } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function NotificationsPage() {
  const profile = await getAdminProfile()
  const supabase = await createSupabaseServerClient()
  const isAdmin = profile?.role_name === 'super_admin'
  const [inboxResult, sentResult, targetsResult] = await Promise.all([
    supabase.rpc('staff_list_admin_messages'),
    isAdmin ? supabase.rpc('admin_list_sent_staff_messages') : Promise.resolve({ data: [], error: null }),
    isAdmin ? supabase.rpc('admin_list_staff_message_targets') : Promise.resolve({ data: [], error: null }),
  ])
  return <AdminStaffMessages initialRole={profile?.role_name ?? ''} initialInbox={(inboxResult.data ?? []) as StaffMessage[]} initialSent={(sentResult.data ?? []) as SentMessage[]} initialTargets={(targetsResult.data ?? []) as Target[]} initialErrors={{ inbox: inboxResult.error?.message ?? '', sent: sentResult.error?.message ?? '', targets: targetsResult.error?.message ?? '' }} />
}
