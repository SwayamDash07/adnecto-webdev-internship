'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/lib/cart-store'
import { useAuthUser } from '@/lib/auth-state'
import { hiddenCategoryRoutes } from '@/constants/site-header'
import { useInitialCartCount } from '@/components/customer/cart/cart-count-provider'

export function useSiteHeader() {
  const cart = useCart()
  const initialCartCount = useInitialCartCount()
  const totalQuantity = cart.ready ? cart.totalQuantity : initialCartCount
  const user = useAuthUser()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
    if (!['/customer/search', '/customer/offers', '/customer/new-arrivals'].includes(pathname)) return
    setQuery(searchParams.get('q') ?? '')
  }, [pathname, searchParams])
  useEffect(() => {
    if (!['/customer/search', '/customer/offers', '/customer/new-arrivals'].includes(pathname)) return
    const value = query.trim()
    if ((searchParams.get('q') ?? '') === value) return
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('q', value)
      else params.delete('q')
      const queryString = params.toString()
      router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pathname, query, router, searchParams])
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
