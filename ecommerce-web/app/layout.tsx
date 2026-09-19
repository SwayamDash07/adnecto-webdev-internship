import type { Metadata } from 'next'
import './globals.css'
import './cart.css'
import './ux-fixes.css'
import './admin-fixes.css'
import './phase4.css'
import { CartToast } from '@/components/shared/cart-toast'

export const metadata: Metadata = {
  title: 'Cartly Hypermarket',
  description: 'An everyday online hypermarket experience.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<CartToast /></body></html>
}
