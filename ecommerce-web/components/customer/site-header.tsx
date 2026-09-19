'use client'
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { useCart } from '@/lib/cart-store'
import { useAuthUser } from '@/lib/auth-state'

export function SiteHeader() {
  const { totalQuantity } = useCart()
  const user = useAuthUser()
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]
  return <><div className="top-strip">Free delivery on orders above ₹499 <span>•</span> Easy 7-day returns <span>•</span> Shop with confidence</div><header className="site-header"><Logo /><div className="search-bar"><select aria-label="Search category"><option>All</option><option>Groceries</option><option>Electronics</option><option>Personal care</option></select><input placeholder="Search for products, brands and more" /><button aria-label="Search">⌕</button></div><div className="header-actions"><Link className="header-action" href={user ? '/customer/account' : '/auth/sign-in'}><span className="action-icon">♙</span><span className="header-account"><small>{user ? 'Hello' : 'Hello, sign in'}</small><strong>{user ? name : 'Account & Lists⌄'}</strong></span></Link><Link className="header-action" href="/customer/orders"><span className="action-icon">▣</span><span><small>Returns</small><strong>& Orders</strong></span></Link><Link className="header-action cart-link" href="/customer/cart"><span className="cart-number">{totalQuantity}</span><span className="action-icon">🛒</span><strong>Cart</strong></Link></div></header><nav className="category-nav"><Link href="/">☰ All</Link><Link href="/customer/category/groceries">Groceries</Link><Link href="/customer/category/electronics">Electronics</Link><Link href="/customer/category/personal-care">Personal care</Link><Link href="/customer/category/home-appliances">Home & kitchen</Link><Link href="/customer/category/baby-care">Baby care</Link><span className="nav-spacer" /><Link href="/customer/offers">Today&apos;s deals</Link><Link href="/customer/new-arrivals">New arrivals</Link></nav></>
}
