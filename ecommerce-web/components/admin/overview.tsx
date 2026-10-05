'use client'

import { usePathname } from 'next/navigation'
import { CircleAlert } from 'lucide-react'
import { Stats } from './stats'
import { useAdminOverview } from '@/hooks/use-admin-overview'
import { SalesOverviewChart } from './overview/SalesOverviewChart'
import { RecentOrdersPanel } from './overview/RecentOrdersPanel'
import { TopProductsChart } from './overview/TopProductsChart'
import { InventoryAlertsPanel } from './overview/InventoryAlertsPanel'

export function Overview() {
  const pathname = usePathname()
  const { orders, sales, topProducts, lowStock, loading, error } = useAdminOverview()
  const ordersHref = `${pathname.replace(/\/$/, '')}/orders`
  return <div className="admin-overview"><Stats />{error && <div className="admin-alert" role="alert"><CircleAlert size={17} />{error}</div>}<div className="dashboard-grid overview-primary-grid"><SalesOverviewChart loading={loading} sales={sales} /><RecentOrdersPanel loading={loading} orders={orders} ordersHref={ordersHref} /></div><div className="dashboard-grid overview-secondary-grid"><TopProductsChart loading={loading} topProducts={topProducts} /><InventoryAlertsPanel loading={loading} lowStock={lowStock} /></div></div>
}
