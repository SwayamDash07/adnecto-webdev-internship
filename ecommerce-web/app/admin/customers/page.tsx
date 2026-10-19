import { LiveCustomerManager } from '@/components/admin/customers/live-customer-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AdminCustomer } from '@/types/admin'

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_customers')
  return <LiveCustomerManager initialCustomers={(data ?? []) as AdminCustomer[]} initialError={error?.message ?? ''} />
}
