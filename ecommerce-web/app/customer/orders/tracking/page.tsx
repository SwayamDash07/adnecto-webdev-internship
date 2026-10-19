import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrderTracking } from '@/components/customer/customer-order-tracking'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const TRACKING_ORDER_SELECT = 'id,status,total,created_at,delivered_at,cancelled_at,delivery_slot,delivery_slot_start,delivery_slot_end,delivery_instructions,contactless_delivery,substitute_unavailable,address_id,refund_pricing_complete,address:addresses(label,line1,city,postal_code,delivery_instructions),payments(method,status,amount),order_items(id,product_id,quantity,unit_price,gst_amount,discount_amount,products!order_items_product_id_fkey(name,is_returnable,product_images(storage_path,sort_order))),refunds(id,amount,final_amount,fee_amount,status,type,pickup_slot,picked_up_at,received_at,reason,comment,decision_note,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items:order_items(id,product_id,products!order_items_product_id_fkey(name))),refund_events(to_status,note,created_at))'

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { id: rawId } = await searchParams
  const candidate = Array.isArray(rawId) ? rawId[0] : rawId
  const orderId = candidate && /^\d+$/.test(candidate) && Number(candidate) > 0 ? Number(candidate) : null
  const supabase = await createSupabaseServerClient()
  const result = orderId
    ? await supabase.from('orders').select(TRACKING_ORDER_SELECT).eq('id', orderId).maybeSingle()
    : { data: null, error: null }
  return <CustomerPage title="Track your order" description="Follow the current status and delivery details for your order." cards={[]}><CustomerOrderTracking key={orderId ?? 'none'} orderId={orderId} initialOrder={(result.data ?? null) as never} initialError={Boolean(result.error)} initialNow={new Date().toISOString()} /></CustomerPage>
}
