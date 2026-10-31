'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const numericText = z.string().trim().min(1).refine(value => Number.isFinite(Number(value)) && Number(value) >= 0)
const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'),
  sku: z.string().trim().min(1, 'SKU is required.'),
  barcode: z.string().trim(),
  brand: z.string().trim(),
  category: z.string().trim().min(1, 'Category is required.'),
  description: z.string().max(1000),
  price: numericText,
  mrp: numericText,
  gst: z.enum(['0', '5', '12', '18', '28']),
  hsn: z.string().trim(),
  stock: z.string().trim().refine(value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)),
  is_returnable: z.boolean(),
}).superRefine((value, context) => {
  if (Number(value.price) > Number(value.mrp)) context.addIssue({ code: 'custom', path: ['price'], message: 'Selling price must not exceed MRP.' })
})

export type ProductActionState = {
  error?: string
  fieldErrors?: Partial<Record<'name' | 'sku' | 'category' | 'mrp' | 'price' | 'stock', string>>
}

function readFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    barcode: String(formData.get('barcode') ?? ''),
    brand: String(formData.get('brand') ?? ''),
    category: String(formData.get('category') ?? ''),
    description: String(formData.get('description') ?? ''),
    price: String(formData.get('price') ?? ''),
    mrp: String(formData.get('mrp') ?? ''),
    gst: String(formData.get('gst') ?? '5'),
    hsn: String(formData.get('hsn') ?? ''),
    stock: String(formData.get('stock') ?? '0'),
    is_returnable: formData.get('is_returnable') === 'on',
  }
}

export async function createProductAction(_previous: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const values = readFields(formData)
  const parsed = productSchema.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: ProductActionState['fieldErrors'] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && key in values && !fieldErrors[key as keyof NonNullable<ProductActionState['fieldErrors']>]) {
        fieldErrors[key as keyof NonNullable<ProductActionState['fieldErrors']>] = issue.message
      }
    }
    return { error: 'Please fix the highlighted fields and try again.', fieldErrors }
  }

  const image = formData.get('image')
  if (image instanceof File && image.name) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) return { error: 'Choose a PNG, JPG, or WebP image.' }
    if (image.size > 5 * 1024 * 1024) return { error: 'Image must be smaller than 5 MB.' }
  }

  try {
    await requirePermission('products:create')
  } catch {
    return { error: 'You do not have permission to create products.' }
  }

  const supabase = await createSupabaseServerClient()
  const { data: productId, error } = await supabase.rpc('admin_create_product_with_returnability', {
    p_name: parsed.data.name,
    p_sku: parsed.data.sku || null,
    p_barcode: parsed.data.barcode || null,
    p_brand: parsed.data.brand || null,
    p_category: parsed.data.category || null,
    p_description: parsed.data.description || null,
    p_selling_price: Number(parsed.data.price),
    p_mrp: Number(parsed.data.mrp || parsed.data.price),
    p_gst: Number(parsed.data.gst),
    p_hsn: parsed.data.hsn || null,
    p_stock: Number(parsed.data.stock || 0),
    p_is_returnable: parsed.data.is_returnable,
  })
  if (error || !productId) return { error: 'Could not create the product. Check the details and try again.' }

  if (image instanceof File && image.name) {
    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('product-media').upload(path, image)
    if (uploadError) return { error: 'Product saved, but its image could not be uploaded. You can add the image from Products.' }
    const { data: publicUrl } = supabase.storage.from('product-media').getPublicUrl(path)
    const { error: imageError } = await supabase.rpc('admin_add_product_image', {
      p_product_id: productId,
      p_storage_path: publicUrl.publicUrl,
      p_alt_text: parsed.data.name,
    })
    if (imageError) return { error: 'Product saved, but its image could not be attached. You can add the image from Products.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/customer/category/[slug]', 'page')
  revalidateTag('catalog-products')
  const routeToken = process.env.ADMIN_ROUTE_TOKEN ?? process.env.NEXT_PUBLIC_ADMIN_ROUTE_TOKEN
  const routeBase = routeToken ? `/portal/${routeToken}` : '/404'
  redirect(`${routeBase}/products?created=1`)
}
