import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrders } from '@/components/customer/customer-orders'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const ORDER_LIST_SELECT = 'id,address_id,status,total,created_at,delivered_at,refund_pricing_complete,delivery_slot,delivery_slot_start,delivery_slot_end,addresses(label,line1,city,postal_code),payments(method),refunds(id,amount,final_amount,fee_amount,status,type,pickup_slot,picked_up_at,received_at,reason,decision_note,created_at,decided_at,refund_events(to_status,note,created_at)),order_items(id,quantity,unit_price,gst_amount,discount_amount,products!order_items_product_id_fkey(name,is_returnable,product_images(storage_path,sort_order)))'

export default async function CustomerOrdersPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false }),
  ])
  return <CustomerPage title="Your orders" description="Track active deliveries and revisit everything you have purchased." cards={[]}><CustomerOrders initialOrders={(data ?? []) as never[]} initialError={error?.message ?? ''} userId={user?.id ?? null} initialNow={new Date().toISOString()} /></CustomerPage>
}
