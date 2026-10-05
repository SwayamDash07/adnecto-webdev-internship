'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from '../admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { AdminTicket } from '@/types/admin'

export function LiveSupportManager() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]); const [error, setError] = useState('')
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('admin_list_support_tickets'); if (queryError) setError(queryError.message); else setTickets((data ?? []) as AdminTicket[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-support-live', ['support_tickets'], () => { void load() })
  async function update(ticketId: number, status: string) { const client = createSupabaseBrowserClient(); if (!client) return; const { error: updateError } = await client.rpc('admin_update_ticket_status', { p_ticket_id: ticketId, p_status: status }); if (updateError) setError(updateError.message); else await load() }
  return <AdminShell title="Support tickets" description="Review and update customer service tickets from Supabase."><section className="panel table-panel"><div className="panel-heading"><div><h2>Live ticket queue</h2><p>Customer issues and follow-up status.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}{tickets.length ? <div className="inventory-table"><div className="table-head"><span>Ticket</span><span>Customer</span><span>Subject</span><span>Priority</span><span>Status</span></div>{tickets.map(ticket => <div className="table-row" key={ticket.ticket_id}><span><strong>#{ticket.ticket_id}</strong><small>{new Date(ticket.created_at).toLocaleDateString('en-IN')}</small></span><span>{ticket.customer_name}</span><span>{ticket.subject}<small>{ticket.message}</small></span><span>{ticket.priority}</span><span><select value={ticket.status} onChange={event => void update(ticket.ticket_id, event.target.value)}><option value="open">Open</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></span></div>)}</div> : <section className="placeholder"><h2>No support tickets</h2><p>Customer tickets will appear here.</p></section>}</section></AdminShell>
}
