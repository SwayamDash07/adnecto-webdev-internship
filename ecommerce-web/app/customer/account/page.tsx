import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'
import { CustomerNotifications } from '@/components/customer/customer-notifications'
import { requireCustomerRoute } from '@/lib/customer-auth'

export default async function CustomerAccountPage() {
  await requireCustomerRoute('/customer/account')
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount /><CustomerNotifications /></CustomerPage>
}
