'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

type Ticket = { ticket_id: number; order_id: number | null; subject: string; message: string; priority: string; status: string; created_at: string }

export function CustomerSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium', orderId: '' })
  const [error, setError] = useState(''); const [message, setMessage] = useState('')
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('customer_list_support_tickets'); if (queryError) setError(queryError.message); else setTickets((data ?? []) as Ticket[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('customer-support-live', ['support_tickets'], () => { void load() })
  async function submit() { setError(''); setMessage(''); const client = createSupabaseBrowserClient(); if (!client) return; const { error: createError } = await client.rpc('customer_create_support_ticket', { p_subject: form.subject, p_message: form.message, p_priority: form.priority, p_order_id: form.orderId ? Number(form.orderId) : null }); if (createError) setError(createError.message); else { setMessage('Your support ticket was submitted.'); setForm({ subject: '', message: '', priority: 'medium', orderId: '' }); await load() } }
  return <section className="management-layout"><section className="panel form-panel"><h2>Contact support</h2><p>Tell us what happened and include an order number when relevant.</p><div className="form-grid"><label>Subject<input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} placeholder="What do you need help with?" /></label><label>Order number<input type="number" value={form.orderId} onChange={event => setForm({ ...form, orderId: event.target.value })} placeholder="Optional" /></label><label>Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Message<textarea value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /></label></div><button className="primary-button" onClick={() => void submit()}>Submit ticket</button>{error && <p className="low-stock">{error}</p>}{message && <p className="success-message">{message}</p>}</section><section className="panel table-panel"><div className="panel-heading"><div><h2>Your tickets</h2><p>Support history for your account.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{tickets.length ? <div className="inventory-table"><div className="table-head"><span>Ticket</span><span>Subject</span><span>Priority</span><span>Status</span><span>Date</span></div>{tickets.map(ticket => <div className="table-row" key={ticket.ticket_id}><span><strong>#{ticket.ticket_id}</strong>{ticket.order_id && <small>Order #{ticket.order_id}</small>}</span><span>{ticket.subject}<small>{ticket.message}</small></span><span>{ticket.priority}</span><span>{ticket.status}</span><span>{new Date(ticket.created_at).toLocaleDateString('en-IN')}</span></div>)}</div> : <section className="placeholder"><h2>No tickets yet</h2><p>Your support conversations will appear here.</p></section>}</section></section>
}
