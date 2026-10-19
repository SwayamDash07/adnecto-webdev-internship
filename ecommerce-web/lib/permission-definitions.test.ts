import { describe, expect, it } from 'vitest'
import { can, canAccessPath, PERMISSIONS, ROLE_PERMISSIONS, type Role } from './permission-definitions'

describe('Cartly role permissions', () => {
  it('covers every role and permission in the matrix', () => {
    const expected: Record<Role, string[]> = {
      super_admin: [...PERMISSIONS],
      admin: [...PERMISSIONS],
      store_manager: ['orders:view','orders:update_status','products:view','products:edit','inventory:view','inventory:adjust','purchase_orders:manage','delivery:manage','picker:use','reports:view','complaints:manage','notifications:view'],
      picker: ['picker:use','orders:view','orders:update_status','notifications:view'],
      customer_support: ['complaints:manage','notifications:view'],
      delivery_boy: ['orders:view','delivery:manage','notifications:view'],
    }
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      for (const permission of PERMISSIONS) expect(can(role, permission), `${role} ${permission}`).toBe(expected[role].includes(permission))
    }
    expect(can('unknown-role', 'orders:view')).toBe(false)
    expect(can(null, 'orders:view')).toBe(false)
    expect(canAccessPath('picker', '/portal/token/orders')).toBe(false)
    expect(canAccessPath('picker', '/portal/token/picker')).toBe(true)
    expect(canAccessPath('store_manager', '/portal/token/orders')).toBe(true)
    expect(canAccessPath('store_manager', '/portal/token/overview')).toBe(true)
    expect(canAccessPath('picker', '/portal/token/overview')).toBe(false)
    expect(can('store_manager', 'customers:view')).toBe(false)
    expect(canAccessPath('store_manager', '/portal/token/customers')).toBe(false)
    expect(can('super_admin', 'customers:view')).toBe(true)
  })
})
