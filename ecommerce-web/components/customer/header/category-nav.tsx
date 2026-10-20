'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useHeaderState } from './header-state'

export function HeaderMenuButton() {
  const { hideCategoryNav, mobileNavOpen, setMobileNavOpen } = useHeaderState()
  if (hideCategoryNav) return null
  return <button type="button" className="mobile-menu-button" aria-label="Toggle category menu" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(value => !value)}><Menu size={20} /></button>
}

export function CategoryNav() {
  const { hideCategoryNav, mobileNavOpen } = useHeaderState()
  if (hideCategoryNav) return null
  return <nav className={`category-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Product categories"><Link href="/"><Menu size={15} /> All</Link><Link href="/customer/category/groceries">Groceries</Link><Link href="/customer/category/electronics">Electronics</Link><Link href="/customer/category/personal-care">Personal care</Link><Link href="/customer/category/home-appliances">Home &amp; kitchen</Link><Link href="/customer/category/baby-care">Baby care</Link><span className="nav-spacer" /><Link href="/customer/offers">Today&apos;s deals</Link><Link href="/customer/new-arrivals">New arrivals</Link></nav>
}
