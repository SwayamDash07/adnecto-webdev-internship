import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerSupport } from '@/components/customer/customer-support'
import { requireCustomerRoute } from '@/lib/customer-auth'

const SUPPORT_ORDERS_SELECT = 'id,status,total,created_at,delivered_at,delivery_slot,delivery_slot_start,delivery_slot_end,payments(method),refunds(status,amount,final_amount,reason),order_items(quantity,products!order_items_product_id_fkey(name,product_images(storage_path,sort_order)))'

export default async function CustomerSupportPage({ searchParams }: { searchParams: Promise<{ order?: string | string[]; filter?: string | string[]; count?: string | string[]; q?: string | string[] }> }) {
  const [params, auth] = await Promise.all([searchParams, requireCustomerRoute('/customer/support')])
  const { supabase } = auth
  const [{ data: orders, error: orderError }, { data: tickets, error: ticketError }] = await Promise.all([
    supabase.from('orders').select(SUPPORT_ORDERS_SELECT).order('created_at', { ascending: false }).range(0, 9),
    supabase.rpc('customer_list_support_tickets'),
  ])
  const initialOrderId = Array.isArray(params.order) ? params.order[0] ?? '' : params.order ?? ''
  const rawFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter
  const initialFilter = ['open', 'in_progress', 'resolved'].includes(rawFilter ?? '') ? rawFilter! : 'all'
  const rawCount = Array.isArray(params.count) ? params.count[0] : params.count
  const parsedCount = Number(rawCount)
  const initialVisibleCount = Number.isInteger(parsedCount) && parsedCount >= 5 ? Math.min(parsedCount, 100) : 5
  const initialSearch = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? ''
  return <CustomerPage title="Customer support" description="Get help with an order, delivery, payment or product." cards={[]}><CustomerSupport initialOrders={(orders ?? []) as never[]} initialTickets={(tickets ?? []) as never[]} initialSelectedOrderId={initialOrderId} initialFilter={initialFilter} initialVisibleCount={initialVisibleCount} initialSearch={initialSearch} initialOrderError={orderError?.message ?? ''} initialTicketError={ticketError?.message ?? ''} initialNow={new Date().toISOString()} /></CustomerPage>
}
