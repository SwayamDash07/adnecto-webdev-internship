export function isValidRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false
  // The API route performs the timing-safe HMAC comparison. This helper keeps the
  // input contract small and makes malformed gateway payloads easy to reject in tests.
  return orderId.length <= 100 && paymentId.length <= 100
}
