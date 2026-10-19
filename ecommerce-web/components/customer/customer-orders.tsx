'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, MapPin, Package, Truck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { RefundRequestDialog } from './refund-request-dialog'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'

type ProductImage = { storage_path: string; sort_order: number | null }
type OrderItem = {
  id: number
  is_returnable:boolean
  quantity: number
  unit_price: number
  gst_amount: number
  discount_amount: number
  products: { name: string; is_returnable:boolean; product_images: ProductImage[] | null } | { name: string; is_returnable:boolean; product_images: ProductImage[] | null }[] | null
}
type OrderAddress = { label: string | null; line1: string; city: string; postal_code: string } | { label: string | null; line1: string; city: string; postal_code: string }[] | null
type Refund = { id: number; amount: number; final_amount:number|null; fee_amount:number; status: string; type:string; pickup_slot:string|null; picked_up_at:string|null; received_at:string|null; reason: string; decision_note: string | null; created_at: string; decided_at: string | null; refund_events:{to_status:string;note:string|null;created_at:string}[]|null }
type Order = { id: number; address_id:number|null; status: string; total: number; created_at: string; delivered_at: string | null; refund_pricing_complete:boolean; delivery_slot: string | null; delivery_slot_start:string|null; delivery_slot_end:string|null; addresses: OrderAddress; order_items: OrderItem[] | null; payments: { method: string }[] | null; refunds: Refund[] | null }
type OrderTab = 'shipping' | 'arrived' | 'cancelled'

