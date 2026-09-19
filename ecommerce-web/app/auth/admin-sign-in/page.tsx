'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/shared/logo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AdminSignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const adminPortal = process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN ? `/portal/${process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN}` : '/'
  const [returnTo, setReturnTo] = useState(adminPortal)
  useEffect(() => { const params = new URLSearchParams(window.location.search); setReturnTo(params.get('returnTo')?.startsWith('/portal/') ? params.get('returnTo')! : adminPortal); if (params.get('error') === 'not_admin') setError('This account does not have administrator access.') }, [adminPortal])

  async function submit() {
    setBusy(true)
    setError('')
    const client = createSupabaseBrowserClient()
    if (!client) { setError('Supabase authentication is not configured.'); setBusy(false); return }
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) setError(signInError.message)
    else router.push(returnTo)
    setBusy(false)
  }

  return <main className="auth-shell"><section className="auth-card"><Logo /><p className="eyebrow">CARTLY OPERATIONS</p><h1>Admin sign in</h1><p>Use an administrator account to access the private operations panel.</p><label>Email<input className="auth-input" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" /></label><label>Password<input className="auth-input" value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label><button className="primary-button" disabled={busy} onClick={() => void submit()}>{busy ? 'Signing in…' : 'Sign in securely'}</button>{error && <p className="low-stock">{error}</p>}<Link href={adminPortal} className="auth-back">Back to admin portal</Link><Link href="/" className="auth-back">Go to shopping</Link></section></main>
}
