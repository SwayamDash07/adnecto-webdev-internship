import { requireAdminRoute } from '@/lib/admin-auth'
import { getAdminShellData } from '@/lib/admin-shell-data'
import { AdminShellDataProvider } from '@/components/admin/admin-shell-data'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminRoute()
  const data = await getAdminShellData(profile)
  return <AdminShellDataProvider data={data}>{children}</AdminShellDataProvider>
}
