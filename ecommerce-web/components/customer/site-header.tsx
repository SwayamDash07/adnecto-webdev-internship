import { Logo } from '@/components/shared/logo'
import { HeaderStateProvider } from './header/header-state'
import { TopStrip } from './header/top-strip'
import { HeaderSearch } from './header/header-search'
import { HeaderActions } from './header/header-actions'
import { CategoryNav, HeaderMenuButton } from './header/category-nav'
import { HeaderCartDrawer } from './header/header-cart-drawer'

export function SiteHeader() {
  return <HeaderStateProvider><TopStrip /><header className="site-header"><HeaderMenuButton /><Logo /><HeaderSearch /><HeaderActions /></header><CategoryNav /><HeaderCartDrawer /></HeaderStateProvider>
}
