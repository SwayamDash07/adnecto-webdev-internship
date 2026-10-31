'use server'

import { authSchema } from '@/lib/security/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { canAccessPath, roleHomePath } from '@/lib/permission-definitions'
import type { AuthActionState } from '@/lib/auth-action-state'

export async function adminAuthAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
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
    return { fieldErrors, formError: 'Please enter a valid email and password.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error) return { formError: 'We could not sign you in. Check your email and password, then try again.' }

  const profile = await getAdminProfile()
  if (!profile) {
    return { formError: 'We could not confirm access to a staff workspace. Please check your account or contact an administrator.' }
  }

  const token = process.env.ADMIN_ROUTE_TOKEN
  const portalBase = token ? `/portal/${token}` : '/'
  const roleLanding = roleHomePath(profile.role_name, portalBase)
  if (!roleLanding) return { formError: 'We could not confirm access to a staff workspace. Please check your account or contact an administrator.' }

  const requested = formData.get('returnTo')
  const safeReturnTo = typeof requested === 'string'
    && (requested === portalBase || requested.startsWith(`${portalBase}/`))
    && canAccessPath(profile.role_name, requested)
  return { destination: safeReturnTo ? requested as string : roleLanding }
}
