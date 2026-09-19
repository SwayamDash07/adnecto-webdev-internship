import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AdminProfile = {
  id: string
  email: string
  full_name: string
  role_name: string
  is_main_admin: boolean
}

export async function getAdminProfile() {
  const client = await createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const { data, error } = await client.rpc('get_my_admin_profile')
  if (error || !data || !Array.isArray(data) || !data[0]) return null
  return data[0] as AdminProfile
}
