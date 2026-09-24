'use client'
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { useCart } from '@/lib/cart-store'
import { useAuthUser } from '@/lib/auth-state'
import { Search, ShoppingCart, UserRound, PackageCheck, Menu, ChevronDown } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CartDrawer } from '@/components/shared/cart-drawer'

export function SiteHeader() {
  const { totalQuantity } = useCart()
  const user = useAuthUser()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [badgePulse, setBadgePulse] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  useEffect(() => {
    if (!totalQuantity) return
    setBadgePulse(true)
    const timer = window.setTimeout(() => setBadgePulse(false), 500)
    return () => window.clearTimeout(timer)
  }, [totalQuantity])
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `/customer/search?q=${encodeURIComponent(value)}` : '/customer/search')
  }
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]
  return <>
    <div className="top-strip"><span>Free delivery on orders above ₹499</span><i /> <span>Easy 7-day returns</span><i /> <span>Shop with confidence</span></div>
    <header className="site-header">
      <button className="mobile-menu-button" aria-label="Toggle category menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}><Menu size={20} /></button>
      <Logo />
      <form className="search-bar" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="site-search">Search products</label>
        <select aria-label="Search category"><option>All</option><option>Groceries</option><option>Electronics</option><option>Personal care</option></select>
        <input id="site-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products, brands and more" />
        <button aria-label="Search" type="submit"><Search size={18} strokeWidth={2.2} /></button>
      </form>
      <div className="header-actions">
        <Link className="header-action" href={user ? '/customer/account' : '/auth/sign-in'}><UserRound className="action-icon" size={20} /><span className="header-account"><small>{user ? 'Hello' : 'Hello, sign in'}</small><strong>{user ? name : 'Account & Lists'} <ChevronDown size={11} /></strong></span></Link>
        <Link className="header-action" href="/customer/orders"><PackageCheck className="action-icon" size={20} /><span><small>Returns</small><strong>&amp; Orders</strong></span></Link>
        <button className="header-action cart-link cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Cart, ${totalQuantity} items`}><span className={`cart-number ${badgePulse ? 'pulse' : ''}`}>{totalQuantity}</span><ShoppingCart className="action-icon" size={22} /><strong>Cart</strong></button>
      </div>
    </header>
    <nav className={`category-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Product categories">
      <Link href="/"><Menu size={15} /> All</Link><Link href="/customer/category/groceries">Groceries</Link><Link href="/customer/category/electronics">Electronics</Link><Link href="/customer/category/personal-care">Personal care</Link><Link href="/customer/category/home-appliances">Home &amp; kitchen</Link><Link href="/customer/category/baby-care">Baby care</Link><span className="nav-spacer" /><Link href="/customer/offers">Today&apos;s deals</Link><Link href="/customer/new-arrivals">New arrivals</Link>
    </nav><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
  </>
}
