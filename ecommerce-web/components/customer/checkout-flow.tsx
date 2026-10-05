'use client'

import { useState } from 'react'
import Link from 'next/link'
import { addresses, products } from '@/constants/catalog'
import { money } from '@/lib/formatters'
import { calculateCart, type CheckoutDraft } from '@/lib/services/commerce'
import type { Address, CartLine } from '@/types/catalog'
import { CheckoutSection } from './checkout-section'

export function CheckoutFlow() {
  const [lines, setLines] = useState<CartLine[]>([{ product: products[0], quantity: 1, variant: 'Black' }, { product: products[7], quantity: 2, variant: 'Standard box' }])
  const [address, setAddress] = useState<Address>(addresses[0])
  const [slot, setSlot] = useState('Tomorrow, 10 AM - 12 PM')
  const [instructions, setInstructions] = useState('')
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const summary = calculateCart(lines)
  const draft: CheckoutDraft = { address, slot, instructions, payment: 'Razorpay', contactless: true, substituteUnavailable: true, lines }
  return <div className="checkout-layout"><div className="checkout-main"><CheckoutSection title="1. Delivery address"><div className="address-grid">{addresses.map(item => <button className={`address-card ${address.id === item.id ? 'selected' : ''}`} onClick={() => setAddress(item)} key={item.id}><strong>{item.label}</strong><span>{item.recipient}</span><small>{item.line}, {item.city} {item.postalCode}</small><em>{address.id === item.id ? 'Selected' : 'Use this address'}</em></button>)}<button className="address-card add-address">+ Add new address<br /><small>Use map location or enter manually</small></button></div></CheckoutSection><CheckoutSection title="2. Delivery preferences"><div className="form-grid"><label>Preferred delivery slot<select value={slot} onChange={event => setSlot(event.target.value)}><option>Tomorrow, 10 AM - 12 PM</option><option>Tomorrow, 12 PM - 2 PM</option><option>Tomorrow, 6 PM - 8 PM</option></select></label><label>Delivery instructions<textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Gate code, floor, landmark or any special note" /></label></div></CheckoutSection><section className="checkout-section"><h2>3. Secure payment</h2><p>Continue to Razorpay to select and complete your payment securely.</p></section><button className="primary-button place-order" onClick={() => { void draft; setConfirmed(true) }}>Pay securely with Razorpay · {money(summary.total)}</button>{confirmed && <div className="success-panel"><span></span><div><h3>Order placed successfully</h3><p>Your demo checkout is complete.</p><Link className="primary-button" href="/customer/orders">Track order</Link></div></div>}</div><aside className="checkout-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Your cart</h2>{lines.map(line => <div className="summary-line" key={line.product.id}><span>{line.product.emoji} {line.product.name}<small>{line.variant} × {line.quantity}</small></span><b>{money(line.product.price * line.quantity)}</b></div>)}<div className="coupon-box"><input value={coupon} onChange={event => setCoupon(event.target.value)} placeholder="Coupon code" /><button onClick={() => setCouponApplied(Boolean(coupon))}>Apply</button>{couponApplied && <small>Cartly10 applied · 10% off</small>}</div><div className="totals"><span>Subtotal <b>{money(summary.subtotal)}</b></span><span>Delivery <b>{summary.delivery ? money(summary.delivery) : 'Free'}</b></span><span>Packaging <b>{money(summary.packing)}</b></span><span>Discount <b className="in-stock">−{money(summary.discount)}</b></span><strong>Total <b>{money(summary.total)}</b></strong></div></aside></div>
}
