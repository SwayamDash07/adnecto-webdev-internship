'use client'

import { useState } from 'react'
import { AdminShell } from '../admin-shell'
import { type SupportTicket } from '@/lib/services/admin'

export function SupportManager() {
  const [tickets, setTickets] = useState<SupportTicket[]>([{ id: 'ST-104', customer: 'Priya Sharma', subject: 'Missing item from order', priority: 'High', status: 'Open' }, { id: 'ST-103', customer: 'Rohan Mehta', subject: 'Refund status', priority: 'Medium', status: 'Assigned' }, { id: 'ST-102', customer: 'Meera Iyer', subject: 'Change delivery slot', priority: 'Low', status: 'Resolved' }])
  return <AdminShell title="Support tickets" description="Customer support tickets, refunds, replacements and service follow-up."><section className="panel table-panel"><div className="panel-heading"><div><h2>Ticket queue</h2><p>Manage customer conversations and connect them to orders.</p></div><button className="primary-button">+ New ticket</button></div><div className="inventory-table"><div className="table-head"><span>Ticket</span><span>Customer</span><span>Subject</span><span>Priority</span><span>Status</span></div>{tickets.map(ticket => <div className="table-row" key={ticket.id}><span><strong>{ticket.id}</strong></span><span>{ticket.customer}</span><span>{ticket.subject}</span><span>{ticket.priority}</span><span>{ticket.status}</span></div>)}</div><button className="secondary-button" onClick={() => setTickets(current => [...current, { id: 'ST-101', customer: 'Aarav Kapoor', subject: 'Replacement requested', priority: 'Medium', status: 'Open' }])}>Load more tickets</button></section></AdminShell>
}
