'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ClipboardList, PackageCheck, TriangleAlert } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

type Summary = { today_sales: number; today_orders: number; pending_deliveries: number; low_stock_items: number }
const cards = [
  { key: 'today_sales', label: "Today's sales", caption: 'Live from completed orders', icon: ArrowUpRight, tone: 'purple', format: (value: number) => money(value) },
  { key: 'today_orders', label: 'Orders today', caption: 'Orders placed since midnight', icon: ClipboardList, tone: 'orange', format: (value: number) => String(value) },
  { key: 'pending_deliveries', label: 'Pending deliveries', caption: 'Open fulfilment statuses', icon: PackageCheck, tone: 'green', format: (value: number) => String(value) },
  { key: 'low_stock_items', label: 'Low stock items', caption: 'Inventory threshold alerts', icon: TriangleAlert, tone: 'blue', format: (value: number) => String(value) },
] as const

function AnimatedValue({ value, format }: { value: number; format: (value: number) => string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = display
    const duration = 650
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (value - start) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{format(Number.isInteger(value) ? Math.round(display) : display)}</>
}

export function Stats() {
  const [summary, setSummary] = useState<Summary | null>(null)
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('dashboard_summary').select('*').single(); setSummary(data as Summary) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-stats-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  const value = summary ?? { today_sales: 0, today_orders: 0, pending_deliveries: 0, low_stock_items: 0 }
  return <div className="stat-grid">{cards.map((card, index) => { const Icon = card.icon; return <motion.div className={`stat-card stat-card-${card.tone}`} key={card.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: index * .07, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -4 }}><span className="stat-icon"><Icon size={18} strokeWidth={2.2} /></span><small>{card.label}</small><strong>{summary ? <AnimatedValue value={Number(value[card.key])} format={card.format} /> : <span className="stat-skeleton" />}</strong><em>{card.caption}</em></motion.div> })}</div>
}
