'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AlertCircle, Check, CheckCircle2, ChevronRight, Clock3, MapPin, Package, RefreshCw, Truck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { RefundRequestDialog } from './refund-request-dialog'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { useIstNow } from '@/hooks/use-ist-now'
import { PICKUP_RESCHEDULES_ALLOWED, REFUND_ETA } from '@/lib/returns-config'

const ORDER_STEPS = ['placed', 'accepted', 'picking', 'packed', 'out_for_delivery', 'delivered'] as const
const REFUND_STEPS = ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'delivered', 'received', 'refunded'] as const
const EXCHANGE_STEPS = ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'delivered', 'received', 'exchange_dispatched', 'exchanged'] as const
let subscriptionSequence = 0
const PickupQRCode = dynamic(() => import('qrcode.react').then(module => module.QRCodeSVG), { ssr: false, loading: () => <span className="tracking-qr-placeholder" aria-label="Loading pickup QR code" /> })

type Image = { storage_path: string; sort_order: number | null }
type Product = { name: string; is_returnable: boolean; product_images: Image[] | null }
type Item = { id: number; product_id: number; quantity: number; unit_price: number; gst_amount: number; discount_amount: number; products: Product | Product[] | null }
type Address = { label: string | null; line1: string; city: string; postal_code: string; delivery_instructions: string | null } | null
type RefundItem = { quantity: number; amount: number; order_items: { id: number; product_id: number; products: { name: string } | { name: string }[] | null } | null }
type Eligibility = { order_item_id: number; refundable_quantity: number; return_possible: boolean; refund_only_possible: boolean; deadline: string | null; reason_code: string | null }
type RefundEvent = { to_status: string; note: string | null; created_at: string; actor_role?: string | null }
type Refund = { id: number; amount: number; final_amount: number | null; fee_amount: number; status: string; type: string; pickup_slot: string | null; pickup_code: string | null; qr_payload: string | null; pickup_reschedules: number; refund_reference: string | null; refunded_at: string | null; expected_arrival_at: string | null; auto_approved: boolean; picked_up_at: string | null; received_at: string | null; reason: string; comment: string | null; decision_note: string | null; created_at: string; updated_at: string; decided_at: string | null; refund_items: RefundItem[] | null; refund_events: RefundEvent[] | null }
type Order = { id: number; status: string; total: number; delivery_speed: string; express_fee: number; created_at: string; delivered_at: string | null; cancelled_at: string | null; delivery_slot: string | null; delivery_slot_start:string|null; delivery_slot_end:string|null; delivery_instructions:string|null; contactless_delivery: boolean | null; substitute_unavailable: boolean | null; address_id: number | null; refund_pricing_complete: boolean; address: Address | Address[]; payments: { method: string; status: string; amount: number }[] | null; order_items: Item[] | null; refunds: Refund[] | null; return_eligibility: Eligibility[]; eligibility_error: boolean }

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null
const titleCase = (value: string) => value === 'picked_up' ? 'Successfully picked up' : value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const sentenceCase = (value: string) => { const text = value.replaceAll('_', ' ').toLowerCase(); return text.charAt(0).toUpperCase() + text.slice(1) }
const dateTime = (value: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) => new Date(value).toLocaleString('en-IN', { ...options, timeZone: 'Asia/Kolkata' })
const placedFormat = (value: string) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const eligibilityMessage = (reason: string | null, deadline: string | null) => {
  if (reason === 'window_closed') return `Return window closed${deadline ? ` on ${dateTime(deadline, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
  if (reason === 'already_requested') return 'A request already covers the remaining quantity.'
  if (reason === 'not_returnable') return 'This item is not eligible for return or exchange.'
  if (reason === 'not_paid') return 'This order is not marked paid yet.'
  if (reason === 'not_delivered') return 'Return requests open after delivery.'
  return 'Eligibility details are unavailable. Refresh this page to try again.'
}

export function CustomerOrderTracking({ orderId: id, initialOrder, initialError, initialNow }: { orderId: number | null; initialOrder: Order | null; initialError: boolean; initialNow: string }) {
  const router = useRouter()
  const now = useIstNow(initialNow)
  const client = useMemo(() => createSupabaseBrowserClient(), [])
  const [order, setOrder] = useState<Order | null>(initialOrder)
  const [error, setError] = useState(initialError)
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [announcedStatus, setAnnouncedStatus] = useState('')
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [refundItemId, setRefundItemId] = useState<number | null>(null)
  const [refundActionError, setRefundActionError] = useState('')
  const [refundBusy, setRefundBusy] = useState<number | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof client>['channel']> | null>(null)
  const liveRef = useRef(false)
  const previousStatus = useRef<string | null>(null)

  useEffect(() => { setOrder(initialOrder); setError(initialError) }, [initialOrder, initialError])

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
      return () => { cancelled = true }
    }

    const refresh = () => {
      if (cancelled) return
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 300)
    }

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
  }, [client, id, router])

  const status = order?.status ?? ''
  const currentStep = ORDER_STEPS.indexOf(status as typeof ORDER_STEPS[number])
  const items = order?.order_items ?? []
  const refunds = [...(order?.refunds ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const address = one(order?.address)
  const payment = order?.payments?.[0] ?? null

  if (error) return <section className="tracking-message tracking-error" role="alert"><span><AlertCircle size={20} /></span><h2>Something went wrong loading your order</h2><p>Please try again in a moment.</p><button className="secondary-button tracking-control" type="button" onClick={() => router.refresh()}><RefreshCw size={15} />Retry</button></section>
  if (!id || !order) return <section className="tracking-message"><span><Package size={21} /></span><h2>We couldn’t find this order</h2><p>It may not exist, or it may not be available in your account.</p><Link className="secondary-button tracking-control" href="/customer/orders">Back to orders</Link></section>

  const paid = payment && !['pending', 'failed'].includes(payment.status)
  const paymentLabel = payment ? `${titleCase(payment.method)} · ${paid ? `Paid ${money(Number(payment.amount))}` : `To pay ${money(Number(payment.amount))}`}` : 'Payment details unavailable'
  const terminalHeadline = status === 'delivered' ? order.delivered_at ? `Delivered on ${dateTime(order.delivered_at, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Delivered' : status === 'cancelled' ? order.cancelled_at ? `Cancelled on ${dateTime(order.cancelled_at, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Order cancelled' : null
  const slotDisplay = formatDeliverySlot(order, now).display
  const activeHeadline = status === 'out_for_delivery' ? 'Out for delivery' : ['placed', 'accepted', 'picking', 'packed'].includes(status) && slotDisplay ? `Arriving ${slotDisplay}` : titleCase(status)
  const allowedCancel = ['placed', 'accepted'].includes(status)
  async function updateRefundRequest(refundId: number, rpc: 'reschedule_return_pickup' | 'cancel_return_request', args: Record<string, unknown>) {
    if (!client || refundBusy !== null) return
    setRefundBusy(refundId)
    setRefundActionError('')
    const { error: rpcError } = await client.rpc(rpc, { p_refund_id: refundId, ...args })
    if (rpcError) {
      console.error(`[order-tracking] ${rpc} failed:`, rpcError.message)
      setRefundActionError(rpcError.message.includes('PICKUP_RESCHEDULE_LIMIT') ? 'This pickup can no longer be rescheduled.' : rpcError.message.includes('INVALID_PICKUP_SLOT') ? 'Choose one of the available pickup times.' : 'We couldn’t update this request. Please retry.')
    } else router.refresh()
    setRefundBusy(null)
  }
  const cancelOrder = async () => {
    if (!client || !window.confirm('Cancel this order? A prepaid order will receive a demo refund.')) return
    const { error: cancelError } = await client.rpc('customer_cancel_order', { p_order_id: order.id })
    if (cancelError) { console.error('Could not cancel customer order:', cancelError.message); window.alert('We couldn’t cancel this order. Please try again or contact support.'); return }
    router.refresh()
  }

  return <div className="tracking-page">
    <nav className="tracking-breadcrumb" aria-label="Breadcrumb"><Link href="/customer/orders">Orders</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Order #{order.id}</span></nav>
    <div className="tracking-meta-row"><span className="tracking-live" role="status"><i className={live ? 'is-live' : ''} />{live ? 'Live' : 'Reconnecting…'}</span>{lastUpdated && <span><Clock3 size={13} />Last updated {dateTime(lastUpdated, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>}</div>
    <div className="tracking-layout">
      <div className="tracking-main-column">
        <section className="tracking-card tracking-progress-card" aria-labelledby="tracking-progress-title">
          <div className="tracking-order-heading"><div><h3 id="tracking-progress-title">Order #{order.id}</h3><p>Placed {placedFormat(order.created_at)}</p></div><span className={`order-status-pill ${status === 'delivered' ? 'arrived' : status === 'cancelled' ? 'cancelled' : 'shipping'}`}><span aria-hidden="true">{status === 'delivered' ? '✓ ' : status === 'cancelled' ? '!' : '• '}</span>{titleCase(status)}</span></div>
          <p className={`tracking-headline${status === 'cancelled' ? ' is-cancelled' : ''}`} aria-live="polite">{status === 'cancelled' ? <AlertCircle size={18} /> : status === 'delivered' ? <CheckCircle2 size={18} /> : <Truck size={18} />}{terminalHeadline ?? activeHeadline}{order.delivery_speed === 'express' && <span className="express-order-chip">Express</span>}</p>
          <div className="tracking-live-announcement" aria-live="polite" aria-atomic="true">{announcedStatus}</div>
          {status === 'cancelled' ? <CancelledTimeline order={order} /> : <OrderStepper status={status} currentStep={currentStep} />}
          {status === 'delivered' && <p className="tracking-delivered-success"><CheckCircle2 size={16} />Your order has been delivered</p>}
          <div className="tracking-actions">
            <Link className="primary-button tracking-control" href={`/customer/support/chat/new?order=${order.id}`}>Need help?</Link>
            <Link className="secondary-button tracking-control" href="/customer/orders">Back to orders</Link>
            {allowedCancel && <button type="button" className="tracking-cancel tracking-control" onClick={() => void cancelOrder()}>Cancel order</button>}
          </div>
        </section>

        {refunds.length > 0 && <section className="tracking-card tracking-refunds" aria-labelledby="tracking-refund-heading"><header className="tracking-card-heading"><div><p className="eyebrow">ORDER UPDATES</p><h3 id="tracking-refund-heading">Return and refund</h3></div><span>{refunds.length} request{refunds.length === 1 ? '' : 's'}</span></header><p className="tracking-demo-note">Demo store · no money is moved.</p>{refundActionError && <p className="refund-error" role="alert">{refundActionError}</p>}{refunds.map(refund => <RefundCard key={refund.id} refund={refund} busy={refundBusy === refund.id} onReschedule={(slot) => void updateRefundRequest(refund.id, 'reschedule_return_pickup', { p_pickup_slot: slot })} onCancel={() => { if (window.confirm('Cancel this return request?')) void updateRefundRequest(refund.id, 'cancel_return_request', {}) }} onHelp={() => router.push(`/customer/support/chat/new?order=${order.id}`)} />)}</section>}
        {status === 'delivered' && <section className="tracking-return-eligibility" aria-labelledby="tracking-returns-heading">
          <div className="tracking-return-heading"><strong id="tracking-returns-heading">Returns and refunds</strong><span>Choose an item to see its eligibility and request a return.</span></div>
          {order.eligibility_error ? <p role="alert">We couldn’t load return eligibility. <button type="button" className="link-button" onClick={() => router.refresh()}>Retry</button></p> : <div className="tracking-return-lines">{items.map(item => {
            const eligibility = order.return_eligibility.find(row => Number(row.order_item_id) === Number(item.id))
            const deadline = eligibility?.deadline ?? null
            const eligible = Boolean(eligibility?.return_possible)
            const product = one(item.products)
            return <div className="tracking-return-line" key={item.id}><span><strong>{product?.name ?? 'Ordered item'}</strong><small>{eligible ? `Eligible until ${deadline ? dateTime(deadline, { day: 'numeric', month: 'short', year: 'numeric' }) : 'the return deadline'} · ${eligibility?.refundable_quantity} available` : eligibilityMessage(eligibility?.reason_code ?? null, deadline)}</small></span>{eligible && <button type="button" className="secondary-button tracking-control" onClick={() => { setRefundItemId(item.id); setRefundOrder(order) }}>Return or refund</button>}</div>
          })}</div>}
        </section>}
      </div>

      <aside className="tracking-card tracking-order-card" aria-labelledby="tracking-items-heading">
        <header className="tracking-card-heading"><div><p className="eyebrow">ORDER SUMMARY</p><h3 id="tracking-items-heading">Items and total</h3></div><span>{items.length} item{items.length === 1 ? '' : 's'}</span></header>
        {items.length ? <div className="tracking-items">{items.map(item => {
          const product = one(item.products)
          const image = [...(product?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
          return <article className="tracking-item" key={item.id}><Link className="tracking-item-image" href={`/customer/product/${item.product_id}`}>{image ? <img src={uncroppedProductImage(image)} alt="" /> : <Package size={19} />}</Link><div className="tracking-item-name"><Link href={`/customer/product/${item.product_id}`}>{product?.name ?? 'Ordered item'}</Link><small>Qty {item.quantity}</small></div><strong>{money(Number(item.unit_price) * item.quantity)}</strong></article>
        })}</div> : <p className="tracking-no-items">Item details are unavailable for this order.</p>}
        <div className="tracking-total-breakdown">{order.express_fee > 0 && <div className="tracking-express-fee"><span>Express delivery</span><strong>{money(Number(order.express_fee))}</strong></div>}<div className="tracking-total"><strong>Total</strong><strong>{money(Number(order.total))}</strong></div></div>
        <div className="tracking-summary-facts">
          <div className="tracking-fact"><span className="tracking-fact-icon"><MapPin size={16} /></span><div><small>Delivery address</small>{address ? <><strong className="tracking-address-label">{address.label || 'Address'}</strong><p>{address.line1}<br />{address.city} {address.postal_code}</p></> : <p>Address unavailable</p>}</div></div>
          {(order.delivery_instructions || address?.delivery_instructions) && <div className="tracking-fact"><span className="tracking-fact-icon"><MapPin size={16} /></span><div><small>Delivery instructions</small><p>{order.delivery_instructions || address?.delivery_instructions}</p></div></div>}
          <div className="tracking-fact"><span className="tracking-fact-icon"><CheckCircle2 size={16} /></span><div><small>Payment</small><p>{paymentLabel}</p></div></div>
          {order.contactless_delivery && <div className="tracking-fact"><span className="tracking-fact-icon"><Truck size={16} /></span><div><small>Delivery preferences</small><p>Contactless delivery</p></div></div>}
        </div>
      </aside>
    </div>
    {refundOrder && <RefundRequestDialog
      orderId={refundOrder.id}
      addressId={refundOrder.address_id}
      pickupAddress={[address?.label, address?.line1, address?.city, address?.postal_code].filter(Boolean).join(', ')}
      pricingAvailable={refundOrder.refund_pricing_complete}
      items={items.map(item => ({ id: item.id, quantity: item.quantity, unit_price: item.unit_price, gst_amount: item.gst_amount, discount_amount: item.discount_amount, is_returnable: one(item.products)?.is_returnable ?? true, products: one(item.products) }))}
      eligibility={refundOrder.return_eligibility}
      initialSelectedItemId={refundItemId}
      prepaid={(order.payments ?? []).some(row => !['cod', 'cash on delivery'].includes(row.method.toLowerCase()))}
      onClose={() => { setRefundOrder(null); setRefundItemId(null) }}
      onSubmitted={() => { setRefundOrder(null); setRefundItemId(null); router.refresh() }}
    />}
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

function RefundCard({ refund, busy, onReschedule, onCancel, onHelp }: { refund: Refund; busy: boolean; onReschedule: (slot: string) => void; onCancel: () => void; onHelp: () => void }) {
  const [nextSlot, setNextSlot] = useState('')
  const slots = useMemo(() => Array.from({ length: 3 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index + 1)
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    const label = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(date)
    return [`${day} | 10:00-12:00`, `${day} | 16:00-18:00`].map(value => ({ value, label: `${label} · ${value.split(' | ')[1]}` }))
  }).flat(), [])
  const steps = refund.type === 'exchange' ? EXCHANGE_STEPS : REFUND_STEPS
  const stepIndex = (steps as readonly string[]).indexOf(refund.status)
  const rejected = refund.status === 'rejected'
  const terminal = refund.status === 'cancelled'
  const refundComplete = refund.type === 'exchange' ? refund.status === 'exchanged' : refund.status === 'refunded'
  return <article className="tracking-refund-card"><div className="tracking-refund-top"><div><strong>{refund.type === 'exchange' ? 'Exchange' : refund.type === 'return_and_refund' ? 'Return and refund' : 'Legacy refund only'}</strong><small>Requested {dateTime(refund.created_at)}</small></div><span className={`refund-status-pill ${refund.status}`}>{titleCase(refund.status)}</span></div>
    {refund.auto_approved && <span className="tracking-auto-approved">Auto-approved</span>}
    {(refund.refund_items ?? []).map((item, index) => <p className="tracking-refund-item" key={`${refund.id}-${index}`}>{one(item.order_items?.products)?.name ?? 'Ordered item'} · Qty {item.quantity}{refund.type !== 'exchange' ? ` · ${money(Number(item.amount))}` : ''}</p>)}
    {refund.type === 'exchange' ? <div className="tracking-refunded-note"><strong>No refund for this request.</strong><span>A replacement is prepared after the returned item is received.</span></div> : <div className="tracking-refund-amount"><span>{refund.final_amount != null ? 'Refund amount' : 'Estimated amount'}</span><strong>{money(Number(refund.final_amount ?? refund.amount))}</strong></div>}
    <p className="tracking-refund-reason"><strong>Reason:</strong> {refund.reason}{refund.comment ? ` · ${refund.comment}` : ''}</p>
    {refund.type !== 'refund_only' && !rejected && !terminal && <><ol className="tracking-refund-stepper" aria-label={refund.type === 'exchange' ? 'Exchange progress' : 'Return progress'}>{steps.map((step, index) => <li className={index < stepIndex || refundComplete ? 'completed' : index === stepIndex ? 'current' : 'upcoming'} key={step}><i />{titleCase(step)}</li>)}</ol>{refund.status === 'pickup_scheduled' && refund.pickup_slot && <p className="tracking-pickup-slot">Pickup scheduled: {refund.pickup_slot}</p>}</>}
    {refund.status === 'pickup_scheduled' && <div className="tracking-pickup-card"><div className="tracking-qr-code"><PickupQRCode value={refund.qr_payload || `${refund.id}:${refund.pickup_code ?? ''}`} size={116} level="M" includeMargin /></div><div><small>Show this to the delivery partner</small><strong className="tracking-pickup-code">{refund.pickup_code ?? '----'}</strong><span>Pickup code</span></div></div>}
    {refund.status === 'pickup_scheduled' && refund.pickup_reschedules < PICKUP_RESCHEDULES_ALLOWED && <div className="tracking-return-actions"><label>Reschedule once<select aria-label="Choose a new pickup time" value={nextSlot} onChange={event => setNextSlot(event.target.value)}><option value="">Choose a new time</option>{slots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label><button className="secondary-button" disabled={!nextSlot || busy} onClick={() => onReschedule(nextSlot)}>{busy ? 'Updating…' : 'Reschedule pickup'}</button></div>}
    {['requested', 'approved'].includes(refund.status) && <button type="button" className="tracking-cancel tracking-control" disabled={busy} onClick={onCancel}>Cancel request</button>}
    {refund.type === 'exchange' && refund.status === 'exchanged' && <div className="tracking-refunded-note"><strong>Exchange complete.</strong><span>The replacement has been marked delivered.</span></div>}
    {refund.status === 'refunded' && <div className="tracking-refunded-note"><strong>{refund.refund_reference?.startsWith('rfnd_') ? 'Razorpay Test Mode refund submitted.' : 'Demo: no money is moved.'}</strong><span>{refund.refund_reference ? `Reference ${refund.refund_reference}. ` : ''}Refund issued on {refund.refunded_at ? dateTime(refund.refunded_at, { day: 'numeric', month: 'short' }) : dateTime(refund.decided_at ?? refund.updated_at, { day: 'numeric', month: 'short' })}{refund.expected_arrival_at ? ` · expected by ${dateTime(refund.expected_arrival_at, { day: 'numeric', month: 'short', year: 'numeric' })}` : ` · usual arrival ${REFUND_ETA}`}</span></div>}
    {rejected && <div className="tracking-rejected"><strong>Rejected</strong>{refund.decision_note && <span>{refund.decision_note}</span>}</div>}
    {refund.decision_note && !rejected && <p className="tracking-decision-note"><strong>Staff note:</strong> {refund.decision_note}</p>}
    {refund.refund_events?.length ? <ol className="tracking-refund-events">{refund.refund_events.map((event, index) => <li key={`${event.created_at}-${index}`}><span>{titleCase(event.to_status)}{event.actor_role ? ` · ${titleCase(event.actor_role)}` : ''}</span><time>{dateTime(event.created_at)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol> : null}
    <button type="button" className="tracking-help-link" onClick={onHelp}>Need help?</button>
  </article>
}

