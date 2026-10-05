export type RazorpayOptions = { key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void; modal?: { ondismiss?: () => void } }

declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => { open: () => void } } }

export function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load Razorpay checkout.')); document.body.appendChild(script)
  })
}
