import { NextResponse } from 'next/server'
import { getCheckoutDeliveryOptions } from '@/lib/delivery-slots-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const options = await getCheckoutDeliveryOptions()
    return NextResponse.json({ server_now: new Date().toISOString(), options }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not load available delivery slots.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
