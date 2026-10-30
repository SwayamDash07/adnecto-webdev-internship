import { requireAdminRoute } from '@/lib/admin-auth'
import { getAdminShellData } from '@/lib/admin-shell-data'
import { AdminShellDataProvider } from '@/components/admin/admin-shell-data'
import type { AdminShellData } from '@/components/admin/admin-shell-data'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminRoute()
  let data: AdminShellData
  try {
    data = await getAdminShellData(profile)
  } catch (error) {
    console.error('[admin] Failed to load shell data:', error)
    data = { profile, openComplaints: 0, openRefunds: 0, unreadMessages: 0, notifications: [], unreadNotifications: 0 }
  }
  return <AdminShellDataProvider data={data}>{children}</AdminShellDataProvider>
}
