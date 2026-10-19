'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronRight, Clock3, MapPin, Package, RefreshCw, Truck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { RefundRequestDialog } from './refund-request-dialog'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'

const ORDER_SELECT = 'id,status,total,created_at,delivered_at,cancelled_at,delivery_slot,delivery_slot_start,delivery_slot_end,delivery_instructions,contactless_delivery,substitute_unavailable,address_id,refund_pricing_complete,address:addresses(label,line1,city,postal_code,delivery_instructions),payments(method,status,amount),order_items(id,product_id,quantity,unit_price,gst_amount,discount_amount,products!order_items_product_id_fkey(name,is_returnable,product_images(storage_path,sort_order))),refunds(id,amount,final_amount,fee_amount,status,type,pickup_slot,picked_up_at,received_at,reason,comment,decision_note,created_at,updated_at,decided_at,refund_items(quantity,amount,order_items:order_items(id,product_id,products!order_items_product_id_fkey(name))),refund_events(to_status,note,created_at))'
const ORDER_STEPS = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery', 'delivered'] as const
const REFUND_STEPS = ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'received', 'refunded'] as const
const ACTIVE_REFUNDS = ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'received']
let subscriptionSequence = 0

type Image = { storage_path: string; sort_order: number | null }
type Product = { name: string; is_returnable: boolean; product_images: Image[] | null }
type Item = { id: number; product_id: number; quantity: number; unit_price: number; gst_amount: number; discount_amount: number; products: Product | Product[] | null }
type Address = { label: string | null; line1: string; city: string; postal_code: string; delivery_instructions: string | null } | null
type RefundItem = { quantity: number; amount: number; order_items: { id: number; product_id: number; products: { name: string } | { name: string }[] | null } | null }
type RefundEvent = { to_status: string; note: string | null; created_at: string }
type Refund = { id: number; amount: number; final_amount: number | null; fee_amount: number; status: string; type: string; pickup_slot: string | null; picked_up_at: string | null; received_at: string | null; reason: string; comment: string | null; decision_note: string | null; created_at: string; updated_at: string; decided_at: string | null; refund_items: RefundItem[] | null; refund_events: RefundEvent[] | null }
type Order = { id: number; status: string; total: number; created_at: string; delivered_at: string | null; cancelled_at: string | null; delivery_slot: string | null; delivery_slot_start:string|null; delivery_slot_end:string|null; delivery_instructions:string|null; contactless_delivery: boolean | null; substitute_unavailable: boolean | null; address_id: number | null; refund_pricing_complete: boolean; address: Address | Address[]; payments: { method: string; status: string; amount: number }[] | null; order_items: Item[] | null; refunds: Refund[] | null }
type OrderLoad = { data: Order | null; error: { message: string } | null }

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const sentenceCase = (value: string) => { const text = value.replaceAll('_', ' ').toLowerCase(); return text.charAt(0).toUpperCase() + text.slice(1) }
const dateTime = (value: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) => new Date(value).toLocaleString('en-IN', { ...options, timeZone: 'Asia/Kolkata' })
const placedFormat = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

