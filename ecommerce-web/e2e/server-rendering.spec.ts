import { test, expect } from '@playwright/test'
import { required, signInCustomer } from './helpers'

test('public home, category, and product pages contain server-rendered product data without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const home = await page.goto('/')
  expect(home?.status()).toBe(200)

  const productName = (await page.locator('.product-card h3').first().textContent())?.trim()
  expect(productName, 'home must contain a real product name in its HTML').toBeTruthy()
  const categoryHref = await page.locator('a[href^="/customer/category/"]').first().getAttribute('href')
  expect(categoryHref).toBeTruthy()

  const category = await page.goto(categoryHref!)
  expect(category?.status()).toBe(200)
  expect((await page.locator('.product-card h3').allTextContents()).some(name => name.trim().length > 0), 'category HTML must include product names').toBe(true)

  const detail = await page.goto(`/customer/product/${required('E2E_TEST_PRODUCT_ID')}`)
  expect(detail?.status()).toBe(200)
  await expect(page.locator('h1')).toContainText(required('E2E_TEST_PRODUCT_NAME'))
  await context.close()
})

test('customer orders contain a real order number in HTML with JavaScript disabled', async ({ browser }) => {
  const authContext = await browser.newContext()
  const authPage = await authContext.newPage()
  await signInCustomer(authPage)
  const storageState = await authContext.storageState()
  await authContext.close()

  const context = await browser.newContext({ javaScriptEnabled: false, storageState })
  const page = await context.newPage()
  const response = await page.goto('/customer/orders')
  expect(response?.status()).toBe(200)
  const orderNumber = required('E2E_CUSTOMER_A_ORDER_NUMBER')
  await expect(page.locator('body')).toContainText(`Order #${orderNumber}`)
  await context.close()
})
