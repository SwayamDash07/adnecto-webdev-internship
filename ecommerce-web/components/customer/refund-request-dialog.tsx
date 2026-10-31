'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Package, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { ATTACHMENTS_ENABLED, AUTO_APPROVE_MAX_AMOUNT, AUTO_APPROVE_REASONS, MAX_OPEN_REQUESTS_PER_CUSTOMER, REFUND_ETA, REQUEST_SLA_HOURS, RETURN_REASONS } from '@/lib/returns-config'

type Eligibility = { order_item_id: number; refundable_quantity: number; return_possible: boolean; refund_only_possible: boolean; deadline: string | null; reason_code: string | null }
type Line = { id: number; quantity: number; unit_price: number; gst_amount: number; discount_amount: number; is_returnable: boolean; products: { name: string; product_images: { storage_path: string; sort_order: number | null }[] | null } | null }
type Preview = { items_subtotal: number; coupon_discount: number; gst_amount: number; fee_amount: number; total_amount: number }
type CreatedRequest = { id: number; status: string; auto_approved: boolean }
const STEPS = ['Items', 'Reason', 'Resolution', 'Review']

function pickupSlots() {
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index + 1)
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    const label = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(date)
    return [`${day} | 10:00-12:00`, `${day} | 16:00-18:00`].map(value => ({ value, label: `${label} · ${value.split(' | ')[1]}` }))
  }).flat()
}

function friendlyError(message: string) {
  if (message.includes('RETURN_WINDOW_CLOSED') || message.includes('ITEM_NOT_ELIGIBLE') || message.includes('window_closed')) return 'This item is no longer eligible. Refresh your orders and try again.'
  if (message.includes('ITEM_ALREADY_REQUESTED')) return 'A request already includes this item. Refresh your orders to see its status.'
  if (message.includes('TOO_MANY_OPEN_REQUESTS')) return `You have reached the limit of ${MAX_OPEN_REQUESTS_PER_CUSTOMER} open return requests. Contact support if you need help.`
  if (message.includes('PICKUP_ADDRESS_MUST_MATCH_ORDER')) return 'Pickup must use the original delivery address.'
  if (message.includes('INVALID_PICKUP_SLOT')) return 'That pickup time is no longer available. Choose another time.'
  if (message.includes('COMMENT_REQUIRED')) return 'Add a comment for this reason before continuing.'
  if (message.includes('ATTACHMENTS_DISABLED')) return 'Attachments are disabled for this demo store.'
  return 'We couldn’t submit your request. Please retry or contact support.'
}

