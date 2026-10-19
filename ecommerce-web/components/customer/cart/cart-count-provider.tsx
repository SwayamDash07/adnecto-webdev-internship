'use client'

import { createContext, useContext } from 'react'

const CartCountContext = createContext(0)

export function CartCountProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  return <CartCountContext.Provider value={initialCount}>{children}</CartCountContext.Provider>
}

export function useInitialCartCount() {
  return useContext(CartCountContext)
}
