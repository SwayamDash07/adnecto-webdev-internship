import 'server-only'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessPath, roleHomePath } from '@/lib/permission-definitions'

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

/** Authorize a protected route from its middleware-stamped pathname. */
export async function requireAdminRoute() {
  const profile = await getAdminProfile()
  if (!profile) redirect('/auth/admin-sign-in?error=not_admin')

  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-cartly-protected-path')
  if (!pathname) notFound()

  const portalBase = process.env.ADMIN_ROUTE_TOKEN
    ? `/portal/${process.env.ADMIN_ROUTE_TOKEN}`
    : '/portal'
  if (pathname === '/' || pathname === '/admin') {
    const home = roleHomePath(profile.role_name, portalBase)
    if (home && home !== portalBase) redirect(home)
    return profile
  }

  if (!canAccessPath(profile.role_name, pathname)) {
    const home = roleHomePath(profile.role_name, portalBase)
    if (home) redirect(`${home}?accessDenied=1`)
    notFound()
  }
  return profile
}
