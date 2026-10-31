import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrderTracking } from '@/components/customer/customer-order-tracking'
import { requireCustomerRoute } from '@/lib/customer-auth'

const TRACKING_ORDER_SELECT = 'id,status,total,created_at,delivered_at,cancelled_at,delivery_slot,delivery_slot_start,delivery_slot_end,delivery_speed,express_fee,delivery_instructions,contactless_delivery,substitute_unavailable,address_id,refund_pricing_complete,address:addresses(label,line1,city,postal_code,delivery_instructions),payments(method,status,amount),order_items(id,product_id,quantity,unit_price,gst_amount,discount_amount,products!order_items_product_id_fkey(name,is_returnable,product_images(storage_path,sort_order))),refunds(id,amount,final_amount,fee_amount,status,type,pickup_slot,pickup_code,qr_payload,pickup_reschedules,refund_reference,refunded_at,expected_arrival_at,auto_approved,picked_up_at,received_at,reason,comment,decision_note,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items:order_items(id,product_id,products!order_items_product_id_fkey(name))),refund_events(to_status,note,actor_role,created_at))'

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { id: rawId } = await searchParams
  const candidate = Array.isArray(rawId) ? rawId[0] : rawId
  const orderId = candidate && /^\d+$/.test(candidate) && Number(candidate) > 0 ? Number(candidate) : null
  const { supabase } = await requireCustomerRoute(`/customer/orders/tracking${candidate ? `?id=${encodeURIComponent(candidate)}` : ''}`)
  const result = orderId
    ? await supabase.from('orders').select(TRACKING_ORDER_SELECT).eq('id', orderId).maybeSingle()
    : { data: null, error: null }
  if (result.error) console.error('[order-tracking] Failed to load order:', result.error.message)
  let eligibility: unknown[] = []
  let eligibilityError = false
  if (result.data?.status === 'delivered') {
    const response = await supabase.rpc('get_return_eligibility', { p_order_id: result.data.id })
    eligibility = response.data ?? []
    eligibilityError = Boolean(response.error)
    if (response.error) console.error('[order-tracking] Failed to load return eligibility:', response.error.message)
  }
  return <CustomerPage title="Track your order" description="Follow the current status and delivery details for your order." cards={[]}><CustomerOrderTracking key={orderId ?? 'none'} orderId={orderId} initialOrder={result.data ? { ...result.data, return_eligibility: eligibility, eligibility_error: eligibilityError } as never : null} initialError={Boolean(result.error)} initialNow={new Date().toISOString()} /></CustomerPage>
}
