import { AdminShell } from '@/components/admin/admin-shell'
import { ComplaintsWorkspace } from '@/components/admin/complaints/complaints-workspace'
import { getAdminProfile } from '@/lib/admin-auth'

export default async function ComplaintsPage() {
  const profile = await getAdminProfile()
  return <AdminShell eyebrow="OPERATIONS" title="Complaints" description="Review order issues, coordinate resolutions, and keep every update on record."><ComplaintsWorkspace role={profile?.role_name ?? ''} /></AdminShell>
}
