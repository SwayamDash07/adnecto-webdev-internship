import { test, expect } from '@playwright/test'
import { clearTestCart, clearTestSupportTickets, required, signInCustomer } from './helpers'

test('customer applies a live coupon in checkout', async ({ page }) => {
  const userId = await signInCustomer(page)
  await clearTestCart(userId)
  try {
    await page.goto(`/customer/product/${required('E2E_TEST_PRODUCT_ID')}`)
    await page.getByRole('button', { name: /Add to cart/i }).click()
    await page.goto('/customer/checkout')
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    await page.getByLabel('Coupon code').fill(required('E2E_TEST_COUPON'))
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.locator('.checkout-coupon-applied')).toContainText('CART10 applied')
  } finally {
    await clearTestCart(userId)
  }
})

test('customer can track their seeded order', async ({ page }) => {
  await signInCustomer(page)
  const orderNumber = required('E2E_CUSTOMER_A_ORDER_NUMBER')
  await page.goto(`/customer/orders/tracking?id=${orderNumber}`)
  await expect(page.locator('body')).toContainText(`Order #${orderNumber}`)
  await expect(page.getByRole('heading', { name: /Track your order/i })).toBeVisible()
})

test('customer can raise a complaint and send a support message', async ({ page }) => {
  const userId = await signInCustomer(page)
  await clearTestSupportTickets(userId)
  try {
    await page.goto('/customer/support/chat/new')
    await page.getByRole('button', { name: 'Other', exact: true }).click()
    const message = `Cartly E2E support message ${Date.now()}`
    await page.getByPlaceholder('Please tell us what happened').fill(message)
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page).toHaveURL(/\/customer\/support\/chat\/\d+/)
    await expect(page.locator('body')).toContainText(message)
  } finally {
    await clearTestSupportTickets(userId)
  }
})
