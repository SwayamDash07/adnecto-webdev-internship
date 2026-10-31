import { defineConfig, devices } from '@playwright/test'
import nextEnv from '@next/env'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())
const e2eEnvPath = resolve(process.cwd(), '.env.e2e.local')
if (existsSync(e2eEnvPath)) {
  for (const line of readFileSync(e2eEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || match[1].startsWith('#') || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const externalServer = process.env.E2E_EXTERNAL_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(externalServer ? {} : {
    webServer: {
      command: 'npm run build && npm run start -- --port 3100',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  }),
})
