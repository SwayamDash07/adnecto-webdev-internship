import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, LockKeyhole, ShoppingBag } from 'lucide-react'
import { SiteHeader } from '@/components/customer/site-header'
import { CartLineActions } from './cart-line-actions'
import { CartActionFeedback, CartFeedbackProvider } from './cart-feedback'
import { CartMobileSummary } from './cart-mobile-summary'
import { calculateCart } from '@/lib/services/commerce'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { FREE_DELIVERY_THRESHOLD } from '@/lib/support-config'
import type { CartLine } from '@/types/catalog'

function cartSummary(lines: CartLine[]) {
  const summary = calculateCart(lines)
  const totalDiscount = summary.mrpDiscount + summary.discount
  return <aside className="cart-summary-card panel">
    <p className="eyebrow">CART TOTALS</p><h2>Order summary</h2>
    <div className="cart-summary-rows">
      <div><span>MRP subtotal</span><strong>{money(summary.mrpSubtotal)}</strong></div>
      {summary.mrpDiscount > 0 && <div><span>MRP discount</span><strong className="cart-summary-green">−{money(summary.mrpDiscount)}</strong></div>}
      {summary.discount > 0 && <div><span>Offer discount</span><strong className="cart-summary-green">−{money(summary.discount)}</strong></div>}
      <div><span>Delivery</span><strong className="cart-summary-green">{summary.delivery ? money(summary.delivery) : 'Free'}</strong></div>
      {summary.gst > 0 && <div><span>Taxes</span><strong>{money(summary.gst)}</strong></div>}
      {summary.packing > 0 && <div><span>Packaging</span><strong>{money(summary.packing)}</strong></div>}
    </div>
    <div className="cart-total-row"><span>Total</span><strong>{money(summary.total)}</strong></div>
    {totalDiscount > 0 && <p className="cart-savings-pill"><Check size={14} /> You’re saving {money(totalDiscount)} on this order</p>}
    {summary.subtotal < FREE_DELIVERY_THRESHOLD && <div className="cart-free-delivery"><p>Add {money(FREE_DELIVERY_THRESHOLD - summary.subtotal)} more for free delivery</p><div><span style={{ width: `${Math.min(100, (summary.subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }} /></div></div>}
    <p className="cart-coupon-note">Coupons and offers can be applied at checkout.</p>
    <span className="cart-checkout-disabled-wrap"><Link className="primary-button cart-checkout-button" href="/customer/checkout">Continue to checkout <ArrowRight size={17} /></Link></span>
    <Link className="cart-keep-shopping" href="/">Keep shopping</Link>
    <p className="cart-secure-note"><LockKeyhole size={13} /> Secure checkout - account required</p>
    <p className="cart-demo-note">Demo store - no real payments or orders.</p>
  </aside>
}

export function CartServerView({ lines }: { lines: CartLine[] }) {
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
  const available = lines.filter(line => line.product.stock > 0)
  const unavailable = lines.filter(line => line.product.stock <= 0)
  const summary = cartSummary(lines)

  return <CartFeedbackProvider><SiteHeader /><main className="module-page cart-page">
    <div className="module-heading cart-page-heading"><div><p className="eyebrow">YOUR CART - {totalQuantity} ITEMS</p><h1>Your shopping cart</h1><p>A quick review before you checkout.</p></div><Link className="secondary-button" href="/">Continue shopping</Link></div>
    {lines.length === 0 ? <section className="panel placeholder cart-empty"><span><ShoppingBag size={30} /></span><h2>Your cart is empty</h2><p>Find something good for your everyday routine.</p><Link className="primary-button" href="/">Start shopping</Link></section> : <>
      <div className="cart-layout">
        <section className="panel cart-items" aria-label="Items in your cart">
          {available.length > 0 && <div className="cart-items-section">{available.map(line => <CartRow key={`${line.product.id}:${line.variant ?? ''}`} line={line} />)}</div>}
          {unavailable.length > 0 && <div className="cart-items-section cart-unavailable-section"><h2>Unavailable items <span>{unavailable.length}</span></h2>{unavailable.map(line => <CartRow key={`${line.product.id}:${line.variant ?? ''}`} line={line} />)}</div>}
        </section>
        <div className="cart-summary-desktop">{summary}</div>
      </div>
      <CartMobileSummary total={money(calculateCart(lines).total)} hasUnavailable={unavailable.length > 0}>{summary}</CartMobileSummary>
    </>}
    <CartActionFeedback />
  </main></CartFeedbackProvider>
}

function CartRow({ line }: { line: CartLine }) {
  const product = line.product
  const lineTotal = product.price * line.quantity
  const mrpTotal = product.oldPrice * line.quantity
  const discount = product.oldPrice > product.price && product.oldPrice > 0 ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
  const brandIsInName = product.brand && product.name.toLowerCase().startsWith(product.brand.toLowerCase())
  const maxQuantity = product.stockIsAvailabilityOnly ? 99 : product.stock

  return <article className={`cart-row ${product.stock <= 0 ? 'is-unavailable' : ''}`}>
    <Link className="cart-thumb" href={`/customer/product/${product.id}`} aria-label={`View ${product.name}`}>
      {product.imageUrl ? <Image src={uncroppedProductImage(product.imageUrl)} alt={product.name} fill sizes="96px" /> : <span aria-hidden="true">{product.emoji || <ShoppingBag size={28} />}</span>}
    </Link>
    <div className="cart-item-info">
      {!brandIsInName && product.brand && <p className="cart-item-brand">{product.brand}</p>}
      <Link className="cart-item-name" href={`/customer/product/${product.id}`} title={product.name}>{product.name}</Link>
      {line.variant && line.variant.toLowerCase() !== 'standard' && <span className="cart-variant-chip">{line.variant}</span>}
      {product.stock <= 0 ? <p className="cart-stock cart-stock-out">Out of stock</p> : !product.stockIsAvailabilityOnly && product.stock < 5 ? <p className="cart-stock cart-stock-low">Only {product.stock} left</p> : null}
    </div>
    <div className="cart-row-side">
      <div className="cart-line-pricing"><strong>{money(lineTotal)}</strong>{line.quantity > 1 && <small>{money(product.price)} each</small>}{discount > 0 && <div className="cart-line-savings"><del>{money(mrpTotal)}</del><span>-{discount}%</span></div>}</div>
      <div className="cart-row-controls"><CartLineActions line={line} maxQuantity={maxQuantity} /></div>
    </div>
  </article>
}
