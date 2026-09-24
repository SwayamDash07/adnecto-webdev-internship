'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect } from 'react'
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { cartStore, useCart } from '@/lib/cart-store'
import { calculateCart } from '@/lib/services/commerce'
import { money } from '@/lib/data'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, totalQuantity, lineKey } = useCart()
  const summary = calculateCart(lines)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null
  return <div className="drawer-backdrop" role="presentation" onClick={onClose}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><p className="eyebrow">YOUR BASKET</p><h2>Cart <span>({totalQuantity})</span></h2></div><button className="drawer-close" onClick={onClose} aria-label="Close cart"><X size={19} /></button></div>
      {lines.length === 0 ? <div className="drawer-empty"><span className="empty-icon"><ShoppingBag size={27} /></span><h3>Your basket is empty</h3><p>Find something good for your everyday routine.</p><button className="primary-button" onClick={onClose}>Start shopping</button></div> : <>
        <div className="drawer-lines">{lines.map(line => <div className="drawer-line" key={lineKey(line)}><div className={`drawer-thumb product-art ${line.product.color}`}>{line.product.imageUrl ? <Image src={line.product.imageUrl} alt="" fill sizes="66px" /> : <span>{line.product.emoji}</span>}</div><div className="drawer-line-copy"><strong>{line.product.name}</strong><small>{line.variant ?? 'Standard'} · {money(line.product.price)}</small><div className="drawer-controls"><button onClick={() => cartStore.update(lineKey(line), line.quantity - 1)} aria-label={`Decrease ${line.product.name}`}><Minus size={13} /></button><b>{line.quantity}</b><button disabled={line.quantity >= line.product.stock} onClick={() => cartStore.update(lineKey(line), line.quantity + 1)} aria-label={`Increase ${line.product.name}`}><Plus size={13} /></button><button className="drawer-remove" onClick={() => cartStore.remove(lineKey(line))} aria-label={`Remove ${line.product.name}`}><Trash2 size={14} /></button></div></div><strong className="drawer-line-total">{money(line.product.price * line.quantity)}</strong></div>)}</div>
        <div className="drawer-footer"><div className="drawer-total"><span>Subtotal</span><strong>{money(summary.subtotal)}</strong></div><p>Delivery and taxes are calculated at checkout.</p><Link className="primary-button drawer-checkout" href="/customer/checkout" onClick={onClose}>Checkout <ArrowRight size={16} /></Link><Link className="drawer-view-cart" href="/customer/cart" onClick={onClose}>View full cart</Link></div>
      </>}
    </aside>
  </div>
}
