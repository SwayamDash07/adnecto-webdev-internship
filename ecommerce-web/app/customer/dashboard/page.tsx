import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'

export default function CustomerDashboardPage() {
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount /></CustomerPage>
}
