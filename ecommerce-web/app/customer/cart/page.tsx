'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader } from '@/components/customer/site-header'
import { cartStore, useCart } from '@/lib/cart-store'
import { calculateCart } from '@/lib/services/commerce'
import { money } from '@/lib/data'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function CartPage() {
  const { lines, totalQuantity, lineKey } = useCart()
  const summary = calculateCart(lines)
  const [coupon, setCoupon] = useState(''); const [couponDiscount, setCouponDiscount] = useState(0); const [couponMessage, setCouponMessage] = useState('')
  useEffect(() => { setCoupon(localStorage.getItem('cartly_coupon_code') ?? '') }, [])
  async function applyCoupon() {
    setCouponMessage(''); setCouponDiscount(0)
    if (!coupon.trim()) { localStorage.removeItem('cartly_coupon_code'); setCouponMessage('Enter a coupon code.'); return }
    const client = createSupabaseBrowserClient(); if (!client) return
    const { data, error } = await client.rpc('customer_validate_coupon', { p_code: coupon, p_subtotal: summary.subtotal })
    if (error) setCouponMessage(error.message)
    else { const result = (data?.[0] ?? data) as { valid: boolean; discount: number; message: string } | null; setCouponDiscount(result?.valid ? Number(result.discount) : 0); setCouponMessage(result?.message ?? 'Coupon could not be applied.'); if (result?.valid) localStorage.setItem('cartly_coupon_code', coupon.trim()) }
  }
  const total = Math.max(0, summary.total - couponDiscount)
  return <><SiteHeader /><main className="module-page"><div className="module-heading"><div><p className="eyebrow">YOUR CART · {totalQuantity} ITEMS</p><h1>Your shopping cart</h1><p>Review your items before secure, account-required checkout.</p></div><Link className="secondary-button" href="/">← Continue shopping</Link></div>{lines.length === 0 ? <section className="panel placeholder"><span>🛒</span><h2>Your cart is empty</h2><p>Add products from the storefront and they will stay here across reloads.</p><Link className="primary-button" href="/">Start shopping</Link></section> : <div className="cart-layout"><section className="panel cart-items">{lines.map(line => <div className="cart-row" key={lineKey(line)}><div className={`cart-thumb product-art ${line.product.color}`}>{line.product.imageUrl ? <Image className="product-photo" src={line.product.imageUrl} alt={line.product.name} fill sizes="88px" /> : <span>{line.product.emoji}</span>}</div><div><h3>{line.product.name}</h3><small>{line.variant ?? 'Standard'} · {money(line.product.price)} each</small><div className="cart-controls"><button onClick={() => cartStore.update(lineKey(line), line.quantity - 1)}>−</button><b>{line.quantity}</b><button disabled={line.quantity >= line.product.stock} onClick={() => cartStore.update(lineKey(line), line.quantity + 1)}>+</button><button className="remove" onClick={() => cartStore.remove(lineKey(line))}>Remove</button></div></div><strong>{money(line.product.price * line.quantity)}</strong></div>)}</section><aside className="checkout-summary"><p className="eyebrow">ORDER SUMMARY</p><h2>Cart total</h2><div className="coupon-box"><input value={coupon} onChange={event => { setCoupon(event.target.value); setCouponDiscount(0); setCouponMessage('') }} placeholder="Enter coupon code" /><button onClick={() => void applyCoupon()}>Apply</button>{couponMessage && <small className={couponDiscount ? 'in-stock' : 'low-stock'}>{couponMessage}</small>}</div><div className="totals"><span>Subtotal <b>{money(summary.subtotal)}</b></span><span>Delivery <b>{summary.delivery ? money(summary.delivery) : 'Free'}</b></span><span>Packaging <b>{money(summary.packing)}</b></span><span>Discount <b className="in-stock">−{money(summary.discount + couponDiscount)}</b></span><strong>Total <b>{money(total)}</b></strong></div><Link className="primary-button place-order" href="/customer/checkout">Proceed to checkout <span>→</span></Link></aside></div>}</main></>
}
