'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LazyMotion } from 'framer-motion'
import { Logo } from '@/components/shared/logo'
import { AdminIdentity } from './admin-identity'
import { Archive, BarChart3, Boxes, ClipboardList, House, LayoutDashboard, LogOut, MessageSquareText, PackageSearch, Settings, ShoppingBag, Truck, Users, Warehouse } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { can, canAccessPath } from '@/lib/permission-definitions'
import { AdminNotificationsBell } from './admin-notifications-bell'
import { useAdminShellData } from './admin-shell-data'

const groups: Array<{ label: string; items: Array<[string, string]> }> = [{ label: 'Workspace', items: [['Overview', '/admin/overview'], ['Products', '/admin/products'], ['Orders', '/admin/orders'], ['Customers', '/admin/customers'], ['Coupons', '/admin/coupons']] }, { label: 'Operations', items: [['Inventory', '/inventory'], ['Purchase orders', '/inventory/purchases'], ['Delivery', '/delivery'], ['Picker', '/picker'], ['Complaints', '/admin/complaints']] }, { label: 'Insights', items: [['Reports', '/admin/reports'], ['Team & Access', '/admin/settings'], ['Messages', '/admin/notifications']] }]
const iconByLabel = { Overview: LayoutDashboard, Products: Boxes, Orders: ClipboardList, Customers: Users, Coupons: Archive, Inventory: Warehouse, 'Purchase orders': ShoppingBag, Delivery: Truck, Picker: PackageSearch, Reports: BarChart3, 'Team & Access': Settings, Complaints: MessageSquareText, Messages: MessageSquareText, Notifications: MessageSquareText } as const

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

export function AdminShell({ children, title, description, action, eyebrow = 'CARTLY OPERATIONS' }: { children: React.ReactNode; title: string; description: string; action?: React.ReactNode; eyebrow?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shellData = useAdminShellData()
  const role = shellData?.profile.role_name ?? null
  const openComplaints = shellData?.openComplaints ?? 0
  const unreadMessages = shellData?.unreadMessages ?? 0
  const [accessDenied, setAccessDenied] = useState(false)
  const sidebarNavRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (searchParams.get('accessDenied') === '1') {
      setAccessDenied(true)
      window.history.replaceState(null, '', pathname)
      const timer = window.setTimeout(() => setAccessDenied(false), 5000)
      return () => window.clearTimeout(timer)
    }
  }, [pathname, searchParams])
  useEffect(() => {
    if (!shellData) return
    const client = createSupabaseBrowserClient()
    if (!client) return
    const channel = client.channel(`admin-shell-counts-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_message_recipients' }, () => router.refresh())
      .subscribe()
    const timer = setInterval(() => router.refresh(), 60000)
    return () => { clearInterval(timer); void client.removeChannel(channel) }
  }, [router, shellData])
  const normalizedPathname = normalizeAdminPath(pathname)
  useEffect(() => {
    sidebarNavRef.current?.querySelector<HTMLElement>('.side-link.active')?.scrollIntoView({ block: 'nearest' })
  }, [normalizedPathname])
  const isActive = (href: string) => normalizeAdminPath(href) === normalizedPathname
  const visibleGroups = groups.map(group => ({ ...group, items: group.items.filter(([label, href]) => {
    if (label === 'Overview') return can(role, 'reports:view')
    return canAccessPath(role, href)
  }) })).filter(group => group.items.length)
  return <LazyMotion features={() => import('./motion-features').then(module => module.default)}><div className="admin-shell flex h-dvh w-full overflow-hidden"><aside className="sidebar flex h-dvh shrink-0 flex-col overflow-hidden"><div className="shrink-0"><Logo dark />{shellData&&<AdminIdentity profile={shellData.profile}/>}</div><nav ref={sidebarNavRef} className="sidebar-nav no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">{visibleGroups.map(group => <div key={group.label}><div className="sidebar-section">{group.label}</div>{group.items.map(([label, href]) => { const Icon = iconByLabel[label as keyof typeof iconByLabel]; return <Link key={href} href={portalHref(href)} className={`side-link min-w-0 whitespace-nowrap ${isActive(href) ? 'active' : ''}`}><Icon className="shrink-0" size={17} strokeWidth={1.9} /><span className="min-w-0 truncate">{label}</span>{label==='Complaints'&&openComplaints>0&&<span className="nav-count-badge">{openComplaints>99?'99+':openComplaints}</span>}{label==='Messages'&&unreadMessages>0&&<span className="nav-count-badge">{unreadMessages>99?'99+':unreadMessages}</span>}</Link> })}</div>)}</nav><div className="sidebar-bottom shrink-0"><Link className="side-link" href="/"><House size={17} />Back to store</Link><Link className="side-link" href="/auth/admin-sign-in"><LogOut size={17} />Switch account</Link></div></aside><main className="admin-content h-dvh min-w-0 flex-1 overflow-y-auto overscroll-contain"><div className="admin-top"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><div className="admin-top-actions">{shellData&&<AdminNotificationsBell role={role ?? ''} initialItems={shellData.notifications} initialUnreadCount={shellData.unreadNotifications + shellData.unreadMessages} userId={shellData.profile.id}/ >}{action}</div></div>{accessDenied&&<div role="status" className="rbac-denied-toast">You don&apos;t have access to that page.</div>}{children}</main></div></LazyMotion>
}
