'use client'

import { AccountWelcome } from './account/account-welcome'
import { AccountQuickLinks } from './account/account-quick-links'
import { AddressManager } from './account/address-manager'
import { GiftVoucher } from './account/gift-voucher'
import { useCustomerAccount } from '@/hooks/use-customer-account'

export function CustomerAccount() {
  const account = useCustomerAccount()
  return <div className="account-dashboard"><AccountWelcome name={account.name} email={account.email} walletBalance={account.walletBalance} rewardBalance={account.rewardBalance} /><AccountQuickLinks /><div className="account-columns"><AddressManager addresses={account.addresses} showForm={account.showForm} setShowForm={account.setShowForm} form={account.form} setForm={account.setForm} message={account.message} error={account.error} addAddress={() => void account.addAddress()} /><GiftVoucher voucherCode={account.voucherCode} setVoucherCode={account.setVoucherCode} voucherMessage={account.voucherMessage} validateVoucher={() => void account.validateVoucher()} /></div></div>
}
