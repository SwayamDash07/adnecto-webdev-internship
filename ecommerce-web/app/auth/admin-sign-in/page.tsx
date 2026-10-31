import { redirect } from 'next/navigation'
import { getAdminProfile } from '@/lib/admin-auth'
import { canAccessPath, roleHomePath } from '@/lib/permission-definitions'
import { AdminAuthForm } from '@/components/auth/admin-auth-form'

type AdminSignInPageProps = {
  searchParams: Promise<{ returnTo?: string; error?: string }>
}

export default async function AdminSignInPage({ searchParams }: AdminSignInPageProps) {
  const { returnTo: requestedReturnTo, error } = await searchParams
  const token = process.env.ADMIN_ROUTE_TOKEN
  const portalBase = token ? `/portal/${token}` : '/'
  const candidate = requestedReturnTo && (requestedReturnTo === portalBase || requestedReturnTo.startsWith(`${portalBase}/`))
    ? requestedReturnTo
    : portalBase

  const profile = await getAdminProfile()
  if (profile) {
    const home = roleHomePath(profile.role_name, portalBase)
    if (home) redirect(canAccessPath(profile.role_name, candidate) ? candidate : home)
  }

  return <AdminAuthForm
    returnTo={candidate}
    initialError={error === 'not_admin' ? 'This account does not have administrator access.' : undefined}
  />
}
