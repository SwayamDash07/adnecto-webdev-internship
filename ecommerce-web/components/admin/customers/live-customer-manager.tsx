'use client'

import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { Search } from 'lucide-react'
import { AdminShell } from '../admin-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { money } from '@/lib/formatters'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import type { AdminCustomer } from '@/types/admin'

export function LiveCustomerManager() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1)
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('admin_list_customers'); if (queryError) setError(queryError.message); else setCustomers((data ?? []) as AdminCustomer[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-customers-live', ['users', 'orders'], () => { void load() })
  const filteredCustomers = customers.filter(customer => `${customer.customer_name} ${customer.email} ${customer.phone ?? ''}`.toLowerCase().includes(query.toLowerCase())); const customerPages = Math.max(1, Math.ceil(filteredCustomers.length / 8)); const visibleCustomers = filteredCustomers.slice((page - 1) * 8, page * 8)
  return <AdminShell title="Customer management" description="Live customer profiles, order history and lifetime spend from Supabase."><section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">CUSTOMER DIRECTORY</p><h2>Customer directory</h2><p>Registered customer accounts only.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div>{error && <p className="low-stock">{error}</p>}<div className="table-toolbar"><label className="table-search"><Search size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search customer or email" aria-label="Search customers" /></label><span className="table-count">{filteredCustomers.length} customers</span></div>{filteredCustomers.length ? <><div className="inventory-table"><div className="table-head"><span>Customer</span><span>Email</span><span>Phone</span><span>Orders</span><span>Lifetime spend</span></div>{visibleCustomers.map(customer => <m.div className="table-row" key={customer.customer_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span><strong>{customer.customer_name}</strong><small>Joined {new Date(customer.joined_at).toLocaleDateString('en-IN')}</small></span><span>{customer.email}</span><span>{customer.phone || 'Not provided'}</span><span>{customer.order_count}</span><span>{money(Number(customer.lifetime_spend))}</span></m.div>)}</div><div className="table-pagination"><span>Page {page} of {customerPages}</span><div><button disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button><button disabled={page === customerPages} onClick={() => setPage(current => Math.min(customerPages, current + 1))}>Next</button></div></div></> : <section className="placeholder"><h2>{query ? 'No matching customers' : 'No customers found'}</h2><p>{query ? 'Try a different search.' : 'Customers will appear after registration.'}</p></section>}</section></AdminShell>
}
