import { AdminShell } from '@/components/admin/admin-shell'
import { Overview } from '@/components/admin/overview'
import { getAdminProfile } from '@/lib/admin-auth'

export default async function AdminPage() {
  const profile = await getAdminProfile()
  const name = profile?.full_name || 'Admin'
  return <AdminShell title={`Good morning, ${name}`} description="Here is what is happening with your store today."><Overview /></AdminShell>
}
