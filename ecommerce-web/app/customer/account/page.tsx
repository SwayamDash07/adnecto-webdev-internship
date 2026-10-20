import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'
import { CustomerNotifications } from '@/components/customer/customer-notifications'
import { requireCustomerRoute } from '@/lib/customer-auth'

export default async function CustomerAccountPage() {
  const { supabase } = await requireCustomerRoute('/customer/account')
  const { data } = await supabase.rpc('customer_list_notifications')
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount /><CustomerNotifications initialItems={(data ?? []) as import('@/components/customer/customer-notifications').CustomerNotification[]} /></CustomerPage>
}
