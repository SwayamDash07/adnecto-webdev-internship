'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/data'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
type Summary = { today_sales: number; today_orders: number; pending_deliveries: number; low_stock_items: number }
export function Stats() {
  const [summary, setSummary] = useState<Summary | null>(null)
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data } = await client.from('dashboard_summary').select('*').single(); setSummary(data as Summary) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-stats-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  const value = summary ?? { today_sales: 0, today_orders: 0, pending_deliveries: 0, low_stock_items: 0 }
  return <div className="stat-grid"><div className="stat-card"><span className="stat-icon purple">↗</span><small>Today&apos;s sales</small><strong>{money(value.today_sales)}</strong><em>Live from orders</em></div><div className="stat-card"><span className="stat-icon orange">▣</span><small>Orders today</small><strong>{value.today_orders}</strong><em>Live from orders</em></div><div className="stat-card"><span className="stat-icon green">♧</span><small>Pending deliveries</small><strong>{value.pending_deliveries}</strong><em>Open fulfilment statuses</em></div><div className="stat-card"><span className="stat-icon blue">◫</span><small>Low stock items</small><strong>{value.low_stock_items}</strong><em>Inventory threshold alerts</em></div></div>
}
