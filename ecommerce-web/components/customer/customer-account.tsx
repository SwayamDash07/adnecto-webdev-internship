'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Address = { id: number; label: string; line1: string; city: string; postal_code: string; phone?: string }

export function CustomerAccount() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: 'Home', line1: '', city: '', postalCode: '', instructions: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [rewardBalance, setRewardBalance] = useState(0)
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherMessage, setVoucherMessage] = useState('')

  async function load() {
    const client = createSupabaseBrowserClient()
    if (!client) return
    const { data: { user } } = await client.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const [{ data: profile }, { data: savedAddresses }, wallet, rewards] = await Promise.all([
      client.from('users').select('full_name').eq('id', user.id).maybeSingle(),
      client.from('addresses').select('id,label,line1,city,postal_code').eq('user_id', user.id).order('id'),
      client.rpc('customer_wallet_balance'),
      client.rpc('customer_reward_balance'),
    ])
    setName(profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer')
    setAddresses((savedAddresses ?? []) as Address[])
    setWalletBalance(Number(wallet.data ?? 0)); setRewardBalance(Number(rewards.data ?? 0))
  }

  useEffect(() => { void load() }, [])

  async function addAddress() {
    setError(''); setMessage('')
    const client = createSupabaseBrowserClient()
    const { data: { user } } = client ? await client.auth.getUser() : { data: { user: null } }
    if (!client || !user) return setError('Please sign in before adding an address.')
    const { error: insertError } = await client.from('addresses').insert({ user_id: user.id, label: form.label, line1: form.line1, city: form.city, postal_code: form.postalCode, delivery_instructions: form.instructions || null })
    if (insertError) return setError(insertError.message)
    setForm({ label: 'Home', line1: '', city: '', postalCode: '', instructions: '' }); setShowForm(false); setMessage('Address saved.'); await load()
  }

  async function validateVoucher() {
    setVoucherMessage(''); const client = createSupabaseBrowserClient(); if (!client || !voucherCode.trim()) return setVoucherMessage('Enter a voucher code.')
    const { data, error: voucherError } = await client.rpc('customer_validate_voucher', { p_code: voucherCode.trim() })
    if (voucherError) setVoucherMessage(voucherError.message); else { const result = (data?.[0] ?? data) as { valid?: boolean; balance?: number; message?: string } | null; setVoucherMessage(result?.valid ? `${result.message} Balance: ₹${Number(result.balance).toLocaleString('en-IN')}` : 'Voucher is invalid, expired, or not assigned to this account.') }
  }

  return <><section className="module-grid"><div className="feature-card"><b>♙</b><h3>{name}</h3><p>{email}</p></div><div className="feature-card"><b>⌂</b><h3>{addresses.length} saved address{addresses.length === 1 ? '' : 'es'}</h3><p>Use a saved address during checkout.</p></div><div className="feature-card"><b>▣</b><h3>Wallet ₹{walletBalance.toLocaleString('en-IN')}</h3><p>Available account balance.</p></div><div className="feature-card"><b>✦</b><h3>{rewardBalance} reward points</h3><p>Points earned from eligible orders.</p></div><Link className="feature-card" href="/customer/support"><b>?</b><h3>Customer support</h3><p>Submit and track a support ticket.</p></Link></section><section className="panel address-manager"><div className="panel-heading"><div><h2>Saved addresses</h2><p>Addresses belong to your account and are used for checkout.</p></div><button className="secondary-button" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add address'}</button></div>{showForm && <div className="form-grid"><label>Label<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label><label>Address<input value={form.line1} onChange={event => setForm({ ...form, line1: event.target.value })} /></label><label>City<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></label><label>Postal code<input value={form.postalCode} onChange={event => setForm({ ...form, postalCode: event.target.value })} /></label><label>Delivery instructions<textarea value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })} /></label><button className="primary-button" onClick={() => void addAddress()}>Save address</button></div>}{message && <p className="success-message">{message}</p>}{error && <p className="low-stock">{error}</p>}<div className="address-grid">{addresses.map(address => <div className="address-card" key={address.id}><strong>{address.label}</strong><span>{address.line1}</span><small>{address.city} {address.postal_code}</small></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h2>Gift voucher</h2><p>Validate a voucher assigned to your account.</p></div></div><div className="coupon-box"><input value={voucherCode} onChange={event => setVoucherCode(event.target.value)} placeholder="Enter voucher code" /><button onClick={() => void validateVoucher()}>Check balance</button><small>{voucherMessage}</small></div></section></>
}
