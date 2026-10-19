export {
  can, canAccessPath, permissionForPath, roleHomePath, PERMISSIONS, ROLE_KEYS,
  ROLE_PERMISSIONS, ROLE_LABELS, MAIN_ADMIN_ROLE, MANAGER_ROLE, PICKER_ROLE,
} from '@/lib/permission-definitions'
export type { Permission, Role } from '@/lib/permission-definitions'

import { getAdminProfile } from '@/lib/admin-auth'
import { can, type Permission } from '@/lib/permission-definitions'

export class PermissionDeniedError extends Error {
  readonly status = 403
  constructor() { super('You do not have permission to perform this action.') }
}

export async function requirePermission(permission: Permission) {
  const profile = await getAdminProfile()
  if (!profile || !can(profile.role_name, permission)) throw new PermissionDeniedError()
  return profile
}
