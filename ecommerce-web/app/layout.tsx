import type { Metadata } from 'next'
import './globals.css'
import './cart.css'
import './ux-fixes.css'
import './admin-fixes.css'
import './phase4.css'
import './account.css'
import './spacing.css'
import './image-fixes.css'
import './category-icons.css'
import './storefront-cleanup.css'
import './promo-ads.css'
import './promo-home-fix.css'
import './wishlist.css'
import './cart-overhaul.css'
import './arrow-removal.css'
import './product-interactions.css'
import './product-card-design.css'
import './product-card-reference.css'
import './demo-disclaimer.css'
import { CartToast } from '@/components/shared/cart-toast'

export const metadata: Metadata = {
  title: 'Cartly Hypermarket',
  description: 'An everyday online hypermarket experience.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<CartToast />{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async />}</body></html>
}
