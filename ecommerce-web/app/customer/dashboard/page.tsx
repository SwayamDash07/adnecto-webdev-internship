import { CustomerPage } from '@/components/customer/customer-page'
import { CustomerAccount } from '@/components/customer/customer-account'
import { requireCustomerRoute } from '@/lib/customer-auth'

export default async function CustomerDashboardPage() {
  const { supabase, user } = await requireCustomerRoute('/customer/dashboard')
  const [profile, addresses, wallet, rewards] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('addresses').select('id,label,line1,city,postal_code').eq('user_id', user.id).order('id'),
    supabase.rpc('customer_wallet_balance'),
    supabase.rpc('customer_reward_balance'),
  ])
  const initialAccount = {
    name: profile.data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
    email: user.email ?? '',
    addresses: (addresses.data ?? []) as import('@/types/customer-account').AccountAddress[],
    walletBalance: Number(wallet.data ?? 0),
    rewardBalance: Number(rewards.data ?? 0),
  }
  return <CustomerPage title="Your account" description="Manage your profile and saved delivery addresses." cards={[]}><CustomerAccount initialAccount={initialAccount} /></CustomerPage>
}