export function RefundRequestDialog({ orderId, addressId, pickupAddress, items, pricingAvailable, prepaid, eligibility, initialSelectedItemId, onClose, onSubmitted }: { orderId: number; addressId: number | null; pickupAddress: string; items: Line[]; pricingAvailable: boolean; prepaid: boolean; eligibility: Eligibility[]; initialSelectedItemId?: number | null; onClose: () => void; onSubmitted: () => void }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<number, number>>(() => initialSelectedItemId ? { [initialSelectedItemId]: 1 } : {})
  const [reason, setReason] = useState<string>('Damaged or defective')
  const [requestType, setRequestType] = useState<'return_and_refund' | 'exchange'>('return_and_refund')
  // The existing request RPC requires a provisional slot. Admin approval replaces
  // this with the actual flexible "Today or tomorrow" pickup assignment.
  const [pickupSlot] = useState(() => pickupSlots()[0]?.value ?? '')
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [comment, setComment] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [request, setRequest] = useState<CreatedRequest | null>(null)
  const submitting = useRef(false)
  const eligibleByItem = useMemo(() => new Map(eligibility.map(row => [row.order_item_id, row])), [eligibility])
  const selectedItems = useMemo(() => Object.entries(selected).filter(([, quantity]) => quantity > 0).map(([order_item_id, quantity]) => ({ order_item_id: Number(order_item_id), quantity })), [selected])
  useEffect(() => {
    let active = true
    if (requestType === 'exchange') {
      setPreview({ items_subtotal: 0, coupon_discount: 0, gst_amount: 0, fee_amount: 0, total_amount: 0 })
      setError('')
      return () => { active = false }
    }
    if (!pricingAvailable || !selectedItems.length) { setPreview(null); return () => { active = false } }
    setPreview(null)
    setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setPreview(null); return () => { active = false } }
    const timer = window.setTimeout(async () => {
      const { data, error: previewError } = await client.rpc('preview_refund_request', { p_order_id: orderId, p_reason: reason, p_items: selectedItems, p_type: requestType })
      if (!active) return
      const row = Array.isArray(data) ? data[0] : data
      if (previewError || !row) {
        if (previewError) console.error('[returns] Refund preview failed:', previewError.message)
        setError(previewError ? friendlyError(previewError.message) : 'We couldn’t calculate this refund. Please retry.')
        setPreview(null)
      } else setPreview(row as Preview)
    }, 180)
    return () => { active = false; window.clearTimeout(timer) }
  }, [orderId, pricingAvailable, reason, requestType, selectedItems])

  const selectable = (itemId: number) => {
    const row = eligibleByItem.get(itemId)
    return Boolean(row && row.refundable_quantity > 0 && row.return_possible)
  }
  const selectionSupportsResolution = () => selectedItems.every(({ order_item_id }) => {
    const row = eligibleByItem.get(order_item_id)
    return Boolean(row?.return_possible)
  })
  const canAdvance = () => {
    if (step === 0) return selectedItems.length > 0 && selectedItems.every(({ order_item_id, quantity }) => quantity <= (eligibleByItem.get(order_item_id)?.refundable_quantity ?? 0) && selectable(order_item_id))
    if (step === 1) return reason !== 'Other' || Boolean(comment.trim())
    if (step === 2) return selectionSupportsResolution() && Boolean(pickupSlot && addressId && addressConfirmed)
    return requestType === 'exchange' || Boolean(preview && preview.total_amount > 0)
  }

  async function submit() {
    if (submitting.current || busy || !canAdvance() || (requestType === 'return_and_refund' && !pricingAvailable)) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const client = createSupabaseBrowserClient()
      if (!client) throw new Error('CLIENT_UNAVAILABLE')
      const { data, error: rpcError } = requestType === 'exchange'
        ? await client.rpc('create_exchange_request', { p_order_id: orderId, p_reason: reason, p_comment: comment.trim() || null, p_items: selectedItems, p_pickup_slot: pickupSlot, p_pickup_address_id: addressId })
        : await client.rpc('create_refund_request', { p_order_id: orderId, p_reason: reason, p_comment: comment.trim() || null, p_items: selectedItems, p_photos: [], p_type: 'return_and_refund', p_pickup_slot: pickupSlot, p_pickup_address_id: addressId })
      if (rpcError) throw rpcError
      const id = Number(data)
      const { data: statusRow, error: statusError } = await client.from('refunds').select('status,auto_approved').eq('id', id).maybeSingle()
      if (statusError) console.error('[returns] Request created but status lookup failed:', statusError.message)
      setRequest({ id, status: statusRow?.status ?? 'requested', auto_approved: Boolean(statusRow?.auto_approved) })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      console.error('[returns] Request submission failed:', cause)
      setError(friendlyError(message))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const instantApprovalHint = Boolean(requestType === 'return_and_refund' && preview && preview.total_amount <= AUTO_APPROVE_MAX_AMOUNT && AUTO_APPROVE_REASONS.includes(reason as typeof AUTO_APPROVE_REASONS[number]))
  return <div className="refund-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="refund-modal refund-wizard" role="dialog" aria-modal="true" aria-labelledby="refund-title">
      <header><div><p className="eyebrow">ORDER #{orderId} · DEMO STORE</p><h2 id="refund-title">{request ? 'Request submitted' : 'Return or exchange'}</h2></div><button type="button" className="refund-close" onClick={onClose} aria-label="Close return request" disabled={busy}><X size={20} /></button></header>
      {request ? <div className="refund-success"><span><Check size={22} /></span><p className="eyebrow">REQUEST RF-{request.id}</p><h3>{request.auto_approved ? 'Approved instantly' : 'Request received'}</h3><p>{request.auto_approved ? 'Your return is approved. Choose a pickup time if one is still needed.' : `Under review, we usually reply within ${REQUEST_SLA_HOURS} hours.`}</p><ol>{requestType === 'exchange' ? <><li>We’ll review your exchange request.</li><li>A delivery partner will collect the item.</li><li>After we receive it, a fresh piece will be dispatched to the same address.</li></> : <><li>We’ll review the item and your request.</li><li>A delivery partner will collect the item.</li><li>We’ll submit the refund to Razorpay Test Mode after the returned item is received.</li></>}</ol><small>{requestType === 'exchange' ? 'No refund is issued for an exchange.' : 'Razorpay Test Mode · no live money is moved.'}</small><div><button className="secondary-button" onClick={onSubmitted}>Done</button><button className="primary-button" onClick={() => router.push(`/customer/orders/tracking?id=${orderId}`)}>View request</button></div></div> : <>
        <nav className="refund-progress" aria-label="Request progress">{STEPS.map((label, index) => <span key={label} className={index === step ? 'current' : index < step ? 'complete' : ''}><i>{index < step ? <Check size={13} /> : index + 1}</i>{label}</span>)}</nav>
        <div className="refund-wizard-layout">
          <div className="refund-modal-body">
            {step === 0 && <fieldset className="refund-items"><legend>Choose items and quantities</legend>{items.map(item => {
              const row = eligibleByItem.get(item.id)
              const allowed = selectable(item.id)
              const remaining = row?.refundable_quantity ?? 0
              const why = row?.reason_code === 'window_closed' ? 'Return window closed' : row?.reason_code === 'already_requested' || remaining === 0 ? 'Already requested' : row?.reason_code === 'not_returnable' ? 'This item cannot be returned or exchanged' : row?.reason_code === 'not_paid' ? 'Payment not complete' : !row?.return_possible ? 'This item is not eligible' : 'Eligible'
              const imagePath = [...(item.products?.product_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.storage_path
              return <div className={`refund-item${allowed ? '' : ' not-returnable'}`} key={item.id}><label><input type="checkbox" disabled={!allowed} checked={(selected[item.id] ?? 0) > 0} onChange={event => setSelected(current => ({ ...current, [item.id]: event.target.checked ? 1 : 0 }))} />{imagePath ? <img src={uncroppedProductImage(imagePath)} alt="" /> : <span className="refund-no-image"><Package size={20} /></span>}<span className="refund-item-label"><strong>{item.products?.name ?? 'Ordered item'}</strong><small>{allowed ? `${remaining} eligible` : why}</small></span></label><div className="refund-quantity"><button type="button" aria-label={`Decrease ${item.products?.name ?? 'item'} quantity`} disabled={!allowed || !selected[item.id]} onClick={() => setSelected(current => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? 0) - 1) }))}>−</button><span>{selected[item.id] ?? 0}</span><button type="button" aria-label={`Increase ${item.products?.name ?? 'item'} quantity`} disabled={!allowed || (selected[item.id] ?? 0) >= remaining} onClick={() => setSelected(current => ({ ...current, [item.id]: Math.min(remaining, (current[item.id] ?? 0) + 1) }))}>+</button><small>of {remaining}</small></div></div>
            })}</fieldset>}
            {step === 1 && <div className="refund-reason-step"><fieldset><legend>Why are you returning these items?</legend>{RETURN_REASONS.map(option => <label className="refund-reason-card" key={option.value}><input type="radio" name="refund-reason" value={option.value} checked={reason === option.value} onChange={() => { setReason(option.value) }} /><span><strong>{option.label}</strong><small>{option.value === 'Changed my mind' ? 'No longer needed or ordered by mistake' : option.value === 'Wrong item' ? 'The delivered product doesn’t match your order' : option.value === 'Damaged or defective' ? 'The product arrived damaged or doesn’t work' : option.value === 'Not as described' ? 'The product differs from its listing' : 'Tell us what happened'}</small></span></label>)}</fieldset><label className="refund-field">{reason === 'Other' ? 'Comment (required)' : 'Comment (optional)'}<textarea maxLength={300} value={comment} onChange={event => setComment(event.target.value)} placeholder="Add details for our team" /><small>{comment.length}/300</small></label></div>}
            {step === 2 && <div className="refund-resolution-step"><fieldset className="refund-type-choice"><legend>Choose a resolution</legend><label><input type="radio" name="refund-type" checked={requestType === 'return_and_refund'} onChange={() => setRequestType('return_and_refund')} /><span><strong>Return and refund</strong><small>Send the item back and receive a refund after we check it.</small></span></label><label><input type="radio" name="refund-type" checked={requestType === 'exchange'} onChange={() => setRequestType('exchange')} /><span><strong>Exchange</strong><small>Return this item and we’ll deliver a fresh piece. No refund is issued.</small></span></label></fieldset><div className="refund-pickup-expectation"><strong>Pickup timing</strong><span>Once approved, a delivery partner will pick it up today or tomorrow.</span></div><div className="refund-address-card"><strong>Pickup and replacement address</strong><span>{pickupAddress || 'Original address unavailable'}</span>{requestType === 'exchange' && <small>We’ll deliver the replacement to this same address.</small>}<label><input type="checkbox" checked={addressConfirmed} onChange={event => setAddressConfirmed(event.target.checked)} /> Use the original delivery address</label></div>{requestType === 'return_and_refund' && <div className="refund-payment-method"><strong>Refund method</strong><span>{prepaid ? 'Original payment method' : 'We’ll contact you about your refund'}</span></div>}</div>}
            {step === 3 && <div className="refund-review"><h3>Review request</h3><ul>{selectedItems.map(({ order_item_id, quantity }) => { const item = items.find(row => row.id === order_item_id); return <li key={order_item_id}><span>{item?.products?.name ?? 'Ordered item'} × {quantity}</span></li> })}</ul>{requestType === 'exchange' ? <section className="refund-exchange-review"><strong>Exchange · no refund</strong><p>We’ll collect the selected item and deliver a fresh piece to the original address after review.</p><span>Pickup expected today or tomorrow after approval.</span></section> : <><dl><div><dt>Items</dt><dd>{money(Number(preview?.items_subtotal ?? 0))}</dd></div><div><dt>Coupon discount</dt><dd>−{money(Number(preview?.coupon_discount ?? 0))}</dd></div><div><dt>GST</dt><dd>{money(Number(preview?.gst_amount ?? 0))}</dd></div><div><dt>Fees returned</dt><dd>{money(Number(preview?.fee_amount ?? 0))}</dd></div><div className="refund-review-total"><dt>Estimated refund</dt><dd>{money(Number(preview?.total_amount ?? 0))}</dd></div></dl>{instantApprovalHint && <p className="refund-instant-hint">This request may be approved instantly under the demo rules.</p>}<p>Refunds are marked within {REFUND_ETA}. Your bank may take additional time to show the amount.</p><small>Pickup expected today or tomorrow after approval · {prepaid ? 'Original payment method' : 'We’ll contact you'}</small></>}{error && <p className="refund-error" role="alert">{error}</p>}</div>}
          </div>
          <aside className="refund-summary" aria-live="polite"><p className="eyebrow">{requestType === 'exchange' ? 'EXCHANGE SUMMARY' : 'LIVE REFUND SUMMARY'}</p><strong>{requestType === 'exchange' ? 'No refund' : preview ? money(Number(preview.total_amount)) : '—'}</strong><span>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)} item(s) selected</span>{requestType === 'exchange' ? <small>A fresh piece will be delivered after we receive the returned item.</small> : <><div><span>Items</span><b>{preview ? money(Number(preview.items_subtotal)) : 'Calculating'}</b></div><div><span>Coupon</span><b>−{money(Number(preview?.coupon_discount ?? 0))}</b></div><div><span>GST</span><b>{money(Number(preview?.gst_amount ?? 0))}</b></div><div><span>Fees</span><b>{money(Number(preview?.fee_amount ?? 0))}</b></div><small>Demo store · no money is moved. {!ATTACHMENTS_ENABLED && 'Photos and attachments are disabled.'}</small></>}</aside>
        </div>
        {requestType === 'return_and_refund' && !pricingAvailable && <p className="refund-error refund-legacy-error" role="status">This older order has no saved price breakdown. Contact support for help.</p>}
        <footer><button type="button" className="secondary-button" onClick={() => step === 0 ? onClose() : setStep(value => Math.max(0, value - 1))} disabled={busy}>{step === 0 ? 'Cancel' : <><ArrowLeft size={15} />Back</>}</button>{step < 3 ? <button type="button" className="primary-button" onClick={() => setStep(value => Math.min(3, value + 1))} disabled={!canAdvance() || (requestType === 'return_and_refund' && !pricingAvailable)}><ArrowRight size={15} />Next</button> : <button type="button" className="primary-button" onClick={() => void submit()} disabled={!canAdvance() || busy || submitting.current}>{busy ? 'Submitting…' : 'Submit request'}</button>}</footer>
      </>}
    </section>
  </div>
}
