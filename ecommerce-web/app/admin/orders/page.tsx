import { AdminShell } from '@/components/admin/admin-shell'
import AdminOrderQueue from '@/components/admin/admin-order-queue'

export default function OrdersPage() {
  return <AdminShell title="Order management" description="View and advance real customer orders through fulfilment."><AdminOrderQueue /></AdminShell>
}
