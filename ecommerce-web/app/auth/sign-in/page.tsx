'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/shared/logo'
import { cartStore } from '@/lib/cart-store'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCaptchaToken } from '@/lib/security/captcha'

export default function SignInPage() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [signup, setSignup] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const returnTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') || '/customer/dashboard' : '/customer/dashboard'
  async function submit() { setBusy(true); setError(''); const supabase = createSupabaseBrowserClient(); if (!supabase) { setError('Add Supabase environment variables to enable authentication.'); setBusy(false); return } const captchaToken = await getCaptchaToken(); const result = signup ? await supabase.auth.signUp({ email, password, options: { captchaToken } }) : await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } }); if (result.error) setError(result.error.message); else { await cartStore.mergeForUser(); router.push(returnTo) } setBusy(false) }
  async function google() { const supabase = createSupabaseBrowserClient(); if (!supabase) return setError('Add Supabase environment variables to enable authentication.'); await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${returnTo}` } }) }
  return <main className="auth-shell"><section className="auth-card"><Logo /><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p>Sign in to keep your cart synced and continue to payment.</p><label>Email<input className="auth-input" value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="you@example.com" /></label><label>Password<input className="auth-input" value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="••••••••" /></label><button className="primary-button" disabled={busy} onClick={() => void submit()}>{busy ? 'Working…' : signup ? 'Create account' : 'Sign in'}</button><button className="secondary-button auth-google" onClick={() => void google()}>Continue with Google</button>{error && <p className="low-stock">{error}</p>}<button className="auth-back" onClick={() => setSignup(!signup)}>{signup ? 'Already have an account? Sign in' : 'New to Cartly? Create an account'}</button><Link href="/" className="auth-back">Back to store</Link></section></main>
}
