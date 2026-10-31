import { expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

export function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}. Configure it in .env.e2e.local; the test must not be skipped.`)
  return value
}

export async function authenticate(page: Page, email: string, password: string, destination: string) {
  const client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`Could not authenticate E2E account: ${error?.message ?? 'no session returned'}`)
  const projectRef = new URL(required('NEXT_PUBLIC_SUPABASE_URL')).hostname.split('.')[0]
  const cookieValue = `base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`
  await page.goto('/auth/sign-in')
  await page.context().addCookies([{ name: `sb-${projectRef}-auth-token`, value: cookieValue, url: new URL(page.url()).origin, httpOnly: false, sameSite: 'Lax' }])
  await page.goto(destination)
  await expect(page).not.toHaveURL(/\/auth\/(sign-in|admin-sign-in)/)
  return data.user.id
}

export async function signInCustomer(page: Page, email = required('E2E_CUSTOMER_A_EMAIL'), password = required('E2E_CUSTOMER_A_PASSWORD')) {
  return authenticate(page, email, password, '/customer/dashboard')
}

export async function clearTestCart(userId: string) {
  const admin = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const { error } = await admin.from('cart').delete().eq('user_id', userId)
  if (error) throw new Error(`Could not clean the E2E cart: ${error.message}`)
}

export async function clearTestSupportTickets(userId: string) {
  const admin = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const { data: tickets, error: selectError } = await admin.from('support_tickets').select('id').eq('user_id', userId)
  if (selectError) throw new Error(`Could not list E2E support tickets: ${selectError.message}`)
  const ids = (tickets ?? []).map(ticket => ticket.id)
  if (ids.length) {
    const { error: eventError } = await admin.from('support_ticket_events').delete().in('ticket_id', ids)
    if (eventError) throw new Error(`Could not clean E2E support events: ${eventError.message}`)
  }
  const { error } = await admin.from('support_tickets').delete().eq('user_id', userId)
  if (error) throw new Error(`Could not clean E2E support tickets: ${error.message}`)
}

export async function signInAdmin(page: Page, email: string, password: string) {
  await authenticate(page, email, password, portalPath('/orders'))
}

export function portalPath(path: string) {
  return `/portal/${required('ADMIN_ROUTE_TOKEN')}${path.startsWith('/') ? path : `/${path}`}`
}
