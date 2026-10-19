import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'
import { requireCustomerRoute } from '@/lib/customer-auth'

export default async function CustomerDashboardPage() {
  await requireCustomerRoute('/customer/dashboard')
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount /></CustomerPage>
}
