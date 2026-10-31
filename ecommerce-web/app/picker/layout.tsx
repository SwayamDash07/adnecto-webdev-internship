import { AdminShellDataProvider } from '@/components/admin/admin-shell-data'
import { requireAdminRoute } from '@/lib/admin-auth'
import { getAdminShellData } from '@/lib/admin-shell-data'

export const dynamic = 'force-dynamic'

export default async function PickerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminRoute()
  let data
  try {
    data = await getAdminShellData(profile)
  } catch (error) {
    console.error('[picker] Failed to load admin shell data:', error)
    data = { profile, openComplaints: 0, openRefunds: 0, unreadMessages: 0, notifications: [], unreadNotifications: 0 }
  }
  return <AdminShellDataProvider data={data}>{children}</AdminShellDataProvider>
}
