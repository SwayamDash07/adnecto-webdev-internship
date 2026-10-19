import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDeliveryWindow } from '@/lib/delivery-slot'

const timeZone = 'Asia/Kolkata'
export const dynamic = 'force-dynamic'
function parts(date: Date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return { year: Number(p.find(x => x.type === 'year')?.value), month: Number(p.find(x => x.type === 'month')?.value), day: Number(p.find(x => x.type === 'day')?.value) }
}
function istInstant(y: number, m: number, d: number, hour: number, minute: number) { return new Date(Date.UTC(y, m - 1, d, hour - 5, minute - 30)) }
function label(date: Date, today: Date) {
  const a = parts(date), b = parts(today)
  const dayDiff = Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000)
  return dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: '2-digit', month: 'short' }).format(date)
}

export async function GET() {
  const serverNow = new Date()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('delivery_slots').select('starts_at,ends_at,capacity').gte('starts_at', serverNow.toISOString()).order('starts_at').limit(100)
  const today = parts(serverNow)
  const firstDay = Date.UTC(today.year, today.month - 1, today.day)
  const configured = (data ?? []).filter(slot => { const date = parts(new Date(slot.starts_at)); const key = Date.UTC(date.year, date.month - 1, date.day); return key >= firstDay && key < firstDay + 3 * 86400000 })
  const result: { starts_at: string; ends_at: string; capacity: number; label: string; day: string }[] = []
  if (configured.length) {
    for (const slot of configured) {
      if (new Date(slot.starts_at).getTime() <= serverNow.getTime() + 2 * 3600000 || slot.capacity <= 0) continue
      const start = new Date(slot.starts_at), end = new Date(slot.ends_at)
      result.push({ starts_at: start.toISOString(), ends_at: end.toISOString(), capacity: slot.capacity, label: formatDeliveryWindow(start, end), day: label(start, serverNow) })
    }
  } else {
    for (let offset = 0; offset < 3; offset++) {
      const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset))
      for (const [sh,eh] of [[10,12],[12,14],[18,20]]) {
        const start = istInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), sh, 0)
        const end = istInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), eh, 0)
        if (start.getTime() <= serverNow.getTime() + 2 * 3600000) continue
        result.push({ starts_at: start.toISOString(), ends_at: end.toISOString(), capacity: 20, label: formatDeliveryWindow(start, end), day: label(start, serverNow) })
      }
    }
  }
  return NextResponse.json({ server_now: serverNow.toISOString(), slots: result })
}
