import { test, expect } from '@playwright/test'
import { required, signInCustomer } from './helpers'

test('signed-in customer can add, increase, decrease, and remove a cart item', async ({ page }) => {
  await signInCustomer(page)
  const productId = required('E2E_TEST_PRODUCT_ID')
  const productName = required('E2E_TEST_PRODUCT_NAME')
  await page.goto(`/customer/product/${productId}`)
  await page.getByRole('button', { name: /Add to cart/i }).click()
  await expect(page.getByRole('button', { name: `Increase quantity of ${productName}` })).toBeVisible()
  await page.getByRole('button', { name: `Increase quantity of ${productName}` }).click()
  await expect(page.locator('.cart-stepper').first()).toContainText('2')
  await page.getByRole('button', { name: `Decrease quantity of ${productName}` }).click()
  await expect(page.locator('.cart-stepper').first()).toContainText('1')
  await page.getByRole('button', { name: `Decrease quantity of ${productName}` }).click()
  await expect(page.getByRole('button', { name: /Add to cart/i })).toBeVisible()
})
