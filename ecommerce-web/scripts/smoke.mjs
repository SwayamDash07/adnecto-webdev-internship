import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const origin = (process.env.SMOKE_ORIGIN ?? 'http://localhost:3100').replace(/\/$/, '')
const token = process.env.ADMIN_ROUTE_TOKEN
if (!token) throw new Error('ADMIN_ROUTE_TOKEN must be set for the protected-route smoke check.')

const cases = [
  ['/', 200],
  ['/customer/category/test', 200],
  ['/customer/product/test', 200],
  ['/customer/search?q=milk', 200],
  ['/auth/sign-in', 200],
  ['/auth/admin-sign-in', 200],
  ['/customer/orders', 307],
  ['/customer/checkout', 307],
  [`/portal/${token}/orders`, 307],
]

let failed = false
for (const [path, expected] of cases) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
    const status = response.status
    const location = response.headers.get('location') ?? ''
    const ok = status === expected && status < 500
    if (!ok) failed = true
    console.log(`${ok ? 'PASS' : 'FAIL'}\t${status}\t${path}\t${location}`)
  } catch (error) {
    failed = true
    console.log(`FAIL\tERR\t${path}\t${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed) process.exitCode = 1
