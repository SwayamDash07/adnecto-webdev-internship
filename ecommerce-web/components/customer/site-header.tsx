'use client'
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { useCart } from '@/lib/cart-store'
import { useAuthUser } from '@/lib/auth-state'
import { Heart, Search, ShoppingCart, UserRound, PackageCheck, Menu, ChevronDown } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CartDrawer } from '@/components/shared/cart-drawer'

export function SiteHeader() {
  const { totalQuantity } = useCart()
  const user = useAuthUser()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [badgePulse, setBadgePulse] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!totalQuantity) return
    setBadgePulse(true)
    const timer = window.setTimeout(() => setBadgePulse(false), 500)
    return () => window.clearTimeout(timer)
  }, [totalQuantity])
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => { if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setAccountMenuOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountMenuOpen(false) }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `/customer/search?q=${encodeURIComponent(value)}` : '/customer/search')
  }
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]
  const hideCategoryNav = ['/customer/account', '/customer/orders', '/customer/returns', '/customer/support', '/customer/cart', '/customer/checkout', '/customer/wishlist'].some(route => pathname === route || pathname.startsWith(`${route}/`))
  return <>
    <div className="top-strip"><span>Free delivery on orders above ₹499</span><i /> <span>Easy 7-day returns</span><i /> <span>Shop with confidence</span></div>
    <header className="site-header">
      {!hideCategoryNav && <button className="mobile-menu-button" aria-label="Toggle category menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}><Menu size={20} /></button>}
      <Logo />
      <form className="search-bar" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="site-search">Search products</label>
        <select aria-label="Search category"><option>All</option><option>Groceries</option><option>Electronics</option><option>Personal care</option></select>
        <input id="site-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products, brands and more" />
        <button aria-label="Search" type="submit"><Search size={18} strokeWidth={2.2} /></button>
      </form>
      <div className="header-actions">
        <Link className="header-action wishlist-nav-link" href="/customer/wishlist" aria-label="Open wishlist"><Heart className="action-icon" size={22} /><strong>Wishlist</strong></Link>
        <button className="header-action cart-link cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Cart, ${totalQuantity} items`}><span className={`cart-number ${badgePulse ? 'pulse' : ''}`}>{totalQuantity}</span><ShoppingCart className="action-icon" size={22} /><strong>Cart</strong></button>
        <div className="account-menu-wrap" ref={accountMenuRef}>
          <button className={`header-action account-trigger ${accountMenuOpen ? 'is-open' : ''}`} onClick={() => setAccountMenuOpen(value => !value)} aria-expanded={accountMenuOpen} aria-haspopup="menu">
            <UserRound className="action-icon" size={20} /><span className="header-account"><small>{user ? 'Hello' : 'Welcome'}</small><strong>{user ? name : 'Account'} <ChevronDown className="account-chevron" size={11} /></strong></span>
          </button>
          {accountMenuOpen && <div className="account-menu" role="menu">
            <div className="account-menu-heading"><span className="account-menu-avatar"><UserRound size={17} /></span><span><small>{user ? 'Signed in as' : 'Your Cartly account'}</small><strong>{user ? name : 'Sign in to continue'}</strong></span></div>
            <div className="account-menu-links">
              <Link href={user ? '/customer/account' : '/auth/sign-in'} role="menuitem" onClick={() => setAccountMenuOpen(false)}><UserRound size={16} /><span><strong>Your account</strong><small>Profile, addresses and wallet</small></span></Link>
              <Link href="/customer/orders" role="menuitem" onClick={() => setAccountMenuOpen(false)}><PackageCheck size={16} /><span><strong>Your orders</strong><small>Track purchases and deliveries</small></span></Link>
              <Link href="/customer/returns" role="menuitem" onClick={() => setAccountMenuOpen(false)}><PackageCheck size={16} /><span><strong>Returns &amp; refunds</strong><small>Start or track a return</small></span></Link>
            </div>
            {!user && <Link className="account-menu-signin" href="/auth/sign-in" onClick={() => setAccountMenuOpen(false)}>Sign in</Link>}
          </div>}
        </div>
      </div>
    </header>
    {!hideCategoryNav && <nav className={`category-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Product categories">
      <Link href="/"><Menu size={15} /> All</Link><Link href="/customer/category/groceries">Groceries</Link><Link href="/customer/category/electronics">Electronics</Link><Link href="/customer/category/personal-care">Personal care</Link><Link href="/customer/category/home-appliances">Home &amp; kitchen</Link><Link href="/customer/category/baby-care">Baby care</Link><span className="nav-spacer" /><Link href="/customer/offers">Today&apos;s deals</Link><Link href="/customer/new-arrivals">New arrivals</Link>
    </nav>}<CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
  </>
}