export function CustomerOrderTracking({ orderId: id, initialOrder, initialError, initialNow }: { orderId: number | null; initialOrder: Order | null; initialError: boolean; initialNow: string }) {
  const now = useIstNow(initialNow)
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const [order, setOrder] = useState<Order | null>(initialOrder)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [retry, setRetry] = useState(0)
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [announcedStatus, setAnnouncedStatus] = useState('')
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof client>['channel']> | null>(null)
  const liveRef = useRef(false)
  const previousStatus = useRef<string | null>(null)

  const fetchOrder = useCallback(async (orderId: number): Promise<OrderLoad> => {
    if (!client) return { data: null, error: { message: 'Supabase browser client is unavailable.' } }
    const { data, error: queryError } = await client.from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle()
    return { data: data as unknown as Order | null, error: queryError }
  }, [client])

  useEffect(() => {
    let cancelled = false
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let fallbackTimer: ReturnType<typeof setInterval> | undefined
    let channel: ReturnType<NonNullable<typeof client>['channel']> | null = null

    setLive(false)
    liveRef.current = false
    setLastUpdated(null)
    previousStatus.current = null
    setAnnouncedStatus('')

    if (!id) {
      setLoading(false)
      return () => { cancelled = true }
    }

    const load = async () => {
      const result = await fetchOrder(id)
      if (cancelled) return
      if (result.error) {
        console.error('Could not load customer order tracking:', result.error.message)
        setError(true)
      } else {
        const next = result.data
        if (!next) {
          setOrder(null)
        } else {
          if (previousStatus.current !== null && previousStatus.current !== next.status) setAnnouncedStatus(`Order status changed to ${titleCase(next.status)}.`)
          previousStatus.current = next.status
          setOrder(next)
        }
        setError(false)
        setLastUpdated(new Date().toISOString())
      }
      setLoading(false)
    }

    const refresh = () => {
      if (cancelled) return
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void load() }, 300)
    }

    if (retry > 0) { setLoading(true); void load() }

    if (client) {
      const nonce = ++subscriptionSequence
      channel = client.channel(`customer-order-${id}-${nonce}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: `order_id=eq.${id}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_events' }, refresh)
        .subscribe(status => {
          if (cancelled) return
          const subscribed = status === 'SUBSCRIBED'
          liveRef.current = subscribed
          setLive(subscribed)
        })
      channelRef.current = channel
    }

    const onFocus = () => { if (!liveRef.current) refresh() }
    window.addEventListener('focus', onFocus)
    fallbackTimer = setInterval(() => { if (!liveRef.current) refresh() }, 30_000)

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      if (fallbackTimer) clearInterval(fallbackTimer)
      window.removeEventListener('focus', onFocus)
      if (channel) {
        if (channelRef.current === channel) channelRef.current = null
        void client?.removeChannel(channel)
      }
    }
  }, [client, fetchOrder, id, retry])

  const status = order?.status ?? ''
  const currentStep = ORDER_STEPS.indexOf(status as typeof ORDER_STEPS[number])
  const items = order?.order_items ?? []
  const refunds = [...(order?.refunds ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const activeRefund = refunds.some(refund => ACTIVE_REFUNDS.includes(refund.status))
  const returnOpen = Boolean(order?.status === 'delivered' && order.delivered_at && now.getTime() - Date.parse(order.delivered_at) <= 7 * 24 * 60 * 60 * 1000 && !activeRefund)
  const address = one(order?.address)
  const payment = order?.payments?.[0] ?? null

  if (loading) return <TrackingSkeleton />
  if (error) return <section className="tracking-message tracking-error" role="alert"><span><AlertCircle size={20} /></span><h2>Something went wrong loading your order</h2><p>Please try again in a moment.</p><button className="secondary-button tracking-control" type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} />Retry</button></section>
  if (!id || !order) return <section className="tracking-message"><span><Package size={21} /></span><h2>We couldn’t find this order</h2><p>It may not exist, or it may not be available in your account.</p><Link className="secondary-button tracking-control" href="/customer/orders">Back to orders</Link></section>

  const paid = payment && !['pending', 'failed'].includes(payment.status)
  const paymentLabel = payment ? `${titleCase(payment.method)} · ${paid ? `Paid ${money(Number(payment.amount))}` : `To pay ${money(Number(payment.amount))}`}` : 'Payment details unavailable'
  const terminalHeadline = status === 'delivered' ? order.delivered_at ? `Delivered on ${dateTime(order.delivered_at, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Delivered' : status === 'cancelled' ? order.cancelled_at ? `Cancelled on ${dateTime(order.cancelled_at, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Order cancelled' : null
  const slotDisplay = formatDeliverySlot(order, now).display
  const activeHeadline = status === 'out_for_delivery' ? 'Out for delivery' : ['placed', 'accepted', 'picking', 'packed'].includes(status) && slotDisplay ? `Arriving ${slotDisplay}` : titleCase(status)
  const allowedCancel = ['placed', 'accepted'].includes(status)
  const cancelOrder = async () => {
    if (!client || !window.confirm('Cancel this order? A prepaid order will receive a demo refund.')) return
    const { error: cancelError } = await client.rpc('customer_cancel_order', { p_order_id: order.id })
    if (cancelError) { console.error('Could not cancel customer order:', cancelError.message); window.alert('We couldn’t cancel this order. Please try again or contact support.'); return }
    const result = await fetchOrder(order.id)
    if (!result.error && result.data) setOrder(result.data)
  }

  return <div className="tracking-page">
    <nav className="tracking-breadcrumb" aria-label="Breadcrumb"><Link href="/customer/orders">Orders</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Order #{order.id}</span></nav>
    <div className="tracking-meta-row"><span className="tracking-live" role="status"><i className={live ? 'is-live' : ''} />{live ? 'Live' : 'Reconnecting…'}</span>{lastUpdated && <span><Clock3 size={13} />Last updated {dateTime(lastUpdated, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>}</div>
    <div className="tracking-layout">
      <div className="tracking-main-column">
        <section className="tracking-card tracking-progress-card" aria-labelledby="tracking-progress-title">
          <div className="tracking-order-heading"><div><h3 id="tracking-progress-title">Order #{order.id}</h3><p>Placed {placedFormat(order.created_at)}</p></div><span className={`order-status-pill ${status === 'delivered' ? 'arrived' : status === 'cancelled' ? 'cancelled' : 'shipping'}`}><span aria-hidden="true">{status === 'delivered' ? '✓ ' : status === 'cancelled' ? '!' : '• '}</span>{titleCase(status)}</span></div>
          <p className={`tracking-headline${status === 'cancelled' ? ' is-cancelled' : ''}`} aria-live="polite">{status === 'cancelled' ? <AlertCircle size={18} /> : status === 'delivered' ? <CheckCircle2 size={18} /> : <Truck size={18} />}{terminalHeadline ?? activeHeadline}</p>
          <div className="tracking-live-announcement" aria-live="polite" aria-atomic="true">{announcedStatus}</div>
          {status === 'cancelled' ? <CancelledTimeline order={order} /> : <OrderStepper status={status} currentStep={currentStep} />}
          {status === 'delivered' && <p className="tracking-delivered-success"><CheckCircle2 size={16} />Your order has been delivered</p>}
          <div className="tracking-actions">
            <Link className="primary-button tracking-control" href={`/customer/support/chat/new?order=${order.id}`}>Need help?</Link>
            <Link className="secondary-button tracking-control" href="/customer/orders">Back to orders</Link>
            {allowedCancel && <button type="button" className="tracking-cancel tracking-control" onClick={() => void cancelOrder()}>Cancel order</button>}
          </div>
        </section>

        {refunds.length > 0 && <section className="tracking-card tracking-refunds" aria-labelledby="tracking-refund-heading"><header className="tracking-card-heading"><div><p className="eyebrow">ORDER UPDATES</p><h3 id="tracking-refund-heading">Return and refund</h3></div><span>{refunds.length} request{refunds.length === 1 ? '' : 's'}</span></header>{refunds.map(refund => <RefundCard refund={refund} key={refund.id} />)}</section>}
        {status === 'delivered' && !activeRefund && <section className="tracking-return-eligibility">{returnOpen ? <><div><strong>Need to return an item?</strong><span>Eligible items can be requested within 7 days of delivery.</span></div><button type="button" className="secondary-button tracking-control" onClick={() => setRefundOrder(order)}>Return or refund</button></> : <span>Return window closed</span>}</section>}
      </div>

      <aside className="tracking-card tracking-order-card" aria-labelledby="tracking-items-heading">
        <header className="tracking-card-heading"><div><p className="eyebrow">ORDER SUMMARY</p><h3 id="tracking-items-heading">Items and total</h3></div><span>{items.length} item{items.length === 1 ? '' : 's'}</span></header>
        {items.length ? <div className="tracking-items">{items.map(item => {
          const product = one(item.products)
          const image = [...(product?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
          return <article className="tracking-item" key={item.id}><Link className="tracking-item-image" href={`/customer/product/${item.product_id}`}>{image ? <img src={uncroppedProductImage(image)} alt="" /> : <Package size={19} />}</Link><div className="tracking-item-name"><Link href={`/customer/product/${item.product_id}`}>{product?.name ?? 'Ordered item'}</Link><small>Qty {item.quantity}</small></div><strong>{money(Number(item.unit_price) * item.quantity)}</strong></article>
        })}</div> : <p className="tracking-no-items">Item details are unavailable for this order.</p>}
        <div className="tracking-total-breakdown"><div className="tracking-total"><strong>Total</strong><strong>{money(Number(order.total))}</strong></div></div>
        <div className="tracking-summary-facts">
          <div className="tracking-fact"><span className="tracking-fact-icon"><MapPin size={16} /></span><div><small>Delivery address</small>{address ? <><strong className="tracking-address-label">{address.label || 'Address'}</strong><p>{address.line1}<br />{address.city} {address.postal_code}</p></> : <p>Address unavailable</p>}</div></div>
          {(order.delivery_instructions || address?.delivery_instructions) && <div className="tracking-fact"><span className="tracking-fact-icon"><MapPin size={16} /></span><div><small>Delivery instructions</small><p>{order.delivery_instructions || address?.delivery_instructions}</p></div></div>}
          <div className="tracking-fact"><span className="tracking-fact-icon"><CheckCircle2 size={16} /></span><div><small>Payment</small><p>{paymentLabel}</p></div></div>
          {(order.contactless_delivery || order.substitute_unavailable) && <div className="tracking-fact"><span className="tracking-fact-icon"><Truck size={16} /></span><div><small>Delivery preferences</small><p>{[order.contactless_delivery && 'Contactless delivery', order.substitute_unavailable && 'Do not substitute unavailable items'].filter(Boolean).join(' · ')}</p></div></div>}
        </div>
      </aside>
    </div>
    {refundOrder && <RefundRequestDialog orderId={refundOrder.id} addressId={refundOrder.address_id} pickupAddress={[address?.label, address?.line1, address?.city, address?.postal_code].filter(Boolean).join(', ')} pricingAvailable={refundOrder.refund_pricing_complete} items={items.map(item => ({ id: item.id, quantity: item.quantity, unit_price: item.unit_price, gst_amount: item.gst_amount, discount_amount: item.discount_amount, is_returnable: one(item.products)?.is_returnable ?? true, products: one(item.products) }))} feeRefund={Math.max(0, Number(order.total) - items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity + Number(item.gst_amount) - Number(item.discount_amount), 0) - refunds.filter(refund => refund.status !== 'rejected').reduce((sum, refund) => sum + Number(refund.fee_amount ?? 0), 0))} prepaid={(order.payments ?? []).some(row => !['cod', 'cash on delivery'].includes(row.method.toLowerCase()))} onClose={() => setRefundOrder(null)} onSubmitted={() => { setRefundOrder(null); void fetchOrder(order.id).then(result => { if (!result.error && result.data) setOrder(result.data) }) }} />}
  </div>
}

function OrderStepper({ status, currentStep }: { status: string; currentStep: number }) {
  const isDelivered = ['delivered', 'returned', 'refunded'].includes(status)
  const completeCount = isDelivered ? ORDER_STEPS.length : currentStep
  const activeIndex = isDelivered ? -1 : currentStep
  return <ol className="tracking-stepper" aria-label="Order progress">{ORDER_STEPS.map((step, index) => {
    const completed = index < completeCount
    const current = index === activeIndex
    const last = index === ORDER_STEPS.length - 1
    const state = completed ? 'completed' : current ? 'current' : 'upcoming'
    return <li className={`tracking-step ${state}${last && isDelivered ? ' tracking-step-delivered' : ''}`} key={step} aria-label={`Step ${index + 1} of ${ORDER_STEPS.length}: ${sentenceCase(step)}, ${state}`}><span className="tracking-step-marker" aria-hidden="true">{completed ? <Check size={15} /> : current ? <i /> : null}</span><span className="tracking-step-label">{sentenceCase(step)}</span></li>
  })}</ol>
}

function CancelledTimeline({ order }: { order: Order }) {
  return <ol className="tracking-cancelled-timeline"><li><span className="tracking-cancelled-node"><Check size={14} /></span><div><strong>Order placed</strong><small>{dateTime(order.created_at)}</small></div></li><li className="is-cancelled"><span className="tracking-cancelled-node"><AlertCircle size={15} /></span><div><strong>Order cancelled</strong><small>{order.cancelled_at ? dateTime(order.cancelled_at) : 'Cancellation date unavailable'}</small></div></li></ol>
}

function RefundCard({ refund }: { refund: Refund }) {
  const stepIndex = REFUND_STEPS.indexOf(refund.status as typeof REFUND_STEPS[number])
  const rejected = refund.status === 'rejected'
  const terminal = refund.status === 'cancelled'
  const refundComplete = refund.status === 'refunded'
  return <article className="tracking-refund-card"><div className="tracking-refund-top"><div><strong>{refund.type === 'return_and_refund' ? 'Return and refund' : 'Refund only'}</strong><small>Requested {dateTime(refund.created_at)}</small></div><span className={`refund-status-pill ${refund.status}`}>{titleCase(refund.status)}</span></div>
    {(refund.refund_items ?? []).map((item, index) => <p className="tracking-refund-item" key={`${refund.id}-${index}`}>{one(item.order_items?.products)?.name ?? 'Ordered item'} · Qty {item.quantity} · {money(Number(item.amount))}</p>)}
    <div className="tracking-refund-amount"><span>{refund.final_amount != null ? 'Refund amount' : 'Estimated amount'}</span><strong>{money(Number(refund.final_amount ?? refund.amount))}</strong></div>
    <p className="tracking-refund-reason"><strong>Reason:</strong> {refund.reason}{refund.comment ? ` · ${refund.comment}` : ''}</p>
    {refund.type === 'return_and_refund' && !rejected && !terminal && <><ol className="tracking-refund-stepper" aria-label="Return progress">{REFUND_STEPS.map((step, index) => <li className={index < stepIndex || refundComplete ? 'completed' : index === stepIndex ? 'current' : 'upcoming'} key={step}><i />{titleCase(step)}</li>)}</ol>{refund.status === 'pickup_scheduled' && refund.pickup_slot && <p className="tracking-pickup-slot">Pickup scheduled: {refund.pickup_slot}</p>}</>}
    {rejected && <div className="tracking-rejected"><strong>Rejected</strong>{refund.decision_note && <span>{refund.decision_note}</span>}</div>}
    {refund.decision_note && !rejected && <p className="tracking-decision-note"><strong>Staff note:</strong> {refund.decision_note}</p>}
    {refund.refund_events?.length ? <ol className="tracking-refund-events">{refund.refund_events.map((event, index) => <li key={`${event.created_at}-${index}`}><span>{titleCase(event.to_status)}</span><time>{dateTime(event.created_at)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol> : null}
  </article>
}

function TrackingSkeleton() {
  return <div className="tracking-skeleton" aria-label="Loading order tracking"><div className="tracking-skeleton-line short" /><div className="tracking-skeleton-line heading" /><div className="tracking-skeleton-line wide" /><div className="tracking-skeleton-grid"><div className="tracking-skeleton-card"><i /><i /><i /><i /><i /><i /></div><div className="tracking-skeleton-card"><i /><i /><i /></div></div></div>
}
