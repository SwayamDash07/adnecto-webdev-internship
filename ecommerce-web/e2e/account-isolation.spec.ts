import { test, expect } from '@playwright/test'
import { authenticate, required } from './helpers'

test('customers see only their own order history', async ({ browser }) => {
  const customerA = await browser.newPage()
  await authenticate(customerA, required('E2E_CUSTOMER_A_EMAIL'), required('E2E_CUSTOMER_A_PASSWORD'), '/customer/orders')
  const orderNumber = required('E2E_CUSTOMER_A_ORDER_NUMBER')
  await expect(customerA.locator('body')).toContainText(`Order #${orderNumber}`)

  const customerB = await browser.newPage()
  await authenticate(customerB, required('E2E_CUSTOMER_B_EMAIL'), required('E2E_CUSTOMER_B_PASSWORD'), '/customer/orders')
  await expect(customerB.locator('body')).not.toContainText(`Order #${orderNumber}`)
  await expect(customerB.locator('body')).toContainText(/No orders|no orders|Start shopping/i)
  await customerA.context().close()
  await customerB.context().close()
})

test('staff route access follows the assigned role', async ({ browser }) => {
  const manager = await browser.newPage()
  await authenticate(manager, required('E2E_STORE_MANAGER_EMAIL'), required('E2E_STORE_MANAGER_PASSWORD'), `/portal/${required('ADMIN_ROUTE_TOKEN')}/orders`)
  await expect(manager).toHaveURL(/\/portal\/[^/]+\/orders$/)
  await manager.goto(`/portal/${required('ADMIN_ROUTE_TOKEN')}/customers`)
  await expect(manager).toHaveURL(/\/portal\/[^/]+\/orders\?accessDenied=1$/)

  const picker = await browser.newPage()
  await authenticate(picker, required('E2E_PICKER_EMAIL'), required('E2E_PICKER_PASSWORD'), `/portal/${required('ADMIN_ROUTE_TOKEN')}/picker`)
  await expect(picker).toHaveURL(/\/portal\/[^/]+\/picker$/)
  await picker.goto(`/portal/${required('ADMIN_ROUTE_TOKEN')}/customers`)
  await expect(picker).toHaveURL(/\/portal\/[^/]+\/picker\?accessDenied=1$/)
  await manager.context().close()
  await picker.context().close()
})
