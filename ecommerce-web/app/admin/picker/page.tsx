import { FulfilmentQueue, type FulfilmentOrder } from '@/components/admin/fulfilment-queue'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AdminPickerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  let initialOrders: FulfilmentOrder[] = []
  let initialError = ''
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('admin_list_fulfilment_orders', { p_queue: 'picker' })
    if (error) {
      console.error('[admin-picker] Failed to load fulfilment queue:', error.message)
      initialError = 'We could not load the picking queue. Please retry.'
    } else if (Array.isArray(data)) {
      initialOrders = data as FulfilmentOrder[]
    } else {
      console.error('[admin-picker] Fulfilment queue returned an invalid response shape.')
      initialError = 'We could not load the picking queue. Please retry.'
    }
  } catch (error) {
    console.error('[admin-picker] Unexpected queue load failure:', error)
    initialError = 'We could not load the picking queue. Please retry.'
  }
  return <FulfilmentQueue queue="picker" initialOrders={initialOrders} initialError={initialError} initialFilters={{ search: typeof params.search === 'string' ? params.search : '', status: typeof params.status === 'string' ? params.status : '', sort: typeof params.sort === 'string' ? params.sort : '' }} />
}
