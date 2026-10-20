import { AdminShellDataProvider } from '@/components/admin/admin-shell-data'
import { requireAdminRoute } from '@/lib/admin-auth'
import { getAdminShellData } from '@/lib/admin-shell-data'

export const dynamic = 'force-dynamic'

export default async function PickerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminRoute()
  const data = await getAdminShellData(profile)
  return <AdminShellDataProvider data={data}>{children}</AdminShellDataProvider>
}
