import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function getAdminComplaintDetail(supabase: ServerSupabase, complaintId: number) {
  if (!Number.isSafeInteger(complaintId) || complaintId === 0) return { data: null, error: 'Invalid complaint.' }
  const customer = complaintId < 0
  const { data, error } = customer
    ? await supabase.rpc('admin_customer_support_ticket_detail', { p_ticket_id: Math.abs(complaintId) })
    : await supabase.rpc('admin_complaint_detail', { p_complaint_id: complaintId })
  if (error || !data) return { data: null, error: error?.message ?? 'Complaint details unavailable.' }
  const raw = data as Record<string, unknown>
  const order = raw.order as Record<string, unknown> | null
  const orderId = Number(order?.order_id)
  let orderTimes: Record<string, unknown> | null = null
  if (orderId) {
    const { data: times } = await supabase.from('orders').select('status,delivery_slot,delivery_slot_start,delivery_slot_end,delivered_at').eq('id', orderId).maybeSingle()
    orderTimes = times as Record<string, unknown> | null
  }
  return { data: { ...raw, orderTimes }, error: '' }
}
