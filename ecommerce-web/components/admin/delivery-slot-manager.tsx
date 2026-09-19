'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'

type Slot = { slot_id: number; starts_at: string; ends_at: string; capacity: number }

export function DeliverySlotManager() {
  const [slots, setSlots] = useState<Slot[]>([]); const [form, setForm] = useState({ starts: '', ends: '', capacity: '20' }); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('admin_list_delivery_slots'); if (queryError) setError(queryError.message); else setSlots((data ?? []) as Slot[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-delivery-slots-live', ['delivery_slots'], () => { void load() })
  async function save() { setError(''); setMessage(''); const client = createSupabaseBrowserClient(); if (!client) return; const { error: saveError } = await client.rpc('admin_upsert_delivery_slot', { p_starts_at: new Date(form.starts).toISOString(), p_ends_at: new Date(form.ends).toISOString(), p_capacity: Number(form.capacity) }); if (saveError) setError(saveError.message); else { setMessage('Delivery slot created.'); setForm({ starts: '', ends: '', capacity: '20' }); await load() } }
  return <section className="panel"><div className="panel-heading"><div><h2>Delivery slots</h2><p>Define available delivery windows and capacity.</p></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div><div className="form-grid"><label>Starts<input type="datetime-local" value={form.starts} onChange={event => setForm({ ...form, starts: event.target.value })} /></label><label>Ends<input type="datetime-local" value={form.ends} onChange={event => setForm({ ...form, ends: event.target.value })} /></label><label>Capacity<input type="number" min="1" value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })} /></label></div><button className="primary-button" onClick={() => void save()}>Add delivery slot</button>{error && <p className="low-stock">{error}</p>}{message && <p className="success-message">{message}</p>}<div className="order-list">{slots.map(slot => <div className="order-row" key={slot.slot_id}><span>{new Date(slot.starts_at).toLocaleString('en-IN')} to {new Date(slot.ends_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><b>{slot.capacity} places</b></div>)}</div></section>
}
