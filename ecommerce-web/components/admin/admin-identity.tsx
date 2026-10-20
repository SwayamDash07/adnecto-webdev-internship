import { ROLE_LABELS, type Role } from '@/lib/permission-definitions'
import type { AdminProfile } from '@/lib/admin-auth'

export function AdminIdentity({ profile }: { profile: AdminProfile }) {
  return <div className="sidebar-user"><strong>{profile.full_name}</strong><small>{profile.email}</small><small>{ROLE_LABELS[profile.role_name as Role] ?? profile.role_name.replaceAll('_', ' ')}</small></div>
}
