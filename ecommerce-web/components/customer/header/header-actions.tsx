'use client'

import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { AccountMenu } from './account-menu'
import { useHeaderState } from './header-state'

export function HeaderActions() {
  const { totalQuantity, badgePulse, setCartOpen, user, name } = useHeaderState()
  return <div className="header-actions"><Link className="header-action wishlist-nav-link" href="/customer/wishlist" aria-label="Open wishlist"><Heart className="action-icon" size={22} /><strong>Wishlist</strong></Link><button type="button" className="header-action cart-link cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Cart, ${totalQuantity} items`}><span className={`cart-number ${badgePulse ? 'pulse' : ''}`}>{totalQuantity}</span><ShoppingCart className={`action-icon ${badgePulse ? 'cart-icon-bounce' : ''}`} size={22} /><strong>Cart</strong></button><AccountMenu user={user} name={name} /></div>
}