const tabForStatus = (status: string): OrderTab => {
  if (status === 'delivered') return 'arrived'
  if (['cancelled', 'returned', 'refunded'].includes(status)) return 'cancelled'
  return 'shipping'
}
const statusLabel = (status: string) => status.replaceAll('_', ' ')
const returnSteps=['requested','approved','pickup_scheduled','picked_up','received','refunded']
function ReturnTracker({refund}:{refund:Refund}){const active=returnSteps.indexOf(refund.status);return <div className="return-tracker"><strong>Return status</strong><div>{returnSteps.map((step,index)=><span key={step} className={index<=active?'current':''}>{statusLabel(step)}</span>)}</div>{refund.status==='pickup_scheduled'&&refund.pickup_slot&&<small>Pickup: {refund.pickup_slot}</small>}{refund.status==='rejected'&&<span className="return-rejected-pill">Rejected</span>}{refund.refund_events?.map((event,index)=><small key={index}>{statusLabel(event.to_status)} · {new Date(event.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{event.note?` · ${event.note}`:''}</small>)}{refund.status==='rejected'&&<small>Staff note: {refund.decision_note}</small>}</div>}
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null

export function CustomerOrders({ initialOrders, initialError = '', userId, initialNow }: { initialOrders: Order[]; initialError?: string; userId: string | null; initialNow: string }) {
  const now = useIstNow(initialNow)
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [initialLoading, setInitialLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<OrderTab>('shipping')
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [toast, setToast] = useState('')

  async function load() {
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Orders are unavailable right now.'); setInitialLoading(false); return }
    const { data, error: queryError } = await client.from('orders')
      .select('id,address_id,status,total,created_at,delivered_at,refund_pricing_complete,delivery_slot,delivery_slot_start,delivery_slot_end,addresses(label,line1,city,postal_code),payments(method),refunds(id,amount,final_amount,fee_amount,status,type,pickup_slot,picked_up_at,received_at,reason,decision_note,created_at,decided_at,refund_events(to_status,note,created_at)),order_items(id,quantity,unit_price,gst_amount,discount_amount,products!order_items_product_id_fkey(name,is_returnable,product_images(storage_path,sort_order)))')
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else { setError(''); setOrders((data ?? []) as unknown as Order[]) }
    setInitialLoading(false)
  }

  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client || !userId) return
    const channel = client.channel(`customer-orders-${userId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: `requested_by=eq.${userId}` }, () => { void load() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [userId])

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
    if (cancelError) setError(cancelError.message)
    else await load()
    setBusy(null)
  }

  async function cancelReturn(refundId:number) { setBusy(refundId); const client=createSupabaseBrowserClient(); if(!client){setBusy(null);return} const {error}=await client.rpc('cancel_return_request',{p_refund_id:refundId}); if(error)setError(error.message); else await load(); setBusy(null) }

  const currentOrders = groupedOrders[activeTab]
  return <section className="customer-orders">
    <div className="orders-controls"><div className="orders-tabs" role="tablist" aria-label="Filter orders">
      <button className={activeTab === 'shipping' ? 'active' : ''} role="tab" aria-selected={activeTab === 'shipping'} onClick={() => setActiveTab('shipping')}><Truck size={16} />On shipping <span>{groupedOrders.shipping.length}</span></button>
      <button className={activeTab === 'arrived' ? 'active' : ''} role="tab" aria-selected={activeTab === 'arrived'} onClick={() => setActiveTab('arrived')}><CheckCircle2 size={16} />Arrived <span>{groupedOrders.arrived.length}</span></button>
      <button className={activeTab === 'cancelled' ? 'active' : ''} role="tab" aria-selected={activeTab === 'cancelled'} onClick={() => setActiveTab('cancelled')}><Package size={16} />Cancelled <span>{groupedOrders.cancelled.length}</span></button>
    </div><button className="secondary-button orders-refresh" onClick={() => void load()}>Refresh</button></div>
    {error && <p className="low-stock" role="alert">{error}<button type="button" className="link-button" onClick={()=>void load()}>Retry</button></p>}
    {initialLoading ? <div className="customer-order-list" aria-label="Loading orders" aria-busy="true">{Array.from({length:2},(_,index)=><article className="customer-order-skeleton" key={index}><i/><i/><i/></article>)}</div> : currentOrders.length ? <div className="customer-order-list">{currentOrders.map(order => {
      const firstItem = order.order_items?.[0]
      const product = one(firstItem?.products)
      const firstItemReturnable = one(firstItem?.products)?.is_returnable ?? true
      const orderItems = order.order_items ?? []
      const hasReturnableItems = orderItems.some(item => one(item.products)?.is_returnable ?? true)
      const allItemsNonReturnable = orderItems.length > 0 && !hasReturnableItems
      const imagePath = [...(product?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
      const image = imagePath ? uncroppedProductImage(imagePath) : null
      const address = one(order.addresses)
      const slot = formatDeliverySlot(order, now)
      const hasMoreItems = Boolean(order.order_items && order.order_items.length > 1)
      const refundWindowOpen = Boolean(order.delivered_at && now.getTime() - Date.parse(order.delivered_at) <= 7 * 24 * 60 * 60 * 1000)
      const prepaid = (order.payments ?? []).some(payment => !['cod', 'cash on delivery'].includes(payment.method.toLowerCase()))
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
          <div className="customer-order-product-info"><strong>{product?.name || 'Order items'}</strong><span>{money(Number(firstItem?.unit_price ?? order.total))} × {firstItem?.quantity ?? order.order_items?.length ?? 1}</span>{!firstItemReturnable && <small className="customer-item-returnability">Not returnable</small>}{hasMoreItems && <button type="button" className="customer-order-more-items" aria-expanded={isExpanded} onClick={toggleExpanded}>{isExpanded ? 'Show less' : `+${order.order_items!.length - 1} more item${order.order_items!.length === 2 ? '' : 's'} in this order`}</button>}</div>
          {slot.display && <span className="customer-order-slot"><CalendarDays size={14} />{slot.display}</span>}
        </div>
        {isExpanded && hasMoreItems && <div className="customer-order-expanded-items" aria-label="All items in this order">{order.order_items!.slice(1).map((item, index) => {
          const itemProduct = one(item.products)
          const itemImagePath = [...(itemProduct?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
          const itemImage = itemImagePath ? uncroppedProductImage(itemImagePath) : null
          return <div className="customer-order-item" key={`${order.id}-${index + 1}`}>
            <div className="customer-order-photo">{itemImage ? <img src={itemImage} alt={itemProduct?.name || 'Ordered product'} /> : <Package size={24} />}</div>
            <div className="customer-order-product-info"><strong>{itemProduct?.name || 'Ordered product'}</strong><span>{money(Number(item.unit_price))} × {item.quantity}</span>{!(itemProduct?.is_returnable ?? true) && <small className="customer-item-returnability">Not returnable</small>}</div>
          </div>
        })}</div>}
        <div className="customer-order-footer"><strong>Total: {money(Number(order.total))}</strong><div><Link className="link-button" href={`/customer/support/chat/new?order=${order.id}`}>Need help?</Link><Link className="secondary-button" href={`/customer/orders/tracking?id=${order.id}`}>Details</Link>{['placed', 'accepted'].includes(order.status) && <button className="link-button" disabled={busy === order.id} onClick={() => void cancel(order.id)}>{busy === order.id ? 'Cancelling…' : 'Cancel order'}</button>}</div></div>
        {activeTab === 'cancelled' && (prepaid || (Boolean(order.delivered_at)&&(order.refunds??[]).length>0)) && (order.refunds ?? []).map(refund => <div className="customer-refund-line" key={refund.id}><strong>Refund of {money(Number(refund.final_amount??refund.amount))}</strong><span className={`refund-status-pill ${refund.status}`}>{refund.status}</span>{refund.status === 'refunded' && <span>on {new Date(refund.decided_at ?? refund.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}</span>}</div>)}
        {(order.refunds??[]).filter(r=>r.type==='return_and_refund').map(refund=><ReturnTracker key={refund.id} refund={refund}/>)}
        {activeTab === 'arrived' && <div className="customer-refund-action">{(() => { const active = (order.refunds ?? []).find(r => r.type === 'return_and_refund' && !['rejected','refunded','cancelled'].includes(r.status)); if (active) return <><Link className="secondary-button" href={`/customer/orders/tracking?id=${order.id}`}>View return status</Link>{active.status === 'requested' && <button type="button" className="link-button" disabled={busy === active.id} onClick={() => void cancelReturn(active.id)}>Cancel return request</button>}</>; if (!refundWindowOpen) return <span>Return window closed</span>; if (allItemsNonReturnable) return <span className="customer-return-unavailable">This order contains only non-returnable items. Refunds may still be requested for damaged, wrong, or incorrectly described items.</span>; return <><button type="button" className="secondary-button" onClick={() => setRefundOrder(order)}>Return or refund</button>{orderItems.some(item => !(one(item.products)?.is_returnable ?? true)) && <span className="customer-return-hint">Some items in this order are not returnable. Eligible items are marked in the request form.</span>}</> })()}{(order.refunds ?? []).filter(refund => refund.status === 'rejected').map(refund => <span key={refund.id} className="customer-refund-line"><strong>Refund rejected</strong>: {refund.decision_note} · <Link href="/customer/support">Contact support</Link></span>)}</div>}
      </article>
    })}</div> : <section className="orders-empty"><span>{activeTab === 'shipping' ? <Truck size={24} /> : activeTab === 'arrived' ? <CheckCircle2 size={24} /> : <Package size={24} />}</span><h3>{activeTab === 'shipping' ? 'No orders on the way' : activeTab === 'arrived' ? 'No delivered orders yet' : 'No cancelled orders'}</h3><p>{orders.length ? 'Orders in this section will show up here.' : 'Your orders will appear here after checkout.'}</p>{!orders.length && <Link href="/" className="primary-button">Browse products</Link>}</section>}
    {toast && <div className="refund-toast" role="status" aria-live="polite">{toast}</div>}
    {refundOrder && <RefundRequestDialog orderId={refundOrder.id} addressId={refundOrder.address_id} pickupAddress={[one(refundOrder.addresses)?.label,one(refundOrder.addresses)?.line1,one(refundOrder.addresses)?.city,one(refundOrder.addresses)?.postal_code].filter(Boolean).join(', ')} pricingAvailable={refundOrder.refund_pricing_complete} items={(refundOrder.order_items ?? []).map(item => ({id:item.id,quantity:item.quantity,unit_price:item.unit_price,is_returnable:one(item.products)?.is_returnable??true,gst_amount:item.gst_amount,discount_amount:item.discount_amount,products:one(item.products)}))} feeRefund={Math.max(0,Number(refundOrder.total)-(refundOrder.order_items??[]).reduce((sum,item)=>sum+Number(item.unit_price)*item.quantity+Number(item.gst_amount)-Number(item.discount_amount),0)-(refundOrder.refunds??[]).filter(refund=>refund.status!=='rejected').reduce((sum,refund)=>sum+Number(refund.fee_amount??0),0))} prepaid={(refundOrder.payments ?? []).some(payment=>!['cod','cash on delivery'].includes(payment.method.toLowerCase()))} onClose={()=>setRefundOrder(null)} onSubmitted={()=>{setRefundOrder(null);setToast('Refund request submitted.');void load()}} />}
  </section>
}
