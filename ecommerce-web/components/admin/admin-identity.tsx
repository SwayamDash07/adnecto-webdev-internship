'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Profile = { full_name: string; email: string; role_name: string; is_main_admin: boolean }

export function AdminIdentity() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    void client.rpc('get_my_admin_profile').then(({ data }) => {
      if (data?.[0]) setProfile(data[0] as Profile)
    })
  }, [])

  if (!profile) return null
  return <div className="sidebar-user"><strong>{profile.full_name}</strong><small>{profile.email}</small><small>{profile.is_main_admin ? 'Main administrator' : profile.role_name.replaceAll('_', ' ')}</small></div>
}
