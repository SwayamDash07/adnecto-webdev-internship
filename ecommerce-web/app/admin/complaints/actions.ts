'use server'

import { requirePermission, type Permission } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireAdminRoute } from '@/lib/admin-auth'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; code?: string; existingId?: number }

export async function getComplaintDetail(complaintId: number) {
  await requireAdminRoute()
  if (!Number.isSafeInteger(complaintId) || complaintId === 0) return { data: null, error: 'Invalid complaint.' }
  const supabase = await createSupabaseServerClient()
  const customer = complaintId < 0
  const { data, error } = customer
    ? await supabase.rpc('admin_customer_support_ticket_detail', { p_ticket_id: Math.abs(complaintId) })
    : await supabase.rpc('admin_complaint_detail', { p_complaint_id: complaintId })
  if (error || !data) return { data: null, error: error?.message ?? 'Complaint details unavailable.' }
  const raw = data as Record<string, unknown>
  const order = (customer ? raw.order : (raw.order as Record<string, unknown> | null)) as Record<string, unknown> | null
  const orderId = Number(order?.order_id)
  let orderTimes: Record<string, unknown> | null = null
  if (orderId) {
    const { data: times } = await supabase.from('orders').select('status,delivery_slot,delivery_slot_start,delivery_slot_end,delivered_at').eq('id', orderId).maybeSingle()
    orderTimes = times as Record<string, unknown> | null
  }
  return { data: { ...raw, orderTimes }, error: '' }
}

async function clientFor(permission: Permission) {
  try { await requirePermission(permission) }
  catch { return { ok: false as const, error: 'You do not have permission to do that.' } }
  return { ok: true as const, client: await createSupabaseServerClient() }
}

function responseError(message: string): Result<never> {
  if (message.includes('DUPLICATE_OPEN_COMPLAINT')) { const existingId=Number(message.match(/DUPLICATE_OPEN_COMPLAINT:(\d+)/)?.[1]);return { ok: false, code: 'duplicate', existingId:Number.isFinite(existingId)?existingId:undefined, error: 'An open complaint already exists for this issue and order.' } }
  if (message.includes('REMINDER_COOLDOWN')) return { ok: false, code: 'cooldown', error: 'This order was reminded recently. Please wait 30 minutes before sending another reminder.' }
  if (message.includes('ORDER_NOT_LATE')) return { ok: false, error: 'This order is no longer eligible for a late reminder.' }
  if (message.includes('NO_STORE_MANAGERS')) return { ok: false, error: 'No store managers are available to receive notifications.' }
  if (message.includes('RESOLUTION_NOTE_REQUIRED')) return { ok: false, error: 'Add a resolution note before resolving this complaint.' }
  return { ok: false, error: message }
}

export async function notifyLateOrder(orderId: number, note: string): Promise<Result<string>> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || note.length > 200) return { ok: false, error: 'Check the order and note, then try again.' }
  const auth = await clientFor('notifications:send')
  if (!auth.ok) return { ok: false, error: auth.error }
  const { data, error } = await auth.client.rpc('admin_notify_late_order', { p_order_id: orderId, p_note: note.trim() })
  if (error) return responseError(error.message)
  return { ok: true, data: String(data) }
}

export async function raiseOrderComplaint(input: { orderId: number; issueType: string; severity: string; notes: string; assignedTo: string | null }): Promise<Result<number>> {
  if (!Number.isSafeInteger(input.orderId) || input.notes.trim().length < 1 || input.notes.length > 500) return { ok: false, error: 'Add a note of up to 500 characters and try again.' }
  const auth = await clientFor('complaints:raise')
  if (!auth.ok) return { ok: false, error: auth.error }
  const { data, error } = await auth.client.rpc('admin_raise_complaint', { p_order_id: input.orderId, p_issue_type: input.issueType, p_severity: input.severity, p_notes: input.notes.trim(), p_assigned_to: input.assignedTo || null })
  if (error) return responseError(error.message)
  return { ok: true, data: Number(data) }
}

export async function updateOrderComplaint(input: { complaintId: number; internal?:boolean; status: string | null; assignedTo: string | null; updateAssignment: boolean; comment: string; resolutionNote: string }): Promise<Result> {
  if (!Number.isSafeInteger(input.complaintId) || input.comment.length > 1000 || input.resolutionNote.length > 1000) return { ok: false, error: 'Check the update details and try again.' }
  const auth = await clientFor('complaints:manage')
  if (!auth.ok) return { ok: false, error: auth.error }
  if(input.complaintId<0){const {error}=await auth.client.rpc('admin_update_customer_support_ticket',{p_ticket_id:Math.abs(input.complaintId),p_status:input.status,p_comment:input.comment.trim()||null,p_internal:input.internal??false,p_resolution_note:input.resolutionNote.trim()||null});return error?responseError(error.message):{ok:true}}
  const { error } = await auth.client.rpc('admin_update_complaint', {
    p_complaint_id: input.complaintId,
    p_status: input.status,
    p_assigned_to: input.assignedTo || null,
    p_update_assignment: input.updateAssignment,
    p_comment: input.comment.trim() || null,
    p_resolution_note: input.resolutionNote.trim() || null,
  })
  return error ? responseError(error.message) : { ok: true }
}
