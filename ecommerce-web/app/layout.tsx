import type { Metadata } from 'next'
import './globals.css'
import './cart.css'
import './ux-fixes.css'
import './admin-fixes.css'
import './phase4.css'
import { CartToast } from '@/components/shared/cart-toast'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Cartly Hypermarket',
  description: 'An everyday online hypermarket experience.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}<CartToast /></Providers>{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async />}</body></html>
}
