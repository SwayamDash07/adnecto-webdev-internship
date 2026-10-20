'use server'

import { requireCustomerRoute } from '@/lib/customer-auth'

const SUPPORT_ORDERS_SELECT = 'id,status,total,created_at,delivered_at,delivery_slot,delivery_slot_start,delivery_slot_end,payments(method),refunds(status,amount,final_amount,reason),order_items(quantity,products!order_items_product_id_fkey(name,product_images(storage_path,sort_order)))'

export async function loadCustomerSupportOrders(page: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 0
  const { supabase } = await requireCustomerRoute('/customer/support')
  const { data, error } = await supabase.from('orders').select(SUPPORT_ORDERS_SELECT).order('created_at', { ascending: false }).range(safePage * 10, safePage * 10 + 9)
  return { data: data ?? [], error: error?.message ?? '' }
}

export async function loadCustomerSupportTickets() {
  const { supabase } = await requireCustomerRoute('/customer/support')
  const { data, error } = await supabase.rpc('customer_list_support_tickets')
  return { data: data ?? [], error: error?.message ?? '' }
}
