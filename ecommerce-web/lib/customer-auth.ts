import 'server-only'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireCustomerRoute(returnTo: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
  return { supabase, user }
}
