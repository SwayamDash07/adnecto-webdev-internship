import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerOrders } from '@/components/customer/customer-orders'

export default function CustomerOrdersPage() {
  return <CustomerPage title="Your orders" description="Track active deliveries and revisit everything you have purchased." cards={[]}><CustomerOrders /></CustomerPage>
}
