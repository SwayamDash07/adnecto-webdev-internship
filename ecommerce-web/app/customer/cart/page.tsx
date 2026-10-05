'use client'

import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader } from '@/components/customer/site-header'
import { cartStore, MAX_CART_QUANTITY, useCart } from '@/lib/cart-store'
import { calculateCart } from '@/lib/services/commerce'
import { money } from '@/lib/formatters'

export default function CartPage() {
  const { lines, totalQuantity, lineKey } = useCart()
  const summary = calculateCart(lines)
  const productSavings = lines.reduce((total, line) => total + Math.max(0, line.product.oldPrice - line.product.price) * line.quantity, 0)
  const totalSavings = productSavings + summary.discount

  return <>
    <SiteHeader />
    <main className="module-page">
      <div className="module-heading"><div><p className="eyebrow">YOUR CART · {totalQuantity} ITEMS</p><h1>Your shopping cart</h1><p>Review your items before secure, account-required checkout.</p></div><Link className="secondary-button" href="/">Continue shopping</Link></div>
      {lines.length === 0 ? <section className="panel placeholder"><span>🛒</span><h2>Your cart is empty</h2><p>Add products from the storefront and they will stay here across reloads.</p><Link className="primary-button" href="/">Start shopping</Link></section> : <div className="cart-layout">
        <section className="panel cart-items">{lines.map(line => { const maxQuantity = line.product.stockIsAvailabilityOnly ? MAX_CART_QUANTITY : line.product.stock; return <article className="cart-row" key={lineKey(line)}><div className={`cart-thumb product-art ${line.product.color}`}>{line.product.imageUrl ? <Image className="product-photo" src={line.product.imageUrl} alt={line.product.name} fill sizes="112px" /> : <span>{line.product.emoji}</span>}</div><div className="cart-item-info"><div className="cart-item-heading"><div><p className="cart-item-category">{line.product.brand ?? line.product.category}</p><h3>{line.product.name}</h3><small>{line.variant ?? 'Standard'} · {money(line.product.price)} each</small></div><strong className="cart-item-price">{money(line.product.price * line.quantity)}</strong></div><div className="cart-controls"><span className="quantity-label">Quantity</span><div className="quantity-control"><button onClick={() => cartStore.update(lineKey(line), line.quantity - 1)} aria-label={`Decrease ${line.product.name}`} disabled={line.quantity <= 1}>−</button><b>{line.quantity}</b><button disabled={line.quantity >= maxQuantity} onClick={() => cartStore.update(lineKey(line), line.quantity + 1)} aria-label={`Increase ${line.product.name}`}>+</button></div><button className="remove" onClick={() => cartStore.remove(lineKey(line))}>Remove</button></div></div></article> })}</section>
        <aside className="cart-overview panel"><p className="eyebrow">CART OVERVIEW</p><h2>Ready when you are</h2><div className="overview-stat"><span>Items in cart</span><strong>{totalQuantity}</strong></div><div className="overview-stat"><span>Current savings</span><strong className="in-stock">{totalSavings ? money(totalSavings) : 'No offer yet'}</strong></div><div className="overview-stat"><span>Delivery</span><strong>{summary.delivery ? money(summary.delivery) : 'Free'}</strong></div><div className="overview-note"><strong>Offers apply at checkout</strong><span>Review your address, delivery slot, coupon and payment method on the next step.</span></div><Link className="primary-button place-order" href="/customer/checkout">Continue to checkout</Link><Link className="cart-overview-link" href="/">Keep shopping</Link></aside>
      </div>}
    </main>
  </>
}
