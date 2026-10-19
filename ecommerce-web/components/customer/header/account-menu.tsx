'use client'

import Link from 'next/link'
import { ChevronDown, PackageCheck, UserRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'

export function AccountMenu({ user, name }: { user: User | null; name?: string }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  const close = () => setOpen(false)
  return <div className="account-menu-wrap" ref={menuRef}><button type="button" className={`header-action account-trigger ${open ? 'is-open' : ''}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu" aria-controls="store-account-menu"><UserRound className="action-icon" size={20} /><span className="header-account"><small>{user ? 'Hello' : 'Welcome'}</small><strong>{user ? name : 'Account'} <ChevronDown className="account-chevron" size={11} /></strong></span></button>{open && <div className="account-menu" id="store-account-menu" role="menu"><div className="account-menu-heading"><span className="account-menu-avatar"><UserRound size={17} /></span><span><small>{user ? 'Signed in as' : 'Your Cartly account'}</small><strong>{user ? name : 'Sign in to continue'}</strong></span></div><div className="account-menu-links"><Link href={user ? '/customer/account' : '/auth/sign-in'} role="menuitem" onClick={close}><UserRound size={16} /><span><strong>Your account</strong><small>Profile, addresses and wallet</small></span></Link><Link href="/customer/orders" role="menuitem" onClick={close}><PackageCheck size={16} /><span><strong>Your orders</strong><small>Track purchases and deliveries</small></span></Link><Link href="/customer/support" role="menuitem" onClick={close}><PackageCheck size={16} /><span><strong>Customer support</strong><small>Get help with your orders</small></span></Link></div>{!user && <Link className="account-menu-signin" href="/auth/sign-in" onClick={close}>Sign in</Link>}</div>}</div>
}
