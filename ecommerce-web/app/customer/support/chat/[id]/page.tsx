import { CustomerPage } from '@/components/customer/customer-page'
import { SupportChatScreen } from '@/components/customer/support-chat-screen'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ExistingSupportChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const ticketId = /^\d+$/.test(rawId) ? Number(rawId) : 0
  const supabase = await createSupabaseServerClient()
  let initialTicket = null
  let initialMessages = []
  let initialError = ''
  if (!ticketId) initialError = 'This support chat could not be found.'
  else {
    const [{ data: tickets, error: ticketError }, { data: messages, error: messagesError }] = await Promise.all([
      supabase.rpc('customer_list_support_tickets'),
      supabase.rpc('customer_support_chat_messages', { p_ticket_id: ticketId }),
    ])
    initialTicket = ((tickets ?? []) as Array<{ ticket_id: number; order_id: number | null; subject: string; status: string; issue_type: string }>).find(ticket => ticket.ticket_id === ticketId) ?? null
    initialMessages = messages ?? []
    initialError = ticketError?.message ?? messagesError?.message ?? (initialTicket ? '' : 'This support chat could not be found.')
  }
  return <CustomerPage title="Support" description="Chat with the Cartly support team." cards={[]} fullHeight><SupportChatScreen initialTicket={initialTicket} initialMessages={initialMessages as never[]} initialError={initialError} initialNow={new Date().toISOString()} /></CustomerPage>
}
