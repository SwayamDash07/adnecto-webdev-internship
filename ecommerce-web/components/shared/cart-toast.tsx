'use client'

import Link from 'next/link'
import { ArrowRight, Check, CheckCircle2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product } from '@/types/catalog'

type ToastProduct = Pick<Product, 'name' | 'imageUrl'>
type ToastItem = { product?: ToastProduct; count: number; revision: number; message?: string; actionLabel?: string; action?: () => void | Promise<void> }
let showListener: ((product: ToastProduct) => void) | null = null
let actionListener: ((message: string, actionLabel?: string, action?: () => void | Promise<void>, duration?: number) => void) | null = null

export function showCartToast(message: string, product?: Product) {
  const name = product?.name ?? message.replace(/^(?:\d+\s+)?(.+?) added to cart$/, '$1')
  showListener?.({ name, imageUrl: product?.imageUrl })
}

export function showCartActionToast(message: string, actionLabel?: string, action?: () => void | Promise<void>, duration = 4000) {
  actionListener?.(message, actionLabel, action, duration)
}

export function CartToast() {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const [exiting, setExiting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [remaining, setRemaining] = useState(4000)
  const timer = useRef<number | null>(null)
  const deadline = useRef(0)
  const toastRef = useRef<ToastItem | null>(null)
  const pauseRef = useRef(false)

  const dismiss = useCallback(() => {
    if (!toastRef.current || exiting) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setExiting(true)
    window.setTimeout(() => {
      toastRef.current = null
      setToast(null)
      setExiting(false)
    }, 180)
  }, [exiting])

  const schedule = useCallback((duration: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setRemaining(duration)
    deadline.current = Date.now() + duration
    if (!pauseRef.current) timer.current = window.setTimeout(dismiss, duration)
  }, [dismiss])

  useEffect(() => {
    showListener = product => {
      setExiting(false)
      const previous = toastRef.current
      const next = { product, count: previous?.product ? previous.count + 1 : 1, revision: (previous?.revision ?? 0) + 1 }
      toastRef.current = next
      setToast(next)
      schedule(4000)
    }
    actionListener = (message, actionLabel, action, duration = 4000) => {
      setExiting(false)
      const next = { count: 1, revision: (toastRef.current?.revision ?? 0) + 1, message, actionLabel, action }
      toastRef.current = next
      setToast(next)
      schedule(duration)
    }
    return () => {
      showListener = null
      actionListener = null
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [schedule])

  const setHoverPaused = (value: boolean) => {
    pauseRef.current = value
    setPaused(value)
    if (value) {
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = null
      setRemaining(Math.max(0, deadline.current - Date.now()))
    } else if (toastRef.current) schedule(Math.max(0, deadline.current - Date.now()))
  }

  useEffect(() => {
    if (!toast) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toast, dismiss])

  if (!toast) return null
  const productName = toast.message ?? (toast.count > 1 ? `${toast.count} items added` : toast.product?.name ?? '')
  return <div className={`cart-toast ${exiting ? 'is-exiting' : ''} ${paused ? 'is-paused' : ''} ${toast.revision > 1 ? 'is-updated' : ''}`} role="status" aria-live="polite" aria-atomic="true" onMouseEnter={() => setHoverPaused(true)} onMouseLeave={() => setHoverPaused(false)} onFocusCapture={() => setHoverPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoverPaused(false) }}>
    <div className="cart-toast-main" key={toast.revision}>
      {toast.product && <div className="cart-toast-thumb" aria-hidden="true">{toast.product.imageUrl ? <img src={toast.product.imageUrl} alt="" /> : <span className="cart-toast-fallback"><CheckCircle2 size={22} /></span>}<span className="cart-toast-check"><Check size={11} strokeWidth={3} /></span></div>}
      <div className="cart-toast-copy"><span>{toast.message ? 'Cart update' : 'Added to cart'}</span><strong title={toast.product && toast.count === 1 ? toast.product.name : productName}>{productName}</strong></div>
    </div>
    {toast.actionLabel ? <button className="cart-toast-view" onClick={() => { void toast.action?.(); dismiss() }}>{toast.actionLabel}</button> : !toast.message && <Link className="cart-toast-view" href="/customer/cart">View cart <ArrowRight size={14} aria-hidden="true" /></Link>}
    <button className="cart-toast-dismiss" onClick={dismiss} aria-label="Dismiss"><X size={16} /></button>
    <span className="cart-toast-progress" key={`${toast.revision}-${remaining}`} style={{ animationDuration: `${remaining}ms` }} />
  </div>
}
