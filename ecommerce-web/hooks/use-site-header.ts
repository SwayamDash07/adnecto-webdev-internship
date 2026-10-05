'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-store'
import { useAuthUser } from '@/lib/auth-state'
import { hiddenCategoryRoutes } from '@/constants/site-header'

export function useSiteHeader() {
  const { totalQuantity } = useCart()
  const user = useAuthUser()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [badgePulse, setBadgePulse] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!totalQuantity) return
    setBadgePulse(true)
    const timer = window.setTimeout(() => setBadgePulse(false), 500)
    return () => window.clearTimeout(timer)
  }, [totalQuantity])
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => { if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setAccountMenuOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountMenuOpen(false) }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `/customer/search?q=${encodeURIComponent(value)}` : '/customer/search')
  }
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]
  const hideCategoryNav = hiddenCategoryRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  return { totalQuantity, user, name, query, setQuery, badgePulse, mobileNavOpen, setMobileNavOpen, cartOpen, setCartOpen, accountMenuOpen, setAccountMenuOpen, accountMenuRef, submitSearch, hideCategoryNav }
}
