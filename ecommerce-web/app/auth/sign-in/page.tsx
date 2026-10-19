import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CustomerAuthForm } from '@/components/auth/customer-auth-form'

type SignInPageProps = {
  searchParams: Promise<{ returnTo?: string }>
}

function safeReturnTo(value?: string) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/customer/dashboard'
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { returnTo: requestedReturnTo } = await searchParams
  const returnTo = safeReturnTo(requestedReturnTo)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(returnTo)

  return <CustomerAuthForm returnTo={returnTo} />
}
