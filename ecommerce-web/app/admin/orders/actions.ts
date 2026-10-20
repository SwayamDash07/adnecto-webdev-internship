'use server'

import { requireAdminRoute } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getOrderRefunds(orderId: number) {
  await requireAdminRoute()
  if (!Number.isSafeInteger(orderId) || orderId < 1) return { data: [], error: 'Invalid order.' }
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('refunds')
    .select('id,amount,final_amount,type,pickup_slot,picked_up_at,received_at,item_condition,condition_note,status,reason,comment,decision_note,photo_paths,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items(products(name))),refund_events(to_status,note,created_at)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error: error?.message ?? '' }
}
