import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'
import { CustomerNotifications } from '@/components/customer/customer-notifications'
import { requireCustomerRoute } from '@/lib/customer-auth'

export default async function CustomerAccountPage() {
  const { supabase, user } = await requireCustomerRoute('/customer/account')
  const [profile, addresses, wallet, rewards, notifications] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('addresses').select('id,label,line1,city,postal_code').eq('user_id', user.id).order('id'),
    supabase.rpc('customer_wallet_balance'),
    supabase.rpc('customer_reward_balance'),
    supabase.rpc('customer_list_notifications'),
  ])
  const account = {
    name: profile.data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
    email: user.email ?? '',
    addresses: (addresses.data ?? []) as import('@/types/customer-account').AccountAddress[],
    walletBalance: Number(wallet.data ?? 0),
    rewardBalance: Number(rewards.data ?? 0),
  }
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount initialAccount={account} /><CustomerNotifications initialItems={(notifications.data ?? []) as import('@/components/customer/customer-notifications').CustomerNotification[]} /></CustomerPage>
}
