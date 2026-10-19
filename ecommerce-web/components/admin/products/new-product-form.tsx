'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { emptyProduct } from '@/constants/admin-product'
import { createProductAction, type ProductActionState } from '@/app/admin/products/new/actions'
import { ProductFormFields } from './product-form-fields'

type ProductForm = typeof emptyProduct
const initialActionState: ProductActionState = {}

export function NewProductForm({ initialValues, categories, brands, gstOptions, productsHref }: {
  initialValues: ProductForm
  categories: string[]
  brands: string[]
  gstOptions: number[]
  productsHref: string
}) {
  const router = useRouter()
  const [form, setForm] = useState(initialValues)
  const [image, setImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({})
  const [actionState, formAction, pending] = useActionState(createProductAction, initialActionState)
  const [showLeave, setShowLeave] = useState(false)
  const [clientError, setClientError] = useState('')
  const [hideActionError, setHideActionError] = useState(false)
  const dirty = useMemo(() => Object.entries(form).some(([key, value]) => value !== initialValues[key as keyof ProductForm]) || Boolean(image), [form, image, initialValues])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function update(key: keyof ProductForm, value: string) {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
    setClientError('')
    setHideActionError(true)
  }

  function validate(key: keyof ProductForm): string {
    if (key === 'name' && !form.name.trim()) return 'Product name is required.'
    if (key === 'sku' && !form.sku.trim()) return 'SKU is required.'
    if (key === 'category' && !form.category.trim()) return 'Category is required.'
    if ((key === 'mrp' || key === 'price') && form[key].trim() === '') return `${key === 'mrp' ? 'MRP' : 'Selling price'} is required.`
    if ((key === 'mrp' || key === 'price' || key === 'stock') && (Number(form[key]) < 0 || !Number.isFinite(Number(form[key])))) return 'Enter a non-negative number.'
    if (key === 'price' && Number(form.price) > Number(form.mrp)) return 'Selling price must not exceed MRP.'
    if (key === 'mrp' && form.price && Number(form.price) > Number(form.mrp)) return 'MRP must be at least the selling price.'
    return ''
  }

  function validateAll() {
    const keys: Array<keyof ProductForm> = ['name', 'sku', 'category', 'mrp', 'price', 'stock']
    const next: Partial<Record<keyof ProductForm, string>> = {}
    for (const key of keys) { const issue = validate(key); if (issue) next[key] = issue }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setClientError('')
    setHideActionError(false)
    if (image?.name.startsWith('__')) {
      event.preventDefault()
      setClientError(image.name === '__too_large__' ? 'Image must be smaller than 5 MB.' : 'Choose a PNG, JPG, or WebP image.')
      return
    }
    if (!validateAll()) event.preventDefault()
  }

  return <>
    <form className="product-create-form" action={formAction} onSubmit={handleSubmit} noValidate>
      <ProductFormFields form={form} update={update} image={image} setImage={setImage} errors={{ ...actionState.fieldErrors, ...errors }} categories={categories} brands={brands} gstOptions={gstOptions} validateField={key => { const issue = validate(key); setErrors(current => ({ ...current, [key]: issue || undefined })) }} />
      {(clientError || (!hideActionError && actionState.error)) && <div className="product-error" role="alert">{clientError || actionState.error}</div>}
      <div className="product-sticky-footer">
        <button type="button" className="secondary-button" disabled={pending} onClick={() => dirty ? setShowLeave(true) : router.push(productsHref)}>Cancel</button>
        <button className="primary-button" disabled={pending}>{pending ? <><LoaderCircle size={16} className="product-spinner" />Creating product…</> : 'Create product'}</button>
      </div>
    </form>
    {showLeave && <div className="product-modal-backdrop"><section className="product-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-product-title"><h2 id="leave-product-title">Discard unsaved changes?</h2><p>Your product details have not been saved. Leave this page and discard them?</p><div><button className="secondary-button" onClick={() => setShowLeave(false)}>Keep editing</button><button className="product-danger-button" onClick={() => router.push(productsHref)}>Discard changes</button></div></section></div>}
  </>
}
