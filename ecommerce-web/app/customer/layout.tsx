// Customer data is scoped to the current session; never share a rendered
// customer subtree between users.
import { getCurrentCartCount } from '@/lib/cart-server'
import { CartCountProvider } from '@/components/customer/cart/cart-count-provider'

export const dynamic = 'force-dynamic'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const initialCount = await getCurrentCartCount()
  return <CartCountProvider initialCount={initialCount}>{children}</CartCountProvider>
}
