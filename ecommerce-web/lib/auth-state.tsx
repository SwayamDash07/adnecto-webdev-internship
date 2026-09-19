'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    const client = createSupabaseBrowserClient(); if (!client) return
    void client.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.subscription.unsubscribe()
  }, [])
  return user
}
