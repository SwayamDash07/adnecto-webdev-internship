import { CustomerPage } from '@/components/customer/customer-page'
import { SupportChatScreen } from '@/components/customer/support-chat-screen'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function NewSupportChatPage({ searchParams }: { searchParams: Promise<{ order?: string | string[] }> }) {
  const params = await searchParams
  const rawOrderId = Array.isArray(params.order) ? params.order[0] : params.order
  const orderId = rawOrderId && /^\d+$/.test(rawOrderId) ? Number(rawOrderId) : null
  const supabase = await createSupabaseServerClient()
  const { data } = orderId
    ? await supabase.from('orders').select('id,status').eq('id', orderId).maybeSingle()
    : { data: null }
  const initialError = orderId && !data ? 'We could not find that order.' : ''
  return <CustomerPage title="Support" description="Chat with the Cartly support team." cards={[]} fullHeight><SupportChatScreen initialOrderId={data?.id ?? null} initialOrderStatus={data?.status ?? ''} initialError={initialError} initialNow={new Date().toISOString()} /></CustomerPage>
}
