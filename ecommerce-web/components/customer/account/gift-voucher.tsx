'use client'

export function GiftVoucher({ voucherCode, setVoucherCode, voucherMessage, validateVoucher }: { voucherCode: string; setVoucherCode: (value: string) => void; voucherMessage: string; validateVoucher: () => void }) {
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CARTLY CREDIT</p><h2>Gift voucher</h2><p>Validate a voucher assigned to your account.</p></div></div><div className="coupon-box"><input value={voucherCode} onChange={event => setVoucherCode(event.target.value)} placeholder="Enter voucher code" /><button onClick={() => void validateVoucher()}>Check balance</button>{voucherMessage && <small>{voucherMessage}</small>}</div></section>
}
