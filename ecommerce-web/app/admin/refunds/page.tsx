import { RefundQueue, type Refund } from '@/components/admin/refund-queue'
import { getAdminProfile } from '@/lib/admin-auth'
import { can } from '@/lib/permission-definitions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function RefundsPage() {
  const supabase = await createSupabaseServerClient()
  const profile = await getAdminProfile()
  const { data, error } = await supabase.from('refunds').select('*').order('created_at', { ascending: true })
  if (error) console.error('[admin-refunds] Failed to load refund queue:', error.message)
  const baseRows = (data ?? []) as unknown as Refund[]
  const refundIds = baseRows.map(row => row.id)
  const orderIds = [...new Set(baseRows.map(row => row.order_id))]
  const [itemsResult, eventsResult, ordersResult] = await Promise.all([
    refundIds.length ? supabase.from('refund_items').select('refund_id,quantity,amount,order_items(unit_price,products!order_items_product_id_fkey(name,product_images(storage_path,sort_order)))').in('refund_id', refundIds) : Promise.resolve({ data: [], error: null }),
    refundIds.length ? supabase.from('refund_events').select('refund_id,from_status,to_status,actor_id,actor_role,note,created_at').in('refund_id', refundIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? supabase.from('orders').select('id,total,user_id,payments(method,status,amount),addresses(label,line1,city,postal_code)').in('id', orderIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (itemsResult.error) console.error('[admin-refunds] Failed to load refund items:', itemsResult.error.message)
  if (eventsResult.error) console.error('[admin-refunds] Failed to load refund events:', eventsResult.error.message)
  if (ordersResult.error) console.error('[admin-refunds] Failed to load order details:', ordersResult.error.message)
  const itemsByRefund = new Map<number, NonNullable<Refund['refund_items']>>()
  type RefundItemData = NonNullable<Refund['refund_items']>[number]
  for (const item of (itemsResult.data ?? []) as unknown as Array<{ refund_id: number; quantity: number; amount: number; order_items: RefundItemData['order_items'] }>) {
    const list = itemsByRefund.get(item.refund_id) ?? []
    list.push({ quantity: item.quantity, amount: item.amount, order_items: item.order_items })
    itemsByRefund.set(item.refund_id, list)
  }
  const eventsByRefund = new Map<number, NonNullable<Refund['refund_events']>>()
  for (const event of (eventsResult.data ?? []) as unknown as Array<{ refund_id: number; from_status: string | null; to_status: string; actor_id: string | null; actor_role: string | null; note: string | null; created_at: string }>) {
    const list = eventsByRefund.get(event.refund_id) ?? []
    list.push({ from_status: event.from_status, to_status: event.to_status, actor_id: event.actor_id, actor_role: event.actor_role, note: event.note, created_at: event.created_at })
    eventsByRefund.set(event.refund_id, list)
  }
  type OrderData = Exclude<NonNullable<Refund['orders']>, unknown[]>
  const ordersById = new Map<number, OrderData>()
  for (const order of (ordersResult.data ?? []) as unknown as Array<{ id: number } & OrderData>) ordersById.set(order.id, order)
  const rows = baseRows.map(row => ({ ...row, refund_items: itemsByRefund.get(row.id) ?? [], refund_events: eventsByRefund.get(row.id) ?? [], orders: ordersById.get(row.order_id) ?? null }))
  const userIds = [...new Set(rows.map(row => row.requested_by).filter(Boolean))]
  let customerNames: Record<string, string> = {}
  if (userIds.length) {
    const users = await supabase.from('users').select('id,full_name').in('id', userIds)
    if (users.error) console.error('[admin-refunds] Failed to load customer names:', users.error.message)
    customerNames = Object.fromEntries((users.data ?? []).map(user => [user.id, user.full_name?.trim() || 'Customer']))
  }
  const permissions = {
    canDecide: can(profile?.role_name, 'refunds:decide'),
    canReceive: can(profile?.role_name, 'refunds:receive'),
    canPay: can(profile?.role_name, 'refunds:pay'),
  }
  return <RefundQueue initialRows={rows} initialCustomerNames={customerNames} initialError={error ? 'We couldn’t load refund requests. Please retry.' : ''} permissions={permissions} />
}
