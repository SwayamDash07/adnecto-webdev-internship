'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, CalendarDays, Check, ChevronDown, CreditCard, Info, LockKeyhole, MapPin, RefreshCw, ShieldCheck, Zap, X } from 'lucide-react'
import { money } from '@/lib/formatters'
import { EXPRESS_DELIVERY_FEE } from '@/lib/support-config'
import { uncroppedProductImage } from '@/lib/product-image'
import { useLiveCheckout } from '@/hooks/use-live-checkout'
import { formatDeliverySlot } from '@/lib/delivery-slot'
import { CheckoutSection } from './checkout-section'
import type { CartLine } from '@/types/catalog'
import type { CheckoutAddressRecord, CheckoutDeliveryOptions } from '@/types/checkout'

export function LiveCheckoutFlow({ initialCartLines, initialCartReady, initialAddresses, initialDeliveryOptions, initialDataError }: { initialCartLines: CartLine[]; initialCartReady: boolean; initialAddresses: CheckoutAddressRecord[]; initialDeliveryOptions: CheckoutDeliveryOptions; initialDataError: string }) {
  const router = useRouter()
  const addressSection = useRef<HTMLElement>(null)
  const deliverySection = useRef<HTMLElement>(null)
  const paymentSection = useRef<HTMLElement>(null)
  const submitLock = useRef(false)
  const packagingInfoRef = useRef<HTMLSpanElement>(null)
  const [mobileBreakdownOpen, setMobileBreakdownOpen] = useState(false)
  const [packagingInfoOpen, setPackagingInfoOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [validation, setValidation] = useState<{ address?: string; slot?: string; payment?: string }>({})
  const { lines, totalQuantity, lineKey, ready, addressesFromDatabase, addressId, setAddressId, deliveryOptions, deliverySpeed, setDeliverySpeed, instructions, setInstructions, coupon, setCoupon, couponDiscount, setCouponDiscount, couponMessage, setCouponMessage, paymentMethod, setPaymentMethod, contactless, setContactless, busy, error, orderId, orderReceipt, summary, checkoutTotals, appliedDiscount, checkoutTotal, placeOrder, applyCoupon, dataLoading, dataError, retryCheckoutData } = useLiveCheckout({ initialCartLines, initialCartReady, initialAddresses, initialDeliveryOptions, initialDataError })

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
  if (orderId) {
    const actualWindow = orderReceipt ? formatDeliverySlot({ status: 'placed', delivery_slot_start: orderReceipt.delivery_slot_start, delivery_slot_end: orderReceipt.delivery_slot_end }).display : null
    return <div className="success-panel checkout-success" role="status"><span><Check size={25} /></span><div><p className="eyebrow">ORDER CONFIRMED</p><h3>Order placed successfully</h3><p>Order #{orderId} was saved and inventory was reserved for you.</p>{actualWindow && <p className="checkout-confirmed-window">Your expected delivery is {actualWindow}{orderReceipt?.delivery_speed === 'express' && <span className="express-order-chip">Express</span>}</p>}{orderReceipt && <div className="checkout-confirmed-totals">{orderReceipt.express_fee > 0 && <span>Express delivery <strong>{money(orderReceipt.express_fee)}</strong></span>}<span>Total <strong>{money(orderReceipt.total)}</strong></span></div>}<Link className="primary-button" href="/customer/orders">Track order</Link></div></div>
  }

  const selectedAddress = addressesFromDatabase.find(item => item.id === addressId)
  const selectedDelivery = deliverySpeed === 'express' ? deliveryOptions.express : deliveryOptions.standard
  const selectedSlotValid = Boolean(selectedDelivery && selectedDelivery.capacity > 0)
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
    const firstMissingStep = !addressComplete ? 0 : !deliveryComplete ? 1 : !paymentComplete ? 2 : null
    if (firstMissingStep !== null) { setActiveStep(firstMissingStep); return }
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
    {checkoutTotals.expressFee > 0 && <div><span>Express delivery</span><strong>{money(checkoutTotals.expressFee)}</strong></div>}
    <div><span>Packaging fee <span className="checkout-packaging-info" ref={packagingInfoRef}><button type="button" className="checkout-info" aria-label="Packaging fee information" aria-expanded={packagingInfoOpen} aria-haspopup="dialog" aria-controls="checkout-packaging-info" onClick={() => setPackagingInfoOpen(open => !open)}><Info size={13} /></button>{packagingInfoOpen && <span className="checkout-packaging-popover" id="checkout-packaging-info" role="dialog" aria-label="About the packaging fee">A small fee that helps cover careful packing of your order.<button type="button" aria-label="Close packaging fee information" onClick={() => setPackagingInfoOpen(false)}><X size={14} /></button></span>}</span></span><strong>{money(summary.packing)}</strong></div>
    <div className="checkout-total"><span>Total</span><strong aria-live="polite">{money(checkoutTotal)}</strong></div>
    {(summary.mrpDiscount + appliedDiscount) > 0 && <p className="checkout-save-pill">You’re saving {money(summary.mrpDiscount + appliedDiscount)} on this order</p>}
  </div>

  const placeButton = <button type="button" className="primary-button place-order checkout-place-button" disabled={busy || !totalQuantity || !selectedSlotValid || staleOrder || Boolean(dataError)} aria-disabled={Boolean(missing)} onClick={() => void submit()}>
    {busy ? <><RefreshCw className="checkout-spinner" size={16} /> {paymentMethod === 'cod' ? 'Placing order…' : 'Opening payment…'}</> : paymentMethod === 'cod' ? `Place order - ${money(checkoutTotal)}` : `Pay ${money(checkoutTotal)}`}
  </button>

  const summaryCard = <aside className="checkout-summary">
    <div className="checkout-summary-heading"><div><p className="eyebrow">CHECK BEFORE YOU PLACE IT</p><h2>Order summary</h2></div><Link href="/customer/cart">Edit cart</Link></div>
    <div className="checkout-items" aria-label="Items in your order">
      {lines.slice(0, 2).map(line => <div className="checkout-item" key={lineKey(line)}>
        <div className="checkout-item-image">{line.product.imageUrl ? <Image src={uncroppedProductImage(line.product.imageUrl)} alt={line.product.name} fill sizes="48px" /> : <span>{line.product.emoji}</span>}<b>{line.quantity}</b></div>
        <div className="checkout-item-copy"><strong title={line.product.name}>{line.product.name}</strong><small>{line.quantity} × {money(line.product.price)}</small></div>
        <strong className="checkout-item-total">{money(line.product.price * line.quantity)}</strong>
      </div>)}
      {lines.length > 2 && <p className="checkout-more-items">+ {lines.length - 2} more items · <Link href="/customer/cart">View cart</Link></p>}
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

  const advanceStep = () => {
    if (activeStep === 0 && !addressComplete) { setValidation(current => ({ ...current, address: 'Choose a delivery address to continue.' })); return }
    if (activeStep === 1 && !deliveryComplete) { setValidation(current => ({ ...current, slot: 'Choose an available delivery slot.' })); return }
    setActiveStep(step => Math.min(2, step + 1))
  }
  const progress = <nav className="checkout-progress" aria-label="Checkout steps">{[
    { label: 'Address', done: addressComplete },
    { label: 'Delivery', done: deliveryComplete },
    { label: 'Payment', done: paymentComplete },
  ].map((step, index) => <button type="button" key={step.label} className={`${step.done ? 'is-complete' : ''}${activeStep === index ? ' is-active' : ''}`} aria-current={activeStep === index ? 'step' : undefined} onClick={() => setActiveStep(index)}><span>{step.done ? <Check size={14} /> : index + 1}</span>{step.label}</button>)}</nav>

  return <>
    {progress}
    {dataError && <div className="checkout-alert" role="alert"><span>{dataError}</span><button type="button" onClick={retryCheckoutData}>Retry</button></div>}
    {staleOrder && <div className="checkout-alert" role="alert"><span>Stock or price changed while you were checking out. Review your cart before continuing.</span><Link href="/customer/cart">Review cart</Link></div>}
    <div className="checkout-layout">
      <div className="checkout-main">
        {activeStep === 0 && <CheckoutSection ref={addressSection} id="checkout-address" number="1" title="Delivery address" complete={addressComplete} action={<Link href="/customer/account" className="checkout-section-link">Manage addresses</Link>}>
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
        </CheckoutSection>}

        {activeStep === 1 && <CheckoutSection ref={deliverySection} id="checkout-delivery" number="2" title="Delivery preferences" complete={deliveryComplete}>
          <div className="checkout-delivery-preferences">
            {selectedDelivery ? <div className="checkout-expected-delivery"><span className="checkout-delivery-icon"><CalendarDays size={18} /></span><span className="checkout-expected-copy"><small>Expected delivery</small><strong>{formatDeliverySlot({ status: 'placed', delivery_slot_start: selectedDelivery.starts_at, delivery_slot_end: selectedDelivery.ends_at }).display}</strong></span>{deliverySpeed === 'express' && <span className="express-order-chip">Express</span>}</div> : <p className="checkout-no-delivery" role="status">No delivery slots are available right now. Please try again later.</p>}
            {deliveryOptions.express && <label className={`checkout-express-option${deliverySpeed === 'express' ? ' selected' : ''}`}><input type="checkbox" checked={deliverySpeed === 'express'} onChange={event => { setDeliverySpeed(event.target.checked ? 'express' : 'standard'); setValidation(current => ({ ...current, slot: undefined })) }} /><span className="checkout-delivery-icon checkout-express-icon"><Zap size={18} /></span><span className="checkout-express-copy"><strong>Get it faster</strong><small>Arrives {formatDeliverySlot({ status: 'placed', delivery_slot_start: deliveryOptions.express.starts_at, delivery_slot_end: deliveryOptions.express.ends_at }).display}</small></span><strong className="checkout-express-price">+ Rs {EXPRESS_DELIVERY_FEE}</strong><span className="checkout-switch" aria-hidden="true" /></label>}
            <label className="checkout-instructions"><span className="checkout-field-label">Delivery instructions (optional)</span><textarea rows={3} value={instructions} maxLength={200} onChange={event => setInstructions(event.target.value)} placeholder="e.g. Call on arrival, leave at the gate" /><small>{instructions.length}/200</small></label>
            <label className="checkout-contactless-option"><input type="checkbox" checked={contactless} onChange={event => setContactless(event.target.checked)} /><span className="checkout-custom-check" /><span><strong>Contactless delivery</strong><small>Ask the delivery team to leave the order without direct handoff.</small></span></label>
          </div>
        </CheckoutSection>}

        {activeStep === 2 && <CheckoutSection ref={paymentSection} id="checkout-payment" number="3" title="Payment method" complete={paymentComplete}>
          <fieldset className="checkout-payment-grid checkout-radio-group"><legend className="checkout-sr-only">Choose a payment method</legend>
            <label className={`checkout-payment-card ${paymentMethod === 'prepaid' ? 'selected' : ''}`}><input type="radio" name="checkout-payment" checked={paymentMethod === 'prepaid'} onChange={() => { setPaymentMethod('prepaid'); setValidation(current => ({ ...current, payment: undefined })) }} /><span className="checkout-payment-icon"><CreditCard size={20} /></span><span className="checkout-payment-copy"><strong>Pay online</strong><small>UPI, cards and net banking</small></span><span className="checkout-radio-dot" /></label>
            <label className={`checkout-payment-card ${paymentMethod === 'cod' ? 'selected' : ''}`}><input type="radio" name="checkout-payment" checked={paymentMethod === 'cod'} onChange={() => { setPaymentMethod('cod'); setValidation(current => ({ ...current, payment: undefined })) }} /><span className="checkout-payment-icon"><Banknote size={20} /></span><span className="checkout-payment-copy"><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span><span className="checkout-radio-dot" /></label>
          </fieldset>
          {validation.payment && <p className="checkout-field-error" role="alert">{validation.payment}</p>}
          <p className="checkout-demo-note"><ShieldCheck size={15} /> Demo store — no real payments will be taken.</p>
        </CheckoutSection>}
        {error && !staleOrder && <p className="checkout-alert" role="alert">{error}</p>}
        <div className="checkout-step-actions">{activeStep > 0 && <button type="button" className="secondary-button" onClick={() => setActiveStep(step => Math.max(0, step - 1))}>Back</button>}{activeStep < 2 && <button type="button" className="primary-button" onClick={advanceStep}>Continue to {activeStep === 0 ? 'delivery' : 'payment'}</button>}{activeStep === 2 && <span>Review the total and place your order.</span>}</div>
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
