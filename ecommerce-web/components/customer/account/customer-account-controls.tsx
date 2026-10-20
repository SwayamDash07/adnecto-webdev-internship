'use client'

import { AddressManager } from './address-manager'
import { GiftVoucher } from './gift-voucher'
import { useCustomerAccount, type CustomerAccountInitialData } from '@/hooks/use-customer-account'

export function CustomerAccountControls({ initialAccount }: { initialAccount: CustomerAccountInitialData }) {
  const account = useCustomerAccount(initialAccount)
  return <div className="account-columns"><AddressManager addresses={account.addresses} showForm={account.showForm} setShowForm={account.setShowForm} form={account.form} setForm={account.setForm} message={account.message} error={account.error} addAddress={() => void account.addAddress()} /><GiftVoucher voucherCode={account.voucherCode} setVoucherCode={account.setVoucherCode} voucherMessage={account.voucherMessage} validateVoucher={() => void account.validateVoucher()} /></div>
}
