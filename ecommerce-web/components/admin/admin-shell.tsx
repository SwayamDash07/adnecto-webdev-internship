'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/shared/logo'
import { AdminIdentity } from './admin-identity'
import { Archive, BarChart3, Boxes, ClipboardList, House, LayoutDashboard, LogOut, PackageSearch, Settings, ShoppingBag, Store, Truck, Users, Warehouse } from 'lucide-react'

const groups: Array<{ label: string; items: Array<[string, string]> }> = [{ label: 'Workspace', items: [['Overview', '/admin'], ['Products', '/admin/products'], ['Orders', '/admin/orders'], ['Customers', '/admin/customers'], ['Coupons', '/admin/coupons'], ['Banners', '/admin/banners']] }, { label: 'Operations', items: [['Inventory', '/inventory'], ['Purchase orders', '/inventory/purchases'], ['Delivery', '/delivery'], ['Picker', '/picker']] }, { label: 'Insights', items: [['Reports', '/admin/reports'], ['Settings', '/admin/settings']] }]
const iconByLabel = { Overview: LayoutDashboard, Products: Boxes, Orders: ClipboardList, Customers: Users, Coupons: Archive, Banners: Store, Inventory: Warehouse, 'Purchase orders': ShoppingBag, Delivery: Truck, Picker: PackageSearch, Reports: BarChart3, Settings } as const

// This component is also rendered through client components on admin subpages.
// Use the public route token so server and browser render the same hrefs.
const portalBase = process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ? `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}` : '/404'

function portalHref(href: string) {
  const path = href.startsWith('/admin') ? href.slice('/admin'.length) || '/' : href
  return `${portalBase}${path === '/' ? '' : path}`
}

function normalizeAdminPath(value: string) {
  const segments = value.split('/').filter(Boolean)
  const portalIndex = segments.indexOf('portal')
  if (portalIndex >= 0) return `/${segments.slice(portalIndex + 2).join('/')}`.replace(/\/$/, '') || '/'
  const adminIndex = segments.indexOf('admin')
  if (adminIndex >= 0) return `/${segments.slice(adminIndex + 1).join('/')}`.replace(/\/$/, '') || '/'
  return `/${segments.join('/')}`.replace(/\/$/, '') || '/'
}

export function AdminShell({ children, title, description, action }: { children: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  const pathname = usePathname()
  const normalizedPathname = normalizeAdminPath(pathname)
  const isActive = (href: string) => normalizeAdminPath(href) === normalizedPathname
  return <div className="admin-shell flex h-dvh w-full overflow-hidden"><aside className="sidebar flex h-dvh shrink-0 flex-col overflow-hidden"><div className="shrink-0"><Logo dark /><AdminIdentity /></div><nav className="sidebar-nav no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">{groups.map(group => <div key={group.label}><div className="sidebar-section">{group.label}</div>{group.items.map(([label, href]) => { const Icon = iconByLabel[label as keyof typeof iconByLabel]; return <Link key={href} href={portalHref(href)} className={`side-link min-w-0 whitespace-nowrap ${isActive(href) ? 'active' : ''}`}><Icon className="shrink-0" size={17} strokeWidth={1.9} /><span className="min-w-0 truncate">{label}</span></Link> })}</div>)}</nav><div className="sidebar-bottom shrink-0"><Link className="side-link" href="/"><House size={17} />Back to store</Link><Link className="side-link" href="/auth/admin-sign-in"><LogOut size={17} />Switch account</Link></div></aside><main className="admin-content h-dvh min-w-0 flex-1 overflow-y-auto overscroll-contain"><div className="admin-top"><div><p className="eyebrow">CARTLY OPERATIONS</p><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</main></div>
}
