'use client'

import { CartDrawer } from '@/components/shared/cart-drawer'
import { useHeaderState } from './header-state'

export function HeaderCartDrawer() {
  const { cartOpen, setCartOpen } = useHeaderState()
  return <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
}
