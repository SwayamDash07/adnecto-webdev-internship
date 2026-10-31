import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { authenticate, required } from './helpers'

function serviceClient() {
  return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
}

async function adminPage(page: Page, path: string) {
  await authenticate(page, required('E2E_ADMIN_EMAIL'), required('E2E_ADMIN_PASSWORD'), `/portal/${required('ADMIN_ROUTE_TOKEN')}${path}`)
}

test('admin can change a test order status', async ({ browser }) => {
  const customer = await browser.newPage()
  const userId = await authenticate(customer, required('E2E_CUSTOMER_A_EMAIL'), required('E2E_CUSTOMER_A_PASSWORD'), '/customer/dashboard')
  const service = serviceClient()
  const productId = Number(required('E2E_TEST_PRODUCT_ID'))
  const orderResult = await service.from('orders').insert({ user_id: userId, address_id: Number(required('E2E_TEST_ADDRESS_ID')), status: 'placed', total: 69 }).select('id').single()
  if (orderResult.error) throw orderResult.error
  const orderId = orderResult.data.id
  const itemResult = await service.from('order_items').insert({ order_id: orderId, product_id: productId, quantity: 1, unit_price: 69 })
  if (itemResult.error) throw itemResult.error
  try {
    const admin = await browser.newPage()
    await adminPage(admin, '/orders')
    await admin.getByRole('textbox', { name: 'Search orders' }).fill(String(orderId))
    const statusButton = admin.getByRole('button', { name: new RegExp(`Change status for order ${orderId}\\. Current status: placed`, 'i') })
    await statusButton.click()
    await admin.getByRole('group', { name: `Status options for order ${orderId}` }).getByRole('button', { name: 'accepted', exact: true }).click()
    await admin.getByRole('button', { name: 'Confirm change' }).click()
    await expect(admin.getByRole('button', { name: new RegExp(`Change status for order ${orderId}\\. Current status: accepted`, 'i') })).toBeVisible()
    await admin.context().close()
  } finally {
    await service.from('order_items').delete().eq('order_id', orderId)
    await service.from('orders').delete().eq('id', orderId)
    await customer.context().close()
  }
})

test('admin can create a product and record a stock correction', async ({ page }) => {
  const suffix = Date.now()
  const sku = `E2E-${suffix}`
  const name = `Cartly E2E Product ${suffix}`
  const service = serviceClient()
  try {
    await adminPage(page, '/products/new')
    await page.getByLabel(/Product name/).fill(name)
    await page.getByLabel(/SKU/).fill(sku)
    await page.getByLabel('Category').fill('Groceries')
    await page.getByLabel('MRP').fill('99')
    await page.getByLabel('Selling price').fill('89')
    await page.getByLabel('Opening stock').fill('8')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/[^/]+/products\\?created=1$`))

    await adminPage(page, '/inventory')
    await page.getByPlaceholder('Search by product or SKU').fill(name)
    await page.getByLabel('Quantity').fill('1')
    await page.getByRole('button', { name: 'Save adjustment' }).click()
    await expect(page.getByRole('status')).toContainText('Inventory updated successfully.')
  } finally {
    const { data: product } = await service.from('products').select('id').eq('sku', sku).maybeSingle()
    if (product) {
      await service.from('inventory_movements').delete().eq('product_id', product.id)
      await service.from('inventory_batches').delete().eq('product_id', product.id)
      await service.from('inventory').delete().eq('product_id', product.id)
      await service.from('product_images').delete().eq('product_id', product.id)
      await service.from('product_variants').delete().eq('product_id', product.id)
      await service.from('products').delete().eq('id', product.id)
    }
  }
})
