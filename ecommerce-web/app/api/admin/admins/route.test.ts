import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { can } from '@/lib/permission-definitions'

const authState = vi.hoisted(() => ({ role: 'store_manager' as string }))
vi.mock('@/lib/permissions', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/permissions')>()
  return { ...actual, requirePermission: async (permission: import('@/lib/permission-definitions').Permission) => {
    if (!can(authState.role, permission)) throw new Error('FORBIDDEN')
    return { id: 'user-1', role_name: authState.role, is_main_admin: authState.role === 'super_admin' }
  } }
})
vi.mock('@/lib/admin-auth', () => ({ getAdminProfile: async () => ({ id: 'user-1', role_name: authState.role, is_main_admin: authState.role === 'super_admin' }) }))
import { DELETE, GET, PATCH, POST } from './route'

describe('administrator API mutation RBAC', () => {
  beforeEach(() => { authState.role = 'store_manager' })
  const calls = [
    ['GET', () => GET()],
    ['POST', () => POST(new NextRequest('http://localhost/api/admin/admins', { method: 'POST', body: '{}' }))],
    ['PATCH', () => PATCH(new NextRequest('http://localhost/api/admin/admins', { method: 'PATCH', body: '{}' }))],
    ['DELETE', () => DELETE(new NextRequest('http://localhost/api/admin/admins?id=user-2', { method: 'DELETE' }))],
  ] as const
  for (const role of ['store_manager', 'picker']) {
    for (const [name, invoke] of calls) {
      it(`${role} receives 403 for ${name}`, async () => {
        authState.role = role
        const response = await invoke()
        expect(response.status).toBe(403)
      })
    }
  }
})
