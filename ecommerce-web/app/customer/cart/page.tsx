import nextDynamic from 'next/dynamic'
import { CartServerView } from '@/components/customer/cart/cart-server-view'
import { getCurrentCartSnapshot } from '@/lib/cart-server'

const GuestCartView = nextDynamic(() => import('@/components/customer/cart/cart-view').then(module => module.CartView), {
  loading: () => <div className="module-page cart-page"><div className="cart-layout cart-loading" aria-label="Loading cart"><section className="panel cart-items">{Array.from({ length: 3 }, (_, index) => <div className="cart-skeleton-row" key={index}><span /><div><i /><i /><i /></div></div>)}</section><aside className="panel cart-summary-skeleton"><i /><i /><i /><i /><i /></aside></div></div>,
})

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const cart = await getCurrentCartSnapshot()
  if (cart.isAuthenticated) return <CartServerView lines={cart.lines} />
  return <GuestCartView initialLines={[]} isAuthenticated={false} />
}
