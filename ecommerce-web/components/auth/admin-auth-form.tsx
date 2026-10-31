'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/shared/logo'
import { adminAuthAction } from '@/app/auth/admin-sign-in/actions'
import { initialAuthActionState } from '@/lib/auth-action-state'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in securely'}</button>
}

export function AdminAuthForm({ returnTo, initialError }: { returnTo: string; initialError?: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(adminAuthAction, initialAuthActionState)
  const [pageError, setPageError] = useState(initialError)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const handledDestination = useRef<string | null>(null)

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus()
    else if (state.fieldErrors?.password) passwordRef.current?.focus()
  }, [state.fieldErrors])

  useEffect(() => {
    if (!state.destination || handledDestination.current === state.destination) return
    handledDestination.current = state.destination
    router.push(state.destination)
  }, [router, state.destination])

  return <main className="auth-shell"><section className="auth-card"><Logo /><p className="eyebrow">CARTLY OPERATIONS</p><h1>Admin sign in</h1><p>Use an administrator account to access the private operations panel.</p><form action={formAction} onChange={() => setPageError(undefined)}>
    <input type="hidden" name="returnTo" value={returnTo} />
    <label>Email<input ref={emailRef} className="auth-input" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? 'admin-email-error' : undefined} /></label>
    {state.fieldErrors?.email && <small id="admin-email-error" className="low-stock" role="alert">{state.fieldErrors.email}</small>}
    <label>Password<input ref={passwordRef} className="auth-input" name="password" type="password" autoComplete="current-password" required minLength={8} aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password ? 'admin-password-error' : undefined} /></label>
    {state.fieldErrors?.password && <small id="admin-password-error" className="low-stock" role="alert">{state.fieldErrors.password}</small>}
    <SubmitButton />
  </form>{(state.formError || pageError) && <p className="low-stock" role="alert">{state.formError || pageError}</p>}<Link href="/" className="auth-back">Go to shopping</Link></section></main>
}
