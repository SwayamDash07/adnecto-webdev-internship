import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type AdminAccountRow = { id: string; email: string; full_name: string; role_name: string; is_current: boolean }

export async function listAdminAccounts(currentUserId: string): Promise<{ data: AdminAccountRow[]; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { data: [], error: 'Administrator service is unavailable.' }
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authUsers, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { data: [], error: error.message }
  const ids = authUsers.users.map(user => user.id)
  const { data: profiles } = ids.length ? await client.from('users').select('id,full_name,roles(name)').in('id', ids) : { data: [] }
  const profileMap = new Map((profiles ?? []).map(profile => {
    const row = profile as unknown as { id: string; full_name: string; roles: { name: string }[] | { name: string } | null }
    return [row.id, row]
  }))
  const data = authUsers.users.map(user => {
    const roles = profileMap.get(user.id)?.roles
    const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name
    return { id: user.id, email: user.email ?? '', full_name: profileMap.get(user.id)?.full_name || String(user.user_metadata?.full_name ?? ''), role_name: roleName || 'customer', is_current: user.id === currentUserId }
  }).filter(user => user.role_name !== 'customer')
  return { data, error: '' }
}
