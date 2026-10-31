'use client'

import { AddressManager } from './address-manager'
import { useCustomerAccount, type CustomerAccountInitialData } from '@/hooks/use-customer-account'

export function CustomerAccountControls({ initialAccount }: { initialAccount: CustomerAccountInitialData }) {
  const account = useCustomerAccount(initialAccount)
  return <div className="account-columns"><AddressManager addresses={account.addresses} showForm={account.showForm} setShowForm={account.setShowForm} form={account.form} setForm={account.setForm} message={account.message} error={account.error} addAddress={() => void account.addAddress()} /></div>
}
