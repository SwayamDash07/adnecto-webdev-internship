'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, Check, ChevronDown, CreditCard, Info, LockKeyhole, MapPin, RefreshCw, ShieldCheck, Truck, X } from 'lucide-react'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { useLiveCheckout } from '@/hooks/use-live-checkout'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { CheckoutSection } from './checkout-section'
import type { CartLine } from '@/types/catalog'
import type { CheckoutAddressRecord, DeliverySlotRecord } from '@/types/checkout'

export function LiveCheckoutFlow({ initialCartLines, initialCartReady, initialAddresses, initialDeliverySlots, initialDataError }: { initialCartLines: CartLine[]; initialCartReady: boolean; initialAddresses: CheckoutAddressRecord[]; initialDeliverySlots: DeliverySlotRecord[]; initialDataError: string }) {
  const router = useRouter()
  const addressSection = useRef<HTMLElement>(null)
  const deliverySection = useRef<HTMLElement>(null)
  const paymentSection = useRef<HTMLElement>(null)
  const submitLock = useRef(false)
  const packagingInfoRef = useRef<HTMLSpanElement>(null)
  const [mobileBreakdownOpen, setMobileBreakdownOpen] = useState(false)
  const [packagingInfoOpen, setPackagingInfoOpen] = useState(false)
  const [validation, setValidation] = useState<{ address?: string; slot?: string; payment?: string }>({})
  const { lines, totalQuantity, lineKey, ready, addressesFromDatabase, addressId, setAddressId, slot, setSlot, deliverySlots, instructions, setInstructions, coupon, setCoupon, couponDiscount, setCouponDiscount, couponMessage, setCouponMessage, paymentMethod, setPaymentMethod, contactless, setContactless, substituteUnavailable, setSubstituteUnavailable, busy, error, orderId, summary, appliedDiscount, checkoutTotal, placeOrder, applyCoupon, dataLoading, dataError, retryCheckoutData } = useLiveCheckout({ initialCartLines, initialCartReady, initialAddresses, initialDeliverySlots, initialDataError })

  useEffect(() => {
    if (ready && !lines.length && !orderId) router.replace('/customer/cart')
  }, [ready, lines.length, orderId, router])

  useEffect(() => {
    if (!packagingInfoOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (packagingInfoRef.current && !packagingInfoRef.current.contains(event.target as Node)) setPackagingInfoOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPackagingInfoOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [packagingInfoOpen])

  if (!ready || (!lines.length && !orderId)) return <div className="checkout-layout checkout-loading" aria-label="Loading checkout"><div className="checkout-main"><section className="checkout-section"><i /><i /><i /></section><section className="checkout-section"><i /><i /><i /></section></div><aside className="checkout-summary"><i /><i /><i /><i /></aside></div>
  if (orderId) return <div className="success-panel checkout-success" role="status"><span><Check size={25} /></span><div><p className="eyebrow">ORDER CONFIRMED</p><h3>Order placed successfully</h3><p>Order #{orderId} was saved and inventory was reserved for you.</p><Link className="primary-button" href="/customer/orders">Track order</Link></div></div>

  const selectedAddress = addressesFromDatabase.find(item => item.id === addressId)
  const selectedSlotValid = deliverySlots.some(item => item.starts_at === slot && item.capacity > 0)
  const selectedPaymentValid = paymentMethod === 'prepaid' || paymentMethod === 'cod'
  const addressComplete = Boolean(selectedAddress)
  const deliveryComplete = selectedSlotValid
  const paymentComplete = selectedPaymentValid
  const staleOrder = /insufficient_stock|no longer have enough stock|stock.*(change|available)|price.*(change|update)|cart.*(change|update)/i.test(error)
  const missing = [!addressComplete && 'delivery address', !deliveryComplete && 'delivery slot', !paymentComplete && 'payment method'].filter(Boolean).join(', ')

  const submit = async () => {
    if (submitLock.current || busy) return
    const nextErrors = {
      address: addressComplete ? undefined : 'Choose a delivery address to continue.',
      slot: deliveryComplete ? undefined : 'Choose an available delivery slot.',
      payment: paymentComplete ? undefined : 'Choose a payment method.',
    }
    setValidation(nextErrors)
    const firstMissing = !addressComplete ? addressSection.current : !deliveryComplete ? deliverySection.current : !paymentComplete ? paymentSection.current : null
    if (firstMissing) { firstMissing.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    if (staleOrder || dataError) return
    submitLock.current = true
    try { await placeOrder() } finally { submitLock.current = false }
  }

  const totals = <div className="checkout-totals">
    <div><span>MRP subtotal</span><strong>{money(summary.mrpSubtotal)}</strong></div>
    {summary.mrpDiscount > 0 && <div><span>MRP discount</span><strong className="checkout-saving">−{money(summary.mrpDiscount)}</strong></div>}
    {appliedDiscount > 0 && <div><span>{couponDiscount > 0 ? `${coupon.trim().toUpperCase()} discount` : 'Offer discount'}</span><strong className="checkout-saving">−{money(appliedDiscount)}</strong></div>}
    <div><span>GST</span><strong>{money(summary.gst)}</strong></div>
    <div><span>Delivery</span><strong className={summary.delivery === 0 ? 'checkout-saving' : ''}>{summary.delivery ? money(summary.delivery) : 'Free'}</strong></div>
    <div><span>Packaging fee <span className="checkout-packaging-info" ref={packagingInfoRef}><button type="button" className="checkout-info" aria-label="Packaging fee information" aria-expanded={packagingInfoOpen} aria-haspopup="dialog" aria-controls="checkout-packaging-info" onClick={() => setPackagingInfoOpen(open => !open)}><Info size={13} /></button>{packagingInfoOpen && <span className="checkout-packaging-popover" id="checkout-packaging-info" role="dialog" aria-label="About the packaging fee">A small fee that helps cover careful packing of your order.<button type="button" aria-label="Close packaging fee information" onClick={() => setPackagingInfoOpen(false)}><X size={14} /></button></span>}</span></span><strong>{money(summary.packing)}</strong></div>
    <div className="checkout-total"><span>Total</span><strong aria-live="polite">{money(checkoutTotal)}</strong></div>
    {(summary.mrpDiscount + appliedDiscount) > 0 && <p className="checkout-save-pill">You’re saving {money(summary.mrpDiscount + appliedDiscount)} on this order</p>}
  </div>

  const placeButton = <button type="button" className="primary-button place-order checkout-place-button" disabled={busy || !totalQuantity || staleOrder || Boolean(dataError)} aria-disabled={Boolean(missing)} onClick={() => void submit()}>
    {busy ? <><RefreshCw className="checkout-spinner" size={16} /> {paymentMethod === 'cod' ? 'Placing order…' : 'Opening payment…'}</> : paymentMethod === 'cod' ? `Place order - ${money(checkoutTotal)}` : `Pay ${money(checkoutTotal)}`}
  </button>

  const summaryCard = <aside className="checkout-summary">
    <div className="checkout-summary-heading"><div><p className="eyebrow">CHECK BEFORE YOU PLACE IT</p><h2>Order summary</h2></div><Link href="/customer/cart">Edit cart</Link></div>
    <div className="checkout-items" aria-label="Items in your order">
      {lines.map(line => <div className="checkout-item" key={lineKey(line)}>
        <div className="checkout-item-image">{line.product.imageUrl ? <Image src={uncroppedProductImage(line.product.imageUrl)} alt={line.product.name} fill sizes="48px" /> : <span>{line.product.emoji}</span>}<b>{line.quantity}</b></div>
        <div className="checkout-item-copy"><strong title={line.product.name}>{line.product.name}</strong><small>{line.quantity} × {money(line.product.price)}</small></div>
        <strong className="checkout-item-total">{money(line.product.price * line.quantity)}</strong>
      </div>)}
    </div>
    <div className="checkout-coupon">
      {couponDiscount > 0 ? <div className="checkout-coupon-applied"><span><Check size={15} /> <b>{coupon.trim().toUpperCase()}</b> applied · You saved {money(appliedDiscount)}</span><button type="button" aria-label="Remove coupon" onClick={() => { setCoupon(''); setCouponDiscount(0); setCouponMessage('') }}>×</button></div> : <><label htmlFor="checkout-coupon-code">Coupon code</label><div className="checkout-coupon-entry"><input id="checkout-coupon-code" value={coupon} onChange={event => { setCoupon(event.target.value); setCouponDiscount(0); setCouponMessage('') }} placeholder="Enter coupon code" /><button type="button" disabled={!coupon.trim()} onClick={() => void applyCoupon()}>Apply</button></div>{couponMessage && <p className={`checkout-coupon-message ${couponDiscount > 0 ? 'is-success' : 'is-error'}`} role="status">{couponMessage}</p>}</>}
    </div>
    {totals}
    {missing && <p className="checkout-missing">Choose your {missing} to place the order.</p>}
    {placeButton}
    <p className="checkout-secure"><LockKeyhole size={14} /> Secure checkout</p>
    <p className="checkout-terms">Demo store — online payments are handled by the payment provider; no real payment is taken in this demo.</p>
  </aside>

  const progress = <nav className="checkout-progress" aria-label="Checkout steps">{[
    { label: 'Address', done: addressComplete, target: addressSection },
    { label: 'Delivery', done: deliveryComplete, target: deliverySection },
    { label: 'Payment', done: paymentComplete, target: paymentSection },
  ].map((step, index) => <button type="button" key={step.label} className={step.done ? 'is-complete' : ''} onClick={() => step.target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>{step.done ? <Check size={14} /> : index + 1}</span>{step.label}</button>)}</nav>

  const slotGroups = new Map<string, typeof deliverySlots>()
  for (const item of deliverySlots) {
    const key = item.day ?? ''
    slotGroups.set(key, [...(slotGroups.get(key) ?? []), item])
  }

  return <>
    {progress}
    {dataError && <div className="checkout-alert" role="alert"><span>{dataError}</span><button type="button" onClick={retryCheckoutData}>Retry</button></div>}
    {staleOrder && <div className="checkout-alert" role="alert"><span>Stock or price changed while you were checking out. Review your cart before continuing.</span><Link href="/customer/cart">Review cart</Link></div>}
    <div className="checkout-layout">
      <div className="checkout-main">
        <CheckoutSection ref={addressSection} id="checkout-address" number="1" title="Delivery address" complete={addressComplete} action={<Link href="/customer/account" className="checkout-section-link">Manage addresses</Link>}>
          {dataLoading ? <div className="checkout-address-grid">{[0, 1].map(item => <div className="checkout-address-skeleton" key={item}><i /><i /><i /></div>)}</div> : addressesFromDatabase.length ? <fieldset className="checkout-address-grid checkout-radio-group">
            <legend className="checkout-sr-only">Choose a delivery address</legend>
            {addressesFromDatabase.map(address => <label className={`checkout-address-card ${addressId === address.id ? 'selected' : ''}`} key={address.id}>
              <input type="radio" name="checkout-address" value={address.id} checked={addressId === address.id} onChange={() => { setAddressId(address.id); setValidation(current => ({ ...current, address: undefined })) }} />
              <span className="checkout-radio-dot" aria-hidden="true" />
              <span className="checkout-address-content"><span className="checkout-address-chip">{address.label}</span><strong>{address.label} address</strong><span className="checkout-address-lines">{address.line1}<br />{address.city} {address.postal_code}</span></span>
              {addressId === address.id && <Check className="checkout-address-check" size={17} aria-hidden="true" />}
            </label>)}
            <Link href="/customer/account" className="checkout-add-address"><span>＋</span><strong>Add new address</strong><small>Manage your saved delivery addresses</small></Link>
          </fieldset> : <div className="checkout-no-address"><MapPin size={19} /><span>No saved delivery address yet.</span><Link href="/customer/account">Add an address in your account</Link></div>}
          {validation.address && <p className="checkout-field-error" role="alert">{validation.address}</p>}
        </CheckoutSection>

        <CheckoutSection ref={deliverySection} id="checkout-delivery" number="2" title="Delivery preferences" complete={deliveryComplete}>
          <div className={`checkout-preference-grid ${deliverySlots.length > 6 ? 'has-many-slots' : ''}`}>
            <div className="checkout-slot-field"><div className="checkout-field-label">Delivery slot</div>
              {deliverySlots.length ? <fieldset className="checkout-slot-group checkout-radio-group"><legend className="checkout-sr-only">Choose a delivery slot</legend>{[...slotGroups.entries()].map(([day, daySlots]) => <div className="checkout-slot-day" key={day}><h3>{day}</h3>{daySlots.map(item => { const value = item.starts_at; const disabled = item.capacity <= 0; const formatted = formatDeliverySlot({ status: 'placed', delivery_slot_start: item.starts_at, delivery_slot_end: item.ends_at }).display; return <label className={`checkout-slot-card ${slot === value ? 'selected' : ''} ${disabled ? 'is-unavailable' : ''}`} key={value}><input type="radio" name="checkout-slot" value={value} checked={slot === value} disabled={disabled} onChange={() => { setSlot(value); setValidation(current => ({ ...current, slot: undefined })) }} /><span className="checkout-radio-dot" /><span><strong>{formatted}</strong><small>{disabled ? 'Not available' : `${item.capacity} places available`}</small></span></label>})}</div>)}</fieldset> : <p className="checkout-no-address">No delivery slots are available in the next three days.</p>}
              {validation.slot && <p className="checkout-field-error" role="alert">{validation.slot}</p>}
            </div>
            <label className="checkout-instructions"><span className="checkout-field-label">Delivery instructions (optional)</span><textarea value={instructions} maxLength={200} onChange={event => setInstructions(event.target.value)} placeholder="e.g. Call on arrival, leave at the gate" /><small>{instructions.length}/200</small></label>
          </div>
          <div className="checkout-option-grid">
            <label className="checkout-option"><input type="checkbox" checked={contactless} onChange={event => setContactless(event.target.checked)} /><span className="checkout-custom-check" /><span><strong>Contactless delivery</strong><small>Ask the delivery team to leave the order without direct handoff.</small></span></label>
            <label className="checkout-option"><input type="checkbox" checked={substituteUnavailable} onChange={event => setSubstituteUnavailable(event.target.checked)} /><span className="checkout-custom-check" /><span><strong>Allow substitutions</strong><small>Let the fulfilment team substitute an unavailable item.</small></span></label>
          </div>
        </CheckoutSection>

        <CheckoutSection ref={paymentSection} id="checkout-payment" number="3" title="Payment method" complete={paymentComplete}>
          <fieldset className="checkout-payment-grid checkout-radio-group"><legend className="checkout-sr-only">Choose a payment method</legend>
            <label className={`checkout-payment-card ${paymentMethod === 'prepaid' ? 'selected' : ''}`}><input type="radio" name="checkout-payment" checked={paymentMethod === 'prepaid'} onChange={() => { setPaymentMethod('prepaid'); setValidation(current => ({ ...current, payment: undefined })) }} /><span className="checkout-payment-icon"><CreditCard size={20} /></span><span className="checkout-payment-copy"><strong>Pay online</strong><small>UPI, cards and net banking</small></span><span className="checkout-radio-dot" /></label>
            <label className={`checkout-payment-card ${paymentMethod === 'cod' ? 'selected' : ''}`}><input type="radio" name="checkout-payment" checked={paymentMethod === 'cod'} onChange={() => { setPaymentMethod('cod'); setValidation(current => ({ ...current, payment: undefined })) }} /><span className="checkout-payment-icon"><Banknote size={20} /></span><span className="checkout-payment-copy"><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span><span className="checkout-radio-dot" /></label>
          </fieldset>
          {validation.payment && <p className="checkout-field-error" role="alert">{validation.payment}</p>}
          <p className="checkout-demo-note"><ShieldCheck size={15} /> Demo store — no real payments will be taken.</p>
        </CheckoutSection>
        {error && !staleOrder && <p className="checkout-alert" role="alert">{error}</p>}
      </div>
      {summaryCard}
    </div>
    <div className="checkout-mobile-bar">
      {mobileBreakdownOpen && <div className="checkout-mobile-breakdown">{totals}</div>}
      <button type="button" className="checkout-mobile-total" aria-expanded={mobileBreakdownOpen} onClick={() => setMobileBreakdownOpen(open => !open)}><span><small>Total {mobileBreakdownOpen ? '· hide breakdown' : '· view breakdown'}</small><strong>{money(checkoutTotal)}</strong></span><ChevronDown className={mobileBreakdownOpen ? 'is-open' : ''} size={18} /></button>
      {placeButton}
    </div>
  </>
}
