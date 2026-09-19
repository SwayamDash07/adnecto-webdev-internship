'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

/** Re-runs a live query when Supabase broadcasts a row change. */
export function useRealtimeReload(channelName: string, tables: string[], reload: () => void) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  const tableKey = tables.join('|')

  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    let channel = client.channel(channelName)
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => reloadRef.current())
    }
    channel.subscribe()
    return () => { void channel.unsubscribe() }
  }, [channelName, tableKey])
}
