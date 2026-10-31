import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrders } from '@/components/customer/customer-orders'
import { requireCustomerRoute } from '@/lib/customer-auth'

const ORDER_LIST_SELECT = 'id,status,total,created_at,delivery_slot,delivery_slot_start,delivery_slot_end,delivery_speed,express_fee,addresses(label,line1,city,postal_code),order_items(id,quantity,unit_price,products!order_items_product_id_fkey(name,product_images(storage_path,sort_order)))'

export default async function CustomerOrdersPage() {
  const { supabase, user } = await requireCustomerRoute('/customer/orders')
  const { data, error } = await supabase.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false })
  if (error) console.error('[customer-orders] Failed to load order list:', error.message)
  return <CustomerPage title="Your orders" description="Track active deliveries and revisit everything you have purchased." cards={[]}><CustomerOrders initialOrders={(data ?? []) as never[]} initialError={error ? 'We couldn’t load your orders. Please retry.' : ''} userId={user.id} initialNow={new Date().toISOString()} /></CustomerPage>
}
