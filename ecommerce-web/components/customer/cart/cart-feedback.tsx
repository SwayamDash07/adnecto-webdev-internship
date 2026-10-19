'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setCartItemQuantityAction } from '@/app/customer/cart/actions'
import type { CartLine } from '@/types/catalog'
import { cartStore } from '@/lib/cart-store'

type CartFeedbackValue = {
  removedLine: CartLine | null
  message: string
  showMessage: (message: string) => void
  setRemovedLine: (line: CartLine | null) => void
}

const CartFeedbackContext = createContext<CartFeedbackValue | null>(null)

export function CartFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [removedLine, setRemovedLine] = useState<CartLine | null>(null)
  const [message, setMessage] = useState('')
  const showMessage = useCallback((value: string) => setMessage(value), [])
  return <CartFeedbackContext.Provider value={{ removedLine, message, showMessage, setRemovedLine }}>{children}</CartFeedbackContext.Provider>
}

export function useCartFeedback() {
  const value = useContext(CartFeedbackContext)
  if (!value) throw new Error('Cart feedback must be used inside CartFeedbackProvider')
  return value
}

export function CartActionFeedback() {
  const router = useRouter()
  const { removedLine, message, showMessage, setRemovedLine } = useCartFeedback()

  useEffect(() => {
    if (!removedLine) return
    const timer = window.setTimeout(() => setRemovedLine(null), 5000)
    return () => window.clearTimeout(timer)
  }, [removedLine, setRemovedLine])

  async function undo() {
    if (!removedLine) return
    const line = removedLine
    const result = await setCartItemQuantityAction(line.product.id, line.quantity, line.variant)
    if (!result.ok) {
      showMessage(`Could not restore item. Only ${result.available} available.`)
      return
    }
    if (result.lines) cartStore.replaceFromServer(result.lines)
    setRemovedLine(null)
    showMessage('Item restored to your cart.')
    router.refresh()
  }

  return <>
    {removedLine && <div className="cart-undo-toast" role="status"><span>{removedLine.product.name} removed</span><button type="button" onClick={() => void undo()}>Undo</button></div>}
    {message && <div className="cart-action-toast" role="status">{message}<button type="button" aria-label="Dismiss message" onClick={() => showMessage('')}>×</button></div>}
  </>
}
