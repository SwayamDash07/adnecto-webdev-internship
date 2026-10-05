'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { LowStock, Recent, SalesPoint, TopProduct } from '@/types/admin-overview'

export function useAdminOverview() {
  const [orders, setOrders] = useState<Recent[]>([])
  const [sales, setSales] = useState<SalesPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<LowStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    const client = createSupabaseBrowserClient(); if (!client) return
    setError(''); setLoading(true)
    const [recent, daily, products, stock] = await Promise.all([client.from('dashboard_recent_orders').select('*'), client.from('dashboard_daily_sales').select('day,revenue').order('day', { ascending: true }).limit(30), client.from('dashboard_top_products').select('*').limit(5), client.from('dashboard_low_stock').select('*').limit(8)])
    const firstError = recent.error ?? daily.error ?? products.error ?? stock.error
    if (firstError) setError(firstError.message)
    setOrders((recent.data ?? []) as Recent[]); setSales((daily.data ?? []) as SalesPoint[]); setTopProducts((products.data ?? []) as TopProduct[]); setLowStock((stock.data ?? []) as LowStock[]); setLoading(false)
  }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-overview-live', ['orders', 'order_items', 'inventory'], () => { void load() })
  return { orders, sales, topProducts, lowStock, loading, error }
}
