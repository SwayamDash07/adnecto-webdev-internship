'use server'

import { requirePermission } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getStaffMessageRecipients(messageId: number) {
  await requirePermission('messages:send')
  if (!Number.isSafeInteger(messageId) || messageId < 1) return { rows: [], error: 'Invalid message.' }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_staff_message_recipients', { p_message_id: messageId })
  return { rows: data ?? [], error: error?.message ?? '' }
}
