'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, ChevronUp, Heart, LoaderCircle, LockKeyhole, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { SiteHeader } from '@/components/customer/site-header'
import { cartStore, getGuestCartSessionId, MAX_CART_QUANTITY, readGuestCartSnapshot } from '@/lib/cart-store'
import { setCartItemQuantityAction, syncGuestCartAction } from '@/app/customer/cart/actions'
import { calculateCart } from '@/lib/services/commerce'
import { money } from '@/lib/formatters'
import { uncroppedProductImage } from '@/lib/product-image'
import { useWishlist } from '@/lib/wishlist-store'
import type { CartLine } from '@/types/catalog'
import { FREE_DELIVERY_THRESHOLD } from '@/lib/support-config'

function lineKey(line: Pick<CartLine, 'product' | 'variant'>) {
  return `${line.product.id}:${line.variant ?? ''}`
}

export function CartView({ initialLines, isAuthenticated }: { initialLines: CartLine[]; isAuthenticated: boolean }) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [ready, setReady] = useState(isAuthenticated)
  const [optimisticLines, setOptimisticLines] = useOptimistic(lines, (current, update: { key: string; quantity: number }) => {
    const existing = current.find(line => lineKey(line) === update.key)
    if (update.quantity <= 0) return current.filter(line => lineKey(line) !== update.key)
    if (!existing) return current
    return current.map(line => lineKey(line) === update.key ? { ...line, quantity: update.quantity } : line)
  })
  const [isPending, startTransition] = useTransition()
  const { saved, toggle } = useWishlist()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [undoLine, setUndoLine] = useState<CartLine | null>(null)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const [quantityAnnouncement, setQuantityAnnouncement] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const summary = useMemo(() => calculateCart(optimisticLines), [optimisticLines])
  const totalQuantity = optimisticLines.reduce((total, line) => total + line.quantity, 0)
  const unavailable = optimisticLines.filter(line => line.product.stock <= 0)
  const available = optimisticLines.filter(line => line.product.stock > 0)
  const totalDiscount = summary.mrpDiscount + summary.discount
  const hasUnavailable = unavailable.length > 0

  useEffect(() => {
    if (isAuthenticated) {
      setLines(initialLines)
      setReady(true)
      cartStore.replaceFromServer(initialLines)
      return
    }
    const localLines = readGuestCartSnapshot()
    setLines(localLines)
    setReady(true)
    cartStore.replaceGuestSnapshot(localLines)
    let active = true
    const sessionId = getGuestCartSessionId()
    void syncGuestCartAction(sessionId, localLines.map(line => ({ productId: line.product.id, quantity: line.quantity, variant: line.variant }))).then(result => {
      if (!active || !result.lines) return
      setLines(result.lines)
      cartStore.replaceGuestSnapshot(result.lines)
    })
    const unsubscribe = cartStore.subscribe(() => {
      const snapshot = cartStore.getSnapshot()
      if (!active || !snapshot.ready) return
      setLines(snapshot.lines)
      setReady(true)
    })
    return () => { active = false; unsubscribe() }
  }, [initialLines, isAuthenticated])

  useEffect(() => {
    if (!undoLine) return
    const timer = window.setTimeout(() => setUndoLine(null), 5000)
    return () => window.clearTimeout(timer)
  }, [undoLine])

  useEffect(() => {
    if (!highlightedKey) return
    const timer = window.setTimeout(() => setHighlightedKey(null), 900)
    return () => window.clearTimeout(timer)
  }, [highlightedKey])

  const changeQuantity = (line: CartLine, quantity: number) => {
    const key = lineKey(line)
    setBusyKey(key)
    startTransition(async () => {
      setOptimisticLines({ key, quantity })
      try {
        const result = await setCartItemQuantityAction(line.product.id, quantity, line.variant, isAuthenticated ? undefined : getGuestCartSessionId())
        if (!result.ok) {
          setActionMessage(result.error === 'INSUFFICIENT_STOCK' ? `Only ${result.available} available. Please try again.` : `Couldn't update ${line.product.name}. Please try again.`)
          return
        }
        const updatedProduct = { ...line.product, stock: result.available, stockIsAvailabilityOnly: false }
        const next = result.quantity <= 0
          ? lines.filter(item => lineKey(item) !== key)
          : lines.some(item => lineKey(item) === key)
            ? lines.map(item => lineKey(item) === key ? { ...item, product: updatedProduct, quantity: result.quantity } : item)
            : [...lines, { product: updatedProduct, quantity: result.quantity, variant: line.variant }]
        setLines(next)
        if (isAuthenticated) cartStore.replaceFromServer(next)
        else cartStore.replaceGuestSnapshot(next)
        if (result.quantity === 0) setUndoLine(line)
        setHighlightedKey(key)
        setQuantityAnnouncement(`${line.product.name} quantity updated to ${result.quantity}. Total ${money(calculateCart(next).total)}.`)
        router.refresh()
      } catch {
        setActionMessage(`Couldn't update ${line.product.name}. Please try again.`)
      } finally {
        setBusyKey(current => current === key ? null : current)
      }
    })
  }

  const removeLine = (line: CartLine) => {
    changeQuantity(line, 0)
  }

  const undoRemove = () => {
    if (!undoLine) return
    const line = undoLine
    setUndoLine(null)
    changeQuantity(line, line.quantity)
    setActionMessage('Item restored to your cart.')
  }

  const moveToWishlist = (line: CartLine) => {
    if (!saved.has(line.product.id)) void toggle(line.product)
    changeQuantity(line, 0)
    setActionMessage('Moved to your wishlist.')
  }

  const renderLine = (line: CartLine) => {
    const product = line.product
    const key = lineKey(line)
    const maxQuantity = product.stockIsAvailabilityOnly ? MAX_CART_QUANTITY : product.stock
    const lineTotal = product.price * line.quantity
    const mrpTotal = product.oldPrice * line.quantity
    const discount = product.oldPrice > product.price && product.oldPrice > 0 ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
    const brandIsInName = product.brand && product.name.toLowerCase().startsWith(product.brand.toLowerCase())
    const stockKnown = !product.stockIsAvailabilityOnly

    return <article className={`cart-row ${highlightedKey === key ? 'is-highlighted' : ''} ${product.stock <= 0 ? 'is-unavailable' : ''}`} key={key}>
      <Link className="cart-thumb" href={`/customer/product/${product.id}`} aria-label={`View ${product.name}`}>
        {product.imageUrl ? <Image src={uncroppedProductImage(product.imageUrl)} alt={product.name} fill sizes="96px" /> : <span aria-hidden="true">{product.emoji || <ShoppingBag size={28} />}</span>}
      </Link>
      <div className="cart-item-info">
        {!brandIsInName && product.brand && <p className="cart-item-brand">{product.brand}</p>}
        <Link className="cart-item-name" href={`/customer/product/${product.id}`} title={product.name}>{product.name}</Link>
        {line.variant && line.variant.toLowerCase() !== 'standard' && <span className="cart-variant-chip">{line.variant}</span>}
        {product.stock <= 0 ? <p className="cart-stock cart-stock-out">Out of stock</p> : stockKnown && product.stock < 5 ? <p className="cart-stock cart-stock-low">Only {product.stock} left</p> : null}
      </div>
      <div className="cart-row-side">
        <div className="cart-line-pricing">
          <strong>{money(lineTotal)}</strong>
          {line.quantity > 1 && <small>{money(product.price)} each</small>}
          {discount > 0 && <div className="cart-line-savings"><del>{money(mrpTotal)}</del><span>-{discount}%</span></div>}
        </div>
        <div className="cart-row-controls">
          <div className={`cart-quantity-control ${busyKey === key || isPending || product.stock <= 0 ? 'is-disabled' : ''}`} aria-label={`Qty for ${product.name}`}>
            <button type="button" aria-label={`Decrease quantity of ${product.name}`} disabled={busyKey === key || isPending || line.quantity < 1 || product.stock <= 0} onClick={() => changeQuantity(line, line.quantity - 1)}><Minus size={14} /></button>
            <span aria-live="polite">{busyKey === key ? <LoaderCircle className="cart-inline-spinner" size={14} /> : line.quantity}</span>
            <button type="button" aria-label={`Increase quantity of ${product.name}`} title={line.quantity >= maxQuantity ? `Only ${maxQuantity} available` : undefined} disabled={busyKey === key || isPending || line.quantity >= maxQuantity || product.stock <= 0} onClick={() => changeQuantity(line, line.quantity + 1)}><Plus size={14} /></button>
          </div>
          <div className="cart-row-actions">
            <button type="button" onClick={() => removeLine(line)}><Trash2 size={14} />Remove</button>
            <button type="button" onClick={() => moveToWishlist(line)}><Heart size={14} />Move to wishlist</button>
          </div>
        </div>
      </div>
    </article>
  }

  const summaryCard = <aside className="cart-summary-card panel">
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
    <span className="cart-checkout-disabled-wrap" title={hasUnavailable ? 'Remove out-of-stock items to continue' : undefined}>
      <Link className={`primary-button cart-checkout-button ${hasUnavailable ? 'is-disabled' : ''}`} aria-disabled={hasUnavailable} tabIndex={hasUnavailable ? -1 : undefined} href={hasUnavailable ? '#' : '/customer/checkout'} onClick={event => { if (hasUnavailable) event.preventDefault() }}>Continue to checkout <ArrowRight size={17} /></Link>
    </span>
    <Link className="cart-keep-shopping" href="/">Keep shopping</Link>
    <p className="cart-secure-note"><LockKeyhole size={13} /> Secure checkout - account required</p>
    <p className="cart-demo-note">Demo store - no real payments or orders.</p>
  </aside>

  return <>
    <SiteHeader />
    <main className="module-page cart-page">
      <div className="module-heading cart-page-heading"><div><p className="eyebrow">YOUR CART - {totalQuantity} ITEMS</p><h1>Your shopping cart</h1><p>A quick review before you checkout.</p></div><Link className="secondary-button" href="/">Continue shopping</Link></div>
      {!ready ? <div className="cart-layout cart-loading" aria-label="Loading cart"><section className="panel cart-items">{Array.from({ length: 3 }, (_, index) => <div className="cart-skeleton-row" key={index}><span /><div><i /><i /><i /></div></div>)}</section><aside className="panel cart-summary-skeleton"><i /><i /><i /><i /><i /></aside></div> : optimisticLines.length === 0 ? <section className="panel placeholder cart-empty"><span><ShoppingBag size={30} /></span><h2>Your cart is empty</h2><p>Find something good for your everyday routine.</p><Link className="primary-button" href="/">Start shopping</Link></section> : <>
        <div className="cart-layout">
          <section className="panel cart-items" aria-label="Items in your cart">
            {available.length > 0 && <div className="cart-items-section">{available.map(renderLine)}</div>}
            {unavailable.length > 0 && <div className="cart-items-section cart-unavailable-section"><h2>Unavailable items <span>{unavailable.length}</span></h2>{unavailable.map(renderLine)}</div>}
          </section>
          <div className="cart-summary-desktop">{summaryCard}</div>
        </div>
        <div className="cart-mobile-summary"><button type="button" className="cart-mobile-summary-toggle" aria-expanded={mobileSummaryOpen} onClick={() => setMobileSummaryOpen(open => !open)}><span><small>Total</small><strong>{money(summary.total)}</strong></span>{mobileSummaryOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>{mobileSummaryOpen && <div className="cart-mobile-summary-details">{summaryCard}</div>}<Link href={hasUnavailable ? '#' : '/customer/checkout'} aria-disabled={hasUnavailable} onClick={event => { if (hasUnavailable) event.preventDefault() }} className={`primary-button cart-mobile-checkout ${hasUnavailable ? 'is-disabled' : ''}`}>Checkout <ArrowRight size={17} /></Link></div>
      </>}
      {undoLine && <div className="cart-undo-toast" role="status"><span>{undoLine.product.name} removed</span><button type="button" onClick={undoRemove}>Undo</button></div>}
      {actionMessage && <div className="cart-action-toast" role="status">{actionMessage}<button type="button" aria-label="Dismiss message" onClick={() => setActionMessage('')}>×</button></div>}
      <span className="sr-only" aria-live="polite">{quantityAnnouncement}</span>
    </main>
  </>
}
