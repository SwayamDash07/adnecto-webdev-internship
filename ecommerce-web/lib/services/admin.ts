export type ProductForm = { name: string; sku: string; barcode: string; brand: string; category: string; price: string; gst: string; hsn: string; stock: string; description: string; seoTitle: string; seoDescription: string }
export type CouponRule = { name: string; type: string; value: string; scope: string; starts: string; ends: string; active: boolean }
export type InventoryAdjustment = { product: string; warehouse: string; quantity: string; reason: string; batch: string; expiry: string }
export type SupportTicket = { id: string; customer: string; subject: string; priority: string; status: string }

export const emptyProductForm: ProductForm = { name: '', sku: '', barcode: '', brand: '', category: '', price: '', gst: '5', hsn: '', stock: '', description: '', seoTitle: '', seoDescription: '' }
