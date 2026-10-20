'use client'

import { createContext, useContext } from 'react'
import { useSiteHeader } from '@/hooks/use-site-header'

type HeaderState = ReturnType<typeof useSiteHeader>
const HeaderStateContext = createContext<HeaderState | null>(null)

export function HeaderStateProvider({ children }: { children: React.ReactNode }) {
  const state = useSiteHeader()
  return <HeaderStateContext.Provider value={state}>{children}</HeaderStateContext.Provider>
}

export function useHeaderState() {
  const state = useContext(HeaderStateContext)
  if (!state) throw new Error('Header controls must be rendered inside HeaderStateProvider.')
  return state
}
