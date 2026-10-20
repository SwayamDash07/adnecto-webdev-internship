'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { emptyAddressForm } from '@/constants/customer-account'
import type { AccountAddress, AccountAddressForm, VoucherValidationResult } from '@/types/customer-account'

export type CustomerAccountInitialData = { name: string; email: string; addresses: AccountAddress[]; walletBalance: number; rewardBalance: number }

export function useCustomerAccount(initial: CustomerAccountInitialData) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [email, setEmail] = useState(initial.email)
  const [addresses, setAddresses] = useState<AccountAddress[]>(initial.addresses)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AccountAddressForm>(emptyAddressForm)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [walletBalance, setWalletBalance] = useState(initial.walletBalance)
  const [rewardBalance, setRewardBalance] = useState(initial.rewardBalance)
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherMessage, setVoucherMessage] = useState('')

  useEffect(() => {
    setName(initial.name)
    setEmail(initial.email)
    setAddresses(initial.addresses)
    setWalletBalance(initial.walletBalance)
    setRewardBalance(initial.rewardBalance)
  }, [initial])

  async function addAddress() {
    setError(''); setMessage('')
    const client = createSupabaseBrowserClient()
    const { data: { user } } = client ? await client.auth.getUser() : { data: { user: null } }
    if (!client || !user) return setError('Please sign in before adding an address.')
    const { error: insertError } = await client.from('addresses').insert({ user_id: user.id, label: form.label, line1: form.line1, city: form.city, postal_code: form.postalCode, delivery_instructions: form.instructions || null })
    if (insertError) return setError(insertError.message)
    setForm({ ...emptyAddressForm }); setShowForm(false); setMessage('Address saved.'); router.refresh()
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
