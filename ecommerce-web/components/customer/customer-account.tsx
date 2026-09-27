'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin, PackageCheck, ShieldCheck, UserRound, WalletCards } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type Address = { id: number; label: string; line1: string; city: string; postal_code: string }

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
    setWalletBalance(Number(wallet.data ?? 0))
    setRewardBalance(Number(rewards.data ?? 0))
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
    setVoucherMessage('')
    const client = createSupabaseBrowserClient()
    if (!client || !voucherCode.trim()) return setVoucherMessage('Enter a voucher code.')
    const { data, error: voucherError } = await client.rpc('customer_validate_voucher', { p_code: voucherCode.trim() })
    if (voucherError) setVoucherMessage(voucherError.message)
    else { const result = (data?.[0] ?? data) as { valid?: boolean; balance?: number; message?: string } | null; setVoucherMessage(result?.valid ? `${result.message} Balance: ₹${Number(result.balance).toLocaleString('en-IN')}` : 'Voucher is invalid, expired, or not assigned to this account.') }
  }

  return <div className="account-dashboard"><section className="account-welcome panel"><div className="account-welcome-copy"><span className="account-avatar"><UserRound size={22} /></span><div><p className="eyebrow">YOUR PROFILE</p><h2>{name || 'Your account'}</h2><p>{email || 'Manage your Cartly account details and preferences.'}</p></div></div><div className="account-balance-row"><span><WalletCards size={16} /> Wallet <strong>₹{walletBalance.toLocaleString('en-IN')}</strong></span><span><ShieldCheck size={16} /> Rewards <strong>{rewardBalance} points</strong></span></div></section><div className="account-quick-links"><Link href="/customer/orders" className="account-quick-link"><PackageCheck size={18} /><span><strong>Your orders</strong><small>Track purchases and deliveries</small></span><ArrowRight size={16} /></Link><Link href="/customer/returns" className="account-quick-link"><PackageCheck size={18} /><span><strong>Returns &amp; refunds</strong><small>Start or track a return</small></span><ArrowRight size={16} /></Link></div><div className="account-columns"><section className="panel address-manager"><div className="panel-heading"><div><p className="eyebrow">DELIVERY</p><h2>Saved addresses</h2><p>Use a saved address during checkout.</p></div><button className="secondary-button" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add address'}</button></div>{showForm && <div className="form-grid account-form"><label>Label<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label><label>Address<input value={form.line1} onChange={event => setForm({ ...form, line1: event.target.value })} /></label><label>City<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></label><label>Postal code<input value={form.postalCode} onChange={event => setForm({ ...form, postalCode: event.target.value })} /></label><label>Delivery instructions<textarea value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })} /></label><button className="primary-button" onClick={() => void addAddress()}>Save address</button></div>}{message && <p className="success-message">{message}</p>}{error && <p className="low-stock">{error}</p>}{addresses.length ? <div className="address-grid">{addresses.map(address => <div className="address-card" key={address.id}><MapPin size={16} /><strong>{address.label}</strong><span>{address.line1}</span><small>{address.city} {address.postal_code}</small></div>)}</div> : <div className="account-empty"><MapPin size={20} /><span>No saved addresses yet.</span></div>}</section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">CARTLY CREDIT</p><h2>Gift voucher</h2><p>Validate a voucher assigned to your account.</p></div></div><div className="coupon-box"><input value={voucherCode} onChange={event => setVoucherCode(event.target.value)} placeholder="Enter voucher code" /><button onClick={() => void validateVoucher()}>Check balance</button>{voucherMessage && <small>{voucherMessage}</small>}</div></section></div></div>
}
