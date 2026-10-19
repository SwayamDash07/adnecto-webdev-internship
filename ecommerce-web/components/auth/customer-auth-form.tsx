'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/shared/logo'
import { cartStore } from '@/lib/cart-store'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCaptchaToken } from '@/lib/security/captcha'
import { customerAuthAction } from '@/app/auth/sign-in/actions'
import { initialAuthActionState } from '@/lib/auth-action-state'

function SubmitButton({ signup }: { signup: boolean }) {
  const { pending } = useFormStatus()
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Working…' : signup ? 'Create account' : 'Sign in'}</button>
}

export function CustomerAuthForm({ returnTo }: { returnTo: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(customerAuthAction, initialAuthActionState)
  const [signup, setSignup] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const captchaRef = useRef<HTMLInputElement>(null)
  const submittingWithCaptcha = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const handledDestination = useRef<string | null>(null)
  const formError = dismissed ? undefined : state.formError

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus()
    else if (state.fieldErrors?.password) passwordRef.current?.focus()
  }, [state.fieldErrors])

  useEffect(() => {
    if (!state.destination || handledDestination.current === state.destination) return
    handledDestination.current = state.destination
    void (async () => {
      try { await cartStore.mergeForUser() }
      catch (syncError) { console.error('Guest cart sync failed after sign in:', syncError) }
      router.push(state.destination!)
    })()
  }, [router, state.destination])

  async function beginGoogleSignIn() {
    const supabase = createSupabaseBrowserClient()
    if (!supabase) { setGoogleError('Add Supabase environment variables to enable authentication.'); return }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${returnTo}` },
      })
      if (error) setGoogleError(error.message)
    } catch (error) {
      console.error('Google authentication could not start:', error)
      setGoogleError('Could not start Google sign in. Please try again.')
    }
  }

  function prepareCaptcha(event: React.FormEvent<HTMLFormElement>) {
    if (submittingWithCaptcha.current) {
      submittingWithCaptcha.current = false
      return
    }
    event.preventDefault()
    setDismissed(false)
    setGoogleError('')
    const form = event.currentTarget
    void getCaptchaToken().then(token => {
      if (captchaRef.current) captchaRef.current.value = token ?? ''
      submittingWithCaptcha.current = true
      form.requestSubmit()
    })
  }

  return <main className="auth-shell"><section className="auth-card"><Logo /><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p>Sign in to keep your cart synced and continue to payment.</p><form action={formAction} onSubmit={prepareCaptcha} onChange={() => setDismissed(false)}>
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="signup" value={signup ? 'true' : 'false'} />
    <input ref={captchaRef} type="hidden" name="captchaToken" />
    <label>Email<input ref={emailRef} className="auth-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? 'customer-email-error' : undefined} /></label>
    {state.fieldErrors?.email && <small id="customer-email-error" className="low-stock" role="alert">{state.fieldErrors.email}</small>}
    <label>Password<input ref={passwordRef} className="auth-input" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="••••••••" required minLength={8} aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password ? 'customer-password-error' : undefined} /></label>
    {state.fieldErrors?.password && <small id="customer-password-error" className="low-stock" role="alert">{state.fieldErrors.password}</small>}
    <SubmitButton signup={signup} />
  </form><button className="secondary-button auth-google" type="button" onClick={() => void beginGoogleSignIn()}>Continue with Google</button>{(formError || googleError) && <p className="low-stock" role="alert">{formError || googleError}</p>}<button className="auth-back" type="button" onClick={() => { setSignup(!signup); setDismissed(true); setGoogleError('') }}>{signup ? 'Already have an account? Sign in' : 'New to Cartly? Create an account'}</button><Link href="/" className="auth-back">Back to store</Link></section></main>
}
