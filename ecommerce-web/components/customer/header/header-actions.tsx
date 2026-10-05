'use client'

import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { AccountMenu } from './account-menu'

export function HeaderActions({ totalQuantity, badgePulse, setCartOpen, user, name, accountMenuOpen, setAccountMenuOpen, accountMenuRef }: { totalQuantity: number; badgePulse: boolean; setCartOpen: (value: boolean) => void; user: User | null; name?: string; accountMenuOpen: boolean; setAccountMenuOpen: Dispatch<SetStateAction<boolean>>; accountMenuRef: RefObject<HTMLDivElement | null> }) {
  return <div className="header-actions"><Link className="header-action wishlist-nav-link" href="/customer/wishlist" aria-label="Open wishlist"><Heart className="action-icon" size={22} /><strong>Wishlist</strong></Link><button className="header-action cart-link cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Cart, ${totalQuantity} items`}><span className={`cart-number ${badgePulse ? 'pulse' : ''}`}>{totalQuantity}</span><ShoppingCart className="action-icon" size={22} /><strong>Cart</strong></button><AccountMenu user={user} name={name} open={accountMenuOpen} setOpen={setAccountMenuOpen} accountMenuRef={accountMenuRef} /></div>
}
