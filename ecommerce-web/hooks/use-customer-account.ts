'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { emptyAddressForm } from '@/constants/customer-account'
import type { AccountAddress, AccountAddressForm, VoucherValidationResult } from '@/types/customer-account'

export function useCustomerAccount() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [addresses, setAddresses] = useState<AccountAddress[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AccountAddressForm>(emptyAddressForm)
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
    setAddresses((savedAddresses ?? []) as AccountAddress[])
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
    setForm({ ...emptyAddressForm }); setShowForm(false); setMessage('Address saved.'); await load()
  }

  async function validateVoucher() {
    setVoucherMessage('')
    const client = createSupabaseBrowserClient()
    if (!client || !voucherCode.trim()) return setVoucherMessage('Enter a voucher code.')
    const { data, error: voucherError } = await client.rpc('customer_validate_voucher', { p_code: voucherCode.trim() })
    if (voucherError) setVoucherMessage(voucherError.message)
    else { const result = (data?.[0] ?? data) as VoucherValidationResult | null; setVoucherMessage(result?.valid ? `${result.message} Balance: ₹${Number(result.balance).toLocaleString('en-IN')}` : 'Voucher is invalid, expired, or not assigned to this account.') }
  }

  return { name, email, addresses, showForm, setShowForm, form, setForm, error, message, walletBalance, rewardBalance, voucherCode, setVoucherCode, voucherMessage, addAddress, validateVoucher }
}
