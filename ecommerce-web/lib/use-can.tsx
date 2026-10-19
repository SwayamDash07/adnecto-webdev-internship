'use client'

import { useEffect, useState } from 'react'
import { can, type Permission } from '@/lib/permission-definitions'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function useCan(permission: Permission) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let active = true
    const client = createSupabaseBrowserClient()
    if (!client) return () => { active = false }
    void client.rpc('get_my_admin_profile').then(({ data }) => {
      if (active) setAllowed(can(data?.[0]?.role_name, permission))
    })
    return () => { active = false }
  }, [permission])
  return allowed
}

export function Can({ permission, children, fallback = null }: { permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  return useCan(permission) ? children : fallback
}
