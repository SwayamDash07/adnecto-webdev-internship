'use client'

import Link from 'next/link'
import { ChevronDown, PackageCheck, UserRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Dispatch, RefObject, SetStateAction } from 'react'

export function AccountMenu({ user, name, open, setOpen, accountMenuRef }: { user: User | null; name?: string; open: boolean; setOpen: Dispatch<SetStateAction<boolean>>; accountMenuRef: RefObject<HTMLDivElement | null> }) {
  return <div className="account-menu-wrap" ref={accountMenuRef}><button className={`header-action account-trigger ${open ? 'is-open' : ''}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu"><UserRound className="action-icon" size={20} /><span className="header-account"><small>{user ? 'Hello' : 'Welcome'}</small><strong>{user ? name : 'Account'} <ChevronDown className="account-chevron" size={11} /></strong></span></button>{open && <div className="account-menu" role="menu"><div className="account-menu-heading"><span className="account-menu-avatar"><UserRound size={17} /></span><span><small>{user ? 'Signed in as' : 'Your Cartly account'}</small><strong>{user ? name : 'Sign in to continue'}</strong></span></div><div className="account-menu-links"><Link href={user ? '/customer/account' : '/auth/sign-in'} role="menuitem" onClick={() => setOpen(false)}><UserRound size={16} /><span><strong>Your account</strong><small>Profile, addresses and wallet</small></span></Link><Link href="/customer/orders" role="menuitem" onClick={() => setOpen(false)}><PackageCheck size={16} /><span><strong>Your orders</strong><small>Track purchases and deliveries</small></span></Link><Link href="/customer/returns" role="menuitem" onClick={() => setOpen(false)}><PackageCheck size={16} /><span><strong>Returns &amp; refunds</strong><small>Start or track a return</small></span></Link></div>{!user && <Link className="account-menu-signin" href="/auth/sign-in" onClick={() => setOpen(false)}>Sign in</Link>}</div>}</div>
}
