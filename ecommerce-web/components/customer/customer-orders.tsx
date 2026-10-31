'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, MapPin, Package, Truck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'

type ProductImage = { storage_path: string; sort_order: number | null }
type OrderItem = {
  id: number
  quantity: number
  unit_price: number
  products: { name: string; product_images: ProductImage[] | null } | { name: string; product_images: ProductImage[] | null }[] | null
}
type OrderAddress = { label: string | null; line1: string; city: string; postal_code: string } | { label: string | null; line1: string; city: string; postal_code: string }[] | null
type Order = { id: number; status: string; total: number; express_fee: number; delivery_speed: string; created_at: string; delivery_slot: string | null; delivery_slot_start:string|null; delivery_slot_end:string|null; addresses: OrderAddress; order_items: OrderItem[] | null }
type OrderTab = 'shipping' | 'arrived' | 'cancelled'

const tabForStatus = (status: string): OrderTab => {
  if (status === 'delivered') return 'arrived'
  if (['cancelled', 'returned', 'refunded'].includes(status)) return 'cancelled'
  return 'shipping'
}
const statusLabel = (status: string) => status.replaceAll('_', ' ')
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null

export function CustomerOrders({ initialOrders, initialError = '', userId, initialNow }: { initialOrders: Order[]; initialError?: string; userId: string | null; initialNow: string }) {
  const router = useRouter()
  const now = useIstNow(initialNow)
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<OrderTab>('shipping')
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())

  useEffect(() => { setOrders(initialOrders); setError(initialError) }, [initialOrders, initialError])

  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client || !userId) return
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => router.refresh(), 300) }
    const channel = client.channel(`customer-orders-${userId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe()
    return () => { if (refreshTimer) clearTimeout(refreshTimer); void client.removeChannel(channel) }
  }, [router, userId])

  const groupedOrders = useMemo(() => ({
    shipping: orders.filter(order => tabForStatus(order.status) === 'shipping'),
    arrived: orders.filter(order => tabForStatus(order.status) === 'arrived'),
    cancelled: orders.filter(order => tabForStatus(order.status) === 'cancelled'),
  }), [orders])

  async function cancel(orderId: number) {
    if (!window.confirm('Cancel this order? A prepaid order will receive a demo refund.')) return
    setBusy(orderId); setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setBusy(null); return }
    const { error: cancelError } = await client.rpc('customer_cancel_order', { p_order_id: orderId })
    if (cancelError) { console.error('[customer-orders] Cancel order failed:', cancelError.message); setError('We couldn’t cancel this order. Please retry or contact support.') }
    else router.refresh()
    setBusy(null)
  }

  const currentOrders = groupedOrders[activeTab]
  return <section className="customer-orders">
    <div className="orders-controls"><div className="orders-tabs" role="tablist" aria-label="Filter orders">
      <button className={activeTab === 'shipping' ? 'active' : ''} role="tab" aria-selected={activeTab === 'shipping'} onClick={() => setActiveTab('shipping')}><Truck size={16} />On shipping <span>{groupedOrders.shipping.length}</span></button>
      <button className={activeTab === 'arrived' ? 'active' : ''} role="tab" aria-selected={activeTab === 'arrived'} onClick={() => setActiveTab('arrived')}><CheckCircle2 size={16} />Arrived <span>{groupedOrders.arrived.length}</span></button>
      <button className={activeTab === 'cancelled' ? 'active' : ''} role="tab" aria-selected={activeTab === 'cancelled'} onClick={() => setActiveTab('cancelled')}><Package size={16} />Cancelled <span>{groupedOrders.cancelled.length}</span></button>
    </div><button className="secondary-button orders-refresh" onClick={() => router.refresh()}>Refresh</button></div>
    {error && <p className="low-stock" role="alert">{error}<button type="button" className="link-button" onClick={()=>router.refresh()}>Retry</button></p>}
    {currentOrders.length ? <div className="customer-order-list">{currentOrders.map(order => {
      const firstItem = order.order_items?.[0]
      const product = one(firstItem?.products)
      const imagePath = [...(product?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
      const image = imagePath ? uncroppedProductImage(imagePath) : null
      const address = one(order.addresses)
      const slot = formatDeliverySlot(order, now)
      const hasMoreItems = Boolean(order.order_items && order.order_items.length > 1)
      const isExpanded = expandedOrders.has(order.id)
      const toggleExpanded = () => setExpandedOrders(current => {
        const next = new Set(current)
        if (next.has(order.id)) next.delete(order.id)
        else next.add(order.id)
        return next
      })
      return <article className={`customer-order-card${isExpanded ? ' expanded' : ''}`} key={order.id}>
        <div className="customer-order-top"><div className="customer-order-number"><Package size={16} /><strong>Order #{order.id}</strong><span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</span></div><span className={`order-status-pill ${tabForStatus(order.status)}`}>{statusLabel(order.status)}</span></div>
        <div className="customer-order-route"><span><MapPin size={14} />{address?.city || 'Delivery address'}</span><span className="route-dots" aria-hidden="true"></span><span><MapPin size={14} />{address?.label || 'Your address'}</span></div>
        <div className="customer-order-product">
          <div className="customer-order-photo">{image ? <img src={image} alt={product?.name || 'Ordered product'} /> : <Package size={28} />}</div>
          <div className="customer-order-product-info"><strong>{product?.name || 'Order items'}</strong><span>{money(Number(firstItem?.unit_price ?? order.total))} × {firstItem?.quantity ?? order.order_items?.length ?? 1}</span>{hasMoreItems && <button type="button" className="customer-order-more-items" aria-expanded={isExpanded} onClick={toggleExpanded}>{isExpanded ? 'Show less' : `+${order.order_items!.length - 1} more item${order.order_items!.length === 2 ? '' : 's'} in this order`}</button>}</div>
          {slot.display && <span className="customer-order-slot"><CalendarDays size={14} />{slot.display}{order.delivery_speed === 'express' && <span className="express-order-chip">Express</span>}</span>}
        </div>
        {isExpanded && hasMoreItems && <div className="customer-order-expanded-items" aria-label="All items in this order">{order.order_items!.slice(1).map((item, index) => {
          const itemProduct = one(item.products)
          const itemImagePath = [...(itemProduct?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
          const itemImage = itemImagePath ? uncroppedProductImage(itemImagePath) : null
          return <div className="customer-order-item" key={`${order.id}-${index + 1}`}>
            <div className="customer-order-photo">{itemImage ? <img src={itemImage} alt={itemProduct?.name || 'Ordered product'} /> : <Package size={24} />}</div>
            <div className="customer-order-product-info"><strong>{itemProduct?.name || 'Ordered product'}</strong><span>{money(Number(item.unit_price))} × {item.quantity}</span></div>
          </div>
        })}</div>}
        <div className="customer-order-footer"><strong>{order.express_fee > 0 && <small className="customer-order-express-fee">Express delivery · {money(Number(order.express_fee))}</small>}Total: {money(Number(order.total))}</strong><div><Link className="link-button" href={`/customer/support/chat/new?order=${order.id}`}>Need help?</Link><Link className="secondary-button" href={`/customer/orders/tracking?id=${order.id}`}>Details</Link>{['placed', 'accepted'].includes(order.status) && <button className="link-button" disabled={busy === order.id} onClick={() => void cancel(order.id)}>{busy === order.id ? 'Cancelling…' : 'Cancel order'}</button>}</div></div>
      </article>
    })}</div> : <section className="orders-empty"><span>{activeTab === 'shipping' ? <Truck size={24} /> : activeTab === 'arrived' ? <CheckCircle2 size={24} /> : <Package size={24} />}</span><h3>{activeTab === 'shipping' ? 'No orders on the way' : activeTab === 'arrived' ? 'No delivered orders yet' : 'No cancelled orders'}</h3><p>{orders.length ? 'Orders in this section will show up here.' : 'Your orders will appear here after checkout.'}</p>{!orders.length && <Link href="/" className="primary-button">Browse products</Link>}</section>}
  </section>
}
