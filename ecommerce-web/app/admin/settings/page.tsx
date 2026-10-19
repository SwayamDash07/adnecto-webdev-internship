import { ModulePage } from '@/components/shared/module-page'
import { AdminAccounts } from '@/components/admin/admin-accounts'
import { redirect } from 'next/navigation'
import { requirePermission, roleHomePath } from '@/lib/permissions'

export default async function SettingsPage() {
  let profile: Awaited<ReturnType<typeof requirePermission>>
  try { profile = await requirePermission('team:manage') } catch { redirect('/auth/admin-sign-in?error=not_admin') }
  const home = roleHomePath(profile.role_name, `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ?? ''}`)
  if (!home) redirect('/auth/admin-sign-in?error=not_admin')
  return <ModulePage title="Team & Access" description="Manage administrator accounts and role permissions." cards={[]}><AdminAccounts currentRole={profile.role_name} /></ModulePage>
}
