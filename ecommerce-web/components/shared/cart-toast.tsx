'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

let showListener: ((message: string) => void) | null = null
export function showCartToast(message: string) { showListener?.(message) }
export function CartToast() {
  const [message, setMessage] = useState('')
  useEffect(() => { showListener = setMessage; return () => { showListener = null } }, [])
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 3500); return () => window.clearTimeout(timer) }, [message])
  if (!message) return null
  return <div className="cart-toast" role="status"><span>✓ {message}</span><Link href="/customer/cart">View cart</Link><button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>
}
