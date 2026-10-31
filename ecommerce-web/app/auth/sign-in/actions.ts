'use server'

import { authSchema } from '@/lib/security/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AuthActionState } from '@/lib/auth-action-state'

function safeDestination(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/customer/dashboard'
  }
  return value
}

export async function customerAuthAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const signup = formData.get('signup') === 'true'
  const parsed = authSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    const fieldErrors: AuthActionState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if ((field === 'email' || field === 'password') && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { fieldErrors, formError: 'Please check the highlighted fields.' }
  }

  const supabase = await createSupabaseServerClient()
  if (signup) {
    const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password })
    if (error) return { formError: 'We could not create your account. Check your details or try signing in.' }
    if (!data.session) {
      return { formError: 'If this address can be registered, we’ll send a confirmation link to your email.' }
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
    if (error) return { formError: 'We could not sign you in. Check your email and password, then try again.' }
  }

  return { destination: safeDestination(formData.get('returnTo')) }
}
