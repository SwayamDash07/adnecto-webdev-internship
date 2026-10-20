import { LiveSupportManager } from '@/components/admin/support/live-support-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminTicket } from '@/types/admin'

export default async function SupportPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_support_tickets')
  return <LiveSupportManager initialTickets={(data ?? []) as AdminTicket[]} initialError={error?.message ?? ''} />
}
