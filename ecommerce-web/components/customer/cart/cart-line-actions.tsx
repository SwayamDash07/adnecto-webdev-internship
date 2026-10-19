'use client'

import { useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Minus, Plus, Trash2 } from 'lucide-react'
import { setCartItemQuantityAction } from '@/app/customer/cart/actions'
import { useCartFeedback } from './cart-feedback'
import { useWishlist } from '@/lib/wishlist-store'
import { cartStore } from '@/lib/cart-store'
import type { CartLine } from '@/types/catalog'

export function CartLineActions({ line, maxQuantity }: { line: CartLine; maxQuantity: number }) {
  const router = useRouter()
  const [quantity, setQuantity] = useOptimistic(line.quantity, (_current, next: number) => next)
  const [pending, startTransition] = useTransition()
  const { setRemovedLine, showMessage } = useCartFeedback()
  const { saved, toggle } = useWishlist()
  const unavailable = line.product.stock <= 0

  function update(nextQuantity: number, successMessage?: string, allowUndo = true) {
    startTransition(async () => {
      setQuantity(nextQuantity)
      const result = await setCartItemQuantityAction(line.product.id, nextQuantity, line.variant)
      if (!result.ok) {
        showMessage(result.error === 'INSUFFICIENT_STOCK' ? `Only ${result.available} available. Please try again.` : `Could not update ${line.product.name}. Please try again.`)
        return
      }
      if (result.lines) cartStore.replaceFromServer(result.lines)
      if (nextQuantity === 0 && allowUndo) setRemovedLine(line)
      else if (successMessage) showMessage(successMessage)
      router.refresh()
    })
  }

  function saveForLater() {
    if (!saved.has(line.product.id)) void toggle(line.product)
    update(0, 'Moved to your wishlist.', false)
  }

  return <>
    <div className={`cart-quantity-control ${pending || unavailable ? 'is-disabled' : ''}`} aria-label={`Qty for ${line.product.name}`}>
      <button type="button" aria-label={`Decrease quantity of ${line.product.name}`} disabled={pending || quantity < 1 || unavailable} onClick={() => update(quantity - 1)}><Minus size={14} /></button>
      <span aria-live="polite">{quantity}</span>
      <button type="button" aria-label={`Increase quantity of ${line.product.name}`} title={quantity >= maxQuantity ? `Only ${maxQuantity} available` : undefined} disabled={pending || quantity >= maxQuantity || unavailable} onClick={() => update(quantity + 1)}><Plus size={14} /></button>
    </div>
    <div className="cart-row-actions">
      <button type="button" disabled={pending} onClick={() => update(0)}><Trash2 size={14} />Remove</button>
      <button type="button" disabled={pending} onClick={saveForLater}><Heart size={14} />Move to wishlist</button>
    </div>
  </>
}
