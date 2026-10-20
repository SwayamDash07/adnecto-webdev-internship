import { CustomerPage } from '@/components/customer/customer-page'
import { SupportChatScreen } from '@/components/customer/support-chat-screen'
import { requireCustomerRoute } from '@/lib/customer-auth'
import { notFound } from 'next/navigation'

export default async function ExistingSupportChatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicate?: string | string[] }> }) {
  const [{ id: rawId }, query] = await Promise.all([params, searchParams])
  const { supabase } = await requireCustomerRoute(`/customer/support/chat/${encodeURIComponent(rawId)}`)
  const ticketId = /^\d+$/.test(rawId) ? Number(rawId) : 0
  let initialTicket = null
  let initialMessages = []
  let initialError = ''
  if (!ticketId) notFound()
  else {
    const { data: tickets, error: ticketError } = await supabase.rpc('customer_list_support_tickets')
    initialTicket = ((tickets ?? []) as Array<{ ticket_id: number; order_id: number | null; subject: string; status: string; issue_type: string }>).find(ticket => ticket.ticket_id === ticketId) ?? null
    if (!initialTicket) notFound()
    const { data: messages, error: messagesError } = await supabase.rpc('customer_support_chat_messages', { p_ticket_id: ticketId })
    initialMessages = messages ?? []
    initialError = ticketError?.message ?? messagesError?.message ?? ''
  }
  const duplicate = (Array.isArray(query.duplicate) ? query.duplicate[0] : query.duplicate) === '1'
  return <CustomerPage title="Support" description="Chat with the Cartly support team." cards={[]} fullHeight><SupportChatScreen initialTicket={initialTicket} initialMessages={initialMessages as never[]} initialError={initialError} initialDuplicate={duplicate} initialNow={new Date().toISOString()} /></CustomerPage>
}
