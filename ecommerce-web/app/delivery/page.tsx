import { FulfilmentQueue, type FulfilmentOrder } from '@/components/admin/fulfilment-queue'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_list_fulfilment_orders', { p_queue: 'delivery' })
  return <FulfilmentQueue queue="delivery" initialOrders={(data ?? []) as FulfilmentOrder[]} initialError={error?.message ?? ''} initialFilters={{ search: typeof params.search === 'string' ? params.search : '', status: typeof params.status === 'string' ? params.status : '', sort: typeof params.sort === 'string' ? params.sort : '' }} />
}
