'use client'

import { LoaderCircle, Minus, Plus, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import type { Product } from '@/types/catalog'
import { cartStore, MAX_CART_QUANTITY, useCart } from '@/lib/cart-store'
import { showCartActionToast, showCartToast } from './cart-toast'

export function CartAddControl({ product, variant, className = '' }: { product: Product; variant?: string; className?: string }) {
  const { lines, lineKey } = useCart()
  const [pending, setPending] = useState(false)
  const resolvedVariant = variant ?? product.variants?.[0] ?? 'Standard'
  const activeVariant = resolvedVariant.toLowerCase() !== 'standard' ? resolvedVariant : undefined
  const line = lines.find(item => lineKey(item) === `${product.id}:${activeVariant ?? ''}`)
  const stockProduct = line?.product ?? product
  const quantity = line?.quantity ?? 0
  const stockKnown = !stockProduct.stockIsAvailabilityOnly
  const max = stockKnown ? Math.min(MAX_CART_QUANTITY, Math.max(0, stockProduct.stock)) : MAX_CART_QUANTITY

  const change = async (delta: number) => {
    if (pending) return
    // The first click can happen before the hydration effect has read a saved
    // guest cart. Hydrate synchronously so an existing quantity is incremented,
    // rather than overwritten, and don't make the control inert while mounting.
    if (!cartStore.getSnapshot().ready) cartStore.hydrate()
    const currentLines = cartStore.getSnapshot().lines
    const currentLine = currentLines.find(item => lineKey(item) === `${product.id}:${activeVariant ?? ''}`)
    const previous = currentLine?.quantity ?? 0
    const next = previous + delta
    if (next < 0 || next > MAX_CART_QUANTITY) return
    setPending(true)
    let result
    try {
      result = await cartStore.setQuantityValidated(product, next, activeVariant)
    } catch (error) {
      console.error('Cart quantity update failed:', error)
      showCartActionToast('Could not update your cart. Please check your connection and try again.')
      return
    } finally {
      setPending(false)
    }
    if (!result.ok) {
      if (result.available >= 0 && (result.error === 'INSUFFICIENT_STOCK' || result.error === 'MAX_QUANTITY_EXCEEDED')) {
        const corrected = Math.min(result.quantity, result.available, MAX_CART_QUANTITY)
        if (corrected !== previous) {
          const correction = await cartStore.setQuantityValidated(product, corrected, activeVariant)
          if (!correction.ok) cartStore.setProductAvailability(product.id, result.available)
        } else cartStore.setProductAvailability(product.id, result.available)
      }
      showCartActionToast(result.available >= 0 && result.error === 'INSUFFICIENT_STOCK'
        ? `Only ${result.available} available${result.available < previous ? ` — we've set your cart to ${Math.min(result.available, result.quantity)}.` : '.'}`
        : result.error === 'PRODUCT_UNAVAILABLE'
          ? 'This product is currently unavailable.'
          : result.error === 'CART_SERVICE_UNAVAILABLE'
            ? 'Cart service is unavailable. Please refresh and try again.'
            : `Could not update your cart${result.error ? ` (${result.error})` : ''}. Please try again.`)
      return
    }
    if (previous === 0 && result.quantity > 0) showCartToast(`${product.name} added to cart`, product)
    if (previous > 0 && result.quantity === 0) {
      showCartActionToast(`${product.name} removed from cart`, 'Undo', async () => {
        const restored = await cartStore.setQuantityValidated(product, previous, activeVariant)
        if (restored.ok) showCartActionToast(`${product.name} restored to cart.`)
        else showCartActionToast(`Could not restore ${product.name}. Only ${restored.available} available.`)
      }, 5000)
    }
  }

  if (stockKnown && max === 0) return <div className={`cart-control-wrap ${className}`}><button className="add-button cart-add-control is-unavailable" disabled>Out of stock</button><small className="cart-control-stock cart-control-stock-placeholder" aria-hidden="true">&nbsp;</small></div>
  if (quantity === 0) return <div className={`cart-control-wrap ${className}`}><button className="add-button cart-add-control" disabled={pending} onClick={() => void change(1)}>
    {pending ? <LoaderCircle className="cart-control-spinner" size={16} /> : <><ShoppingCart size={15} /> Add to cart</>}
  </button><small className={`cart-control-stock ${stockKnown && stockProduct.stock <= 5 ? '' : 'cart-control-stock-placeholder'}`} aria-hidden={!stockKnown || stockProduct.stock > 5}>{stockKnown && stockProduct.stock <= 5 ? `Only ${stockProduct.stock} left` : '\u00a0'}</small></div>

  const atLimit = quantity >= max
  return <div className={`cart-control-wrap ${className}`}>
    <div className={`cart-stepper ${pending ? 'is-pending' : ''}`} aria-label={`${product.name} quantity`} title={atLimit ? `Only ${max} available` : undefined}>
      <button type="button" disabled={pending || quantity <= 0} onClick={() => void change(-1)} aria-label={`Decrease quantity of ${product.name}`}><Minus size={15} /></button>
      <span aria-live="polite">{pending ? <LoaderCircle className="cart-control-spinner" size={15} /> : quantity}</span>
      <button type="button" disabled={pending || atLimit} title={atLimit ? `Only ${max} available` : undefined} onClick={() => void change(1)} aria-label={`Increase quantity of ${product.name}`}><Plus size={15} /></button>
    </div>
    <small className={`cart-control-stock ${stockKnown && stockProduct.stock <= 5 ? '' : 'cart-control-stock-placeholder'}`} aria-hidden={!stockKnown || stockProduct.stock > 5}>{stockKnown && stockProduct.stock <= 5 ? `Only ${stockProduct.stock} left` : '\u00a0'}</small>
  </div>
}
