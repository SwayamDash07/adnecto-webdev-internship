import { AccountQuickLinks } from './account/account-quick-links'
import { AccountWelcome } from './account/account-welcome'
import { CustomerAccountControls } from './account/customer-account-controls'
import type { CustomerAccountInitialData } from '@/hooks/use-customer-account'

export function CustomerAccount({ initialAccount }: { initialAccount: CustomerAccountInitialData }) {
  return <div className="account-dashboard"><AccountWelcome name={initialAccount.name} email={initialAccount.email} walletBalance={initialAccount.walletBalance} rewardBalance={initialAccount.rewardBalance} /><AccountQuickLinks /><CustomerAccountControls initialAccount={initialAccount} /></div>
}
