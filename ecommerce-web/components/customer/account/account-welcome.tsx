'use client'

import { ShieldCheck, UserRound, WalletCards } from 'lucide-react'

export function AccountWelcome({ name, email, walletBalance, rewardBalance }: { name: string; email: string; walletBalance: number; rewardBalance: number }) {
  return <section className="account-welcome panel"><div className="account-welcome-copy"><span className="account-avatar"><UserRound size={22} /></span><div><p className="eyebrow">YOUR PROFILE</p><h2>{name || 'Your account'}</h2><p>{email || 'Manage your Cartly account details and preferences.'}</p></div></div><div className="account-balance-row"><span><WalletCards size={16} /> Wallet <strong>₹{walletBalance.toLocaleString('en-IN')}</strong></span><span><ShieldCheck size={16} /> Rewards <strong>{rewardBalance} points</strong></span></div></section>
}
