'use client'
import { useEffect, useState } from 'react'

function nextIstMidnight() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const year = Number(parts.find(p => p.type === 'year')?.value), month = Number(parts.find(p => p.type === 'month')?.value), day = Number(parts.find(p => p.type === 'day')?.value)
  return Date.UTC(year, month - 1, day + 1) - 330 * 60_000
}
export function useIstNow(initialNow?: string) {
  const [now, setNow] = useState(() => initialNow ? new Date(initialNow) : new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    window.addEventListener('focus', refresh)
    const midnight = window.setTimeout(refresh, Math.max(1, nextIstMidnight() - Date.now() + 50))
    const interval = window.setInterval(refresh, 60_000)
    return () => { window.removeEventListener('focus', refresh); window.clearTimeout(midnight); window.clearInterval(interval) }
  }, [])
  return now
}
