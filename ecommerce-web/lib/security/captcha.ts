export async function getCaptchaToken() {
  if (typeof window === 'undefined') return undefined
  const turnstile = (window as Window & { turnstile?: { execute: (siteKey: string, options: { action: string }) => Promise<string> } }).turnstile
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (!turnstile || !siteKey) return undefined
  try { return await turnstile.execute(siteKey, { action: 'authentication' }) } catch { return undefined }
}
