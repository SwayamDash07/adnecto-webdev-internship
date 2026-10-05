'use client'

import { Menu } from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { CartDrawer } from '@/components/shared/cart-drawer'
import { useSiteHeader } from '@/hooks/use-site-header'
import { TopStrip } from './header/top-strip'
import { HeaderSearch } from './header/header-search'
import { HeaderActions } from './header/header-actions'
import { CategoryNav } from './header/category-nav'

export function SiteHeader() {
  const header = useSiteHeader()
  return <><TopStrip /><header className="site-header">{!header.hideCategoryNav && <button className="mobile-menu-button" aria-label="Toggle category menu" aria-expanded={header.mobileNavOpen} onClick={() => header.setMobileNavOpen(value => !value)}><Menu size={20} /></button>}<Logo /><HeaderSearch query={header.query} setQuery={header.setQuery} submitSearch={header.submitSearch} /><HeaderActions totalQuantity={header.totalQuantity} badgePulse={header.badgePulse} setCartOpen={header.setCartOpen} user={header.user} name={header.name} accountMenuOpen={header.accountMenuOpen} setAccountMenuOpen={header.setAccountMenuOpen} accountMenuRef={header.accountMenuRef} /></header>{!header.hideCategoryNav && <CategoryNav open={header.mobileNavOpen} />}<CartDrawer open={header.cartOpen} onClose={() => header.setCartOpen(false)} /></>
}
