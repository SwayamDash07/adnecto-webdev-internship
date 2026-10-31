import { FulfilmentQueue, type FulfilmentOrder } from '@/components/admin/fulfilment-queue'
import { ReturnPickupQueue, type Pickup } from '@/components/admin/return-pickup-queue'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AdminDeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const [queue, pickups] = await Promise.all([
    supabase.rpc('admin_list_fulfilment_orders', { p_queue: 'delivery' }),
    supabase.from('refunds').select('id,order_id,type,amount,status,pickup_slot,pickup_code').in('status', ['pickup_scheduled', 'picked_up']).order('pickup_slot', { ascending: true }),
  ])
  if (queue.error) console.error('[delivery] Failed to load fulfilment queue:', queue.error.message)
  if (pickups.error) console.error('[delivery] Failed to load return pickups:', pickups.error.message)
  const baseRows = pickups.data ?? []
  const refundIds = baseRows.map(row => row.id)
  const orderIds = [...new Set(baseRows.map(row => row.order_id))]
  const [{ data: refundItems, error: itemsError }, { data: orders, error: ordersError }] = await Promise.all([
    refundIds.length ? supabase.from('refund_items').select('refund_id,order_item_id,quantity').in('refund_id', refundIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? supabase.from('orders').select('id,total,address_id').in('id', orderIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (itemsError) console.error('[delivery] Failed to load return pickup items:', itemsError.message)
  if (ordersError) console.error('[delivery] Failed to load return pickup orders:', ordersError.message)
  const orderItemIds = [...new Set((refundItems ?? []).map(item => item.order_item_id))]
  const { data: orderItems, error: orderItemsError } = orderItemIds.length
    ? await supabase.from('order_items').select('id,product_id').in('id', orderItemIds)
    : { data: [], error: null }
  if (orderItemsError) console.error('[delivery] Failed to load return pickup order items:', orderItemsError.message)
  const productIds = [...new Set((orderItems ?? []).map(item => item.product_id))]
  const addressIds = [...new Set((orders ?? []).map(order => order.address_id).filter((id): id is number => id != null))]
  const [{ data: products, error: productsError }, { data: addresses, error: addressesError }] = await Promise.all([
    productIds.length ? supabase.from('products').select('id,name').in('id', productIds) : Promise.resolve({ data: [], error: null }),
    addressIds.length ? supabase.from('addresses').select('id,label,line1,city,postal_code').in('id', addressIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (productsError) console.error('[delivery] Failed to load return pickup products:', productsError.message)
  if (addressesError) console.error('[delivery] Failed to load return pickup addresses:', addressesError.message)
  const productById = new Map((products ?? []).map(product => [product.id, product]))
  const orderItemById = new Map((orderItems ?? []).map(item => [item.id, item]))
  const addressById = new Map((addresses ?? []).map(address => [address.id, address]))
  const orderById = new Map((orders ?? []).map(order => [order.id, order]))
  const itemsByRefund = new Map<number, NonNullable<Pickup['refund_items']>>()
  for (const item of refundItems ?? []) {
    const productId = orderItemById.get(item.order_item_id)?.product_id
    const list = itemsByRefund.get(item.refund_id) ?? []
    list.push({ quantity: item.quantity, order_items: { products: productId == null ? null : productById.get(productId) ?? null } })
    itemsByRefund.set(item.refund_id, list)
  }
  const rows: Pickup[] = baseRows.map(row => {
    const order = orderById.get(row.order_id)
    return { ...row, refund_items: itemsByRefund.get(row.id) ?? [], orders: order ? { total: order.total, addresses: order.address_id == null ? null : addressById.get(order.address_id) ?? null } : null }
  })
  return <FulfilmentQueue queue="delivery" initialOrders={(queue.data ?? []) as FulfilmentOrder[]} initialError={queue.error ? 'We could not load the delivery queue. Please retry.' : ''} initialFilters={{ search: typeof params.search === 'string' ? params.search : '', status: typeof params.status === 'string' ? params.status : '', sort: typeof params.sort === 'string' ? params.sort : '' }} extraContent={<ReturnPickupQueue initialRows={rows} initialError={pickups.error ? 'Return pickups are temporarily unavailable.' : ''} />} />
}
