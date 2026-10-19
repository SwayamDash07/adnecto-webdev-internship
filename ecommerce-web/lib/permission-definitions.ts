export const PERMISSIONS = [
  'orders:view', 'orders:update_status', 'products:view', 'products:edit', 'products:create', 'products:disable',
  'customers:view', 'coupons:manage', 'inventory:view', 'inventory:adjust', 'purchase_orders:manage',
  'delivery:manage', 'picker:use', 'reports:view', 'revenue:view', 'complaints:raise', 'complaints:manage',
  'team:manage', 'notifications:view', 'notifications:send', 'messages:send',
] as const
export type Permission = typeof PERMISSIONS[number]
export type Role = 'super_admin' | 'admin' | 'store_manager' | 'picker' | 'customer_support' | 'delivery_boy'
export const ROLE_KEYS: readonly Role[] = ['super_admin', 'admin', 'store_manager', 'picker', 'customer_support', 'delivery_boy']

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: PERMISSIONS,
  store_manager: [
    'orders:view', 'orders:update_status', 'products:view', 'products:edit', 'inventory:view', 'inventory:adjust',
    'purchase_orders:manage', 'delivery:manage', 'picker:use', 'reports:view',
    'complaints:manage', 'notifications:view',
  ],
  picker: ['picker:use', 'orders:view', 'orders:update_status', 'notifications:view'],
  customer_support: ['complaints:manage', 'notifications:view'],
  delivery_boy: ['orders:view', 'delivery:manage', 'notifications:view'],
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return Boolean(role && (ROLE_PERMISSIONS as Record<string, readonly Permission[] | undefined>)[role]?.includes(permission))
}

export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!role || !ROLE_KEYS.includes(role as Role)) return false
  const path = pathname.replace(/^\/portal\/[^/]+/, '').replace(/^\/admin/, '') || '/'
  if (role === 'customer_support' && path === '/') return false
  if (role === 'picker' && (path === '/orders' || path.startsWith('/orders/'))) return false
  const permission = permissionForPath(path)
  return permission === null || (permission !== false && can(role, permission))
}

export function roleHomePath(role: string, portalBase: string) {
  if (role === 'super_admin') return portalBase
  if (role === 'admin') return portalBase
  if (role === 'store_manager') return `${portalBase}/orders`
  if (role === 'picker') return `${portalBase}/picker`
  if (role === 'customer_support') return `${portalBase}/complaints`
  if (role === 'delivery_boy') return `${portalBase}/delivery`
  return null
}

export function permissionForPath(pathname: string): Permission | null | false {
  const path = pathname.replace(/^\/portal\/[^/]+/, '').replace(/^\/admin/, '') || '/'
  if (path === '/') return null
  if (path === '/settings' || path.startsWith('/settings/')) return 'team:manage'
  if (path === '/overview') return 'reports:view'
  if (path === '/coupons' || path.startsWith('/coupons/')) return 'coupons:manage'
  if (path === '/products/new' || path.startsWith('/products/new/')) return 'products:create'
  if (path.startsWith('/products')) return 'products:view'
  if (path.startsWith('/orders')) return 'orders:view'
  if (path.startsWith('/customers')) return 'customers:view'
  if (path.startsWith('/inventory/purchases') || path.startsWith('/purchase-orders')) return 'purchase_orders:manage'
  if (path.startsWith('/inventory')) return 'inventory:view'
  if (path.startsWith('/delivery')) return 'delivery:manage'
  if (path.startsWith('/picker')) return 'picker:use'
  if (path.startsWith('/reports')) return 'reports:view'
  if (path.startsWith('/complaints')) return 'complaints:manage'
  if (path.startsWith('/notifications') || path.startsWith('/messages')) return 'notifications:view'
  return false
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Main administrator', admin: 'Admin', store_manager: 'Store manager', picker: 'Picker', customer_support: 'Customer support', delivery_boy: 'Delivery staff',
}
export const MAIN_ADMIN_ROLE: Role = 'super_admin'
export const MANAGER_ROLE: Role = 'store_manager'
export const PICKER_ROLE: Role = 'picker'
