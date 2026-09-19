import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { AdminIdentity } from './admin-identity'

const groups: Array<{ label: string; items: Array<[string, string]> }> = [{ label: 'Workspace', items: [['Overview', '/admin'], ['Products', '/admin/products'], ['Orders', '/admin/orders'], ['Customers', '/admin/customers'], ['Coupons', '/admin/coupons'], ['Banners', '/admin/banners']] }, { label: 'Operations', items: [['Inventory', '/inventory'], ['Purchase orders', '/inventory/purchases'], ['Delivery', '/delivery'], ['Picker', '/picker']] }, { label: 'Insights', items: [['Reports', '/admin/reports'], ['Settings', '/admin/settings']] }]

// This component is also rendered through client components on admin subpages.
// Use the public route token so server and browser render the same hrefs.
const portalBase = process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ? `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}` : '/404'

function portalHref(href: string) {
  const path = href.startsWith('/admin') ? href.slice('/admin'.length) || '/' : href
  return `${portalBase}${path === '/' ? '' : path}`
}

export function AdminShell({ children, title, description, action }: { children: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="admin-shell"><aside className="sidebar"><Logo dark /><AdminIdentity />{groups.map(group => <div key={group.label}><div className="sidebar-section">{group.label}</div>{group.items.map(([label, href]) => <Link key={href} href={portalHref(href)} className={`side-link ${title.toLowerCase() === label.toLowerCase() ? 'active' : ''}`}><span>{label === 'Overview' ? '◈' : label === 'Products' ? '▦' : label === 'Orders' ? '▣' : label === 'Customers' ? '♙' : label === 'Inventory' ? '⌂' : label === 'Reports' ? '⌁' : '◇'}</span>{label}</Link>)}</div>)}<div className="sidebar-bottom"><Link className="side-link" href="/">↩ Back to store</Link><Link className="side-link" href="/auth/admin-sign-in">⚙ Switch account</Link></div></aside><section className="admin-content"><div className="admin-top"><div><p className="eyebrow">CARTLY OPERATIONS</p><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</section></div>
}
