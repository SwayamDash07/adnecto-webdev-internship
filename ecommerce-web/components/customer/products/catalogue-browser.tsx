'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { filterProducts } from '@/lib/services/commerce'
import type { Product } from '@/types/catalog'
import { catalogueFiltersFromParams, defaultCatalogueFilters, type CatalogueFilters } from '@/lib/catalogue-filters'
import { ProductCard } from '@/components/shared/product-card'

export function CatalogueBrowser({ initialProducts, initialCategories, initialQuery = '', initialFilters = defaultCatalogueFilters }: { initialProducts: Product[]; initialCategories: string[]; initialQuery?: string; initialFilters?: CatalogueFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const productsFromDatabase = initialProducts
  const categoryOptions = initialCategories
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialFilters.category)
  const [brand, setBrand] = useState(initialFilters.brand)
  const [variant, setVariant] = useState(initialFilters.variant)
  const [colour, setColour] = useState(initialFilters.colour)
  const [sort, setSort] = useState<CatalogueFilters['sort']>(initialFilters.sort)
  const [rating, setRating] = useState(initialFilters.rating)
  const [availability, setAvailability] = useState(initialFilters.availability)
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice)
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice)
  const [filterOpen, setFilterOpen] = useState(false)
  const [dietary, setDietary] = useState<CatalogueFilters['dietary']>(initialFilters.dietary)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    setQuery(params.get('q') ?? initialQuery)
    const filters = catalogueFiltersFromParams(Object.fromEntries(params.entries()))
    setCategory(filters.category); setBrand(filters.brand); setVariant(filters.variant); setColour(filters.colour)
    setSort(filters.sort); setRating(filters.rating); setAvailability(filters.availability)
    setMinPrice(filters.minPrice); setMaxPrice(filters.maxPrice); setDietary(filters.dietary)
  }, [initialQuery, searchParams])
  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    const queryString = params.toString()
    startTransition(() => router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false }))
  }
  const scopedProducts = useMemo(() => productsFromDatabase.filter(product => (!category || product.category === category) && (!query || `${product.name} ${product.brand ?? ''} ${product.category}`.toLowerCase().includes(query.toLowerCase()))), [productsFromDatabase, category, query])
  const brands = [...new Set(scopedProducts.map(product => product.brand).filter((value): value is string => Boolean(value)))].sort()
  const variants = [...new Set(scopedProducts.flatMap(product => product.variants ?? []))].sort()
  const colours = [...new Set(scopedProducts.map(product => product.color).filter(Boolean))].sort()
  const hasDietaryOptions = scopedProducts.some(product => product.isOrganic || product.isVegetarian || product.isGlutenFree)
  const matches = useMemo(() => filterProducts(productsFromDatabase, { query, category, brand, sort, rating, availability, minPrice: Number(minPrice) || undefined, maxPrice: Number(maxPrice) || undefined, organic: dietary === 'organic', vegetarian: dietary === 'vegetarian', glutenFree: dietary === 'glutenFree' }).filter(product => (!variant || product.variants?.includes(variant)) && (!colour || product.color === colour)), [productsFromDatabase, query, category, brand, sort, rating, availability, minPrice, maxPrice, variant, colour, dietary])
  function setFilter<K extends keyof CatalogueFilters>(key: K, value: CatalogueFilters[K], param: string, encoded = String(value)) {
    const setters = { category: setCategory, brand: setBrand, variant: setVariant, colour: setColour, sort: setSort, rating: setRating, availability: setAvailability, minPrice: setMinPrice, maxPrice: setMaxPrice, dietary: setDietary }
    setters[key](value as never)
    updateUrl({ [param]: encoded === '' || encoded === '0' || encoded === 'false' || encoded === 'relevance' ? null : encoded })
  }
  function clearFilters() {
    setCategory(''); setBrand(''); setVariant(''); setColour(''); setRating(0); setAvailability(false); setMinPrice(''); setMaxPrice(''); setDietary(''); setSort('relevance')
    updateUrl({ category: null, brand: null, variant: null, colour: null, rating: null, available: null, min: null, max: null, dietary: null, sort: null })
  }
  return <section className="catalog-browser" aria-busy={pending} style={pending ? { opacity: 0.82, transition: 'opacity 150ms' } : undefined}><div className="catalog-controls"><button className={`filter-trigger ${filterOpen ? 'is-open' : ''}`} onClick={() => setFilterOpen(true)}>☷ <span>Filter</span>{(category || brand || variant || colour || rating || availability || minPrice || maxPrice || dietary) && <b>•</b>}</button><label className="sort-control"><span>Sort</span><select value={sort} onChange={event => setFilter('sort', event.target.value as CatalogueFilters['sort'], 'sort', event.target.value)} aria-label="Sort products"><option value="relevance">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Top rated</option><option value="discount">Biggest discount</option></select></label><span className="catalog-result-count" aria-live="polite">{`${matches.length} products found`}</span></div>{filterOpen && <><button className="filter-backdrop" aria-label="Close filters" onClick={() => setFilterOpen(false)} /><aside className="filter-drawer" aria-label="Product filters"><div className="filter-drawer-heading"><div><p className="eyebrow">REFINE RESULTS</p><h2>Filters</h2><p>Options shown for the products you’re browsing.</p></div><button className="drawer-close" onClick={() => setFilterOpen(false)} aria-label="Close filters">×</button></div><div className="filter-drawer-body"><label>Category<select value={category} onChange={event => { setFilter('category', event.target.value, 'category'); if (event.target.value) updateUrl({ brand: null, variant: null, colour: null }) }}><option value="">All categories</option>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select></label>{brands.length > 1 && <label>Brand<select value={brand} onChange={event => setFilter('brand', event.target.value, 'brand')}><option value="">All brands</option>{brands.map(item => <option key={item}>{item}</option>)}</select></label>}{variants.length > 1 && <label>Size / variant<select value={variant} onChange={event => setFilter('variant', event.target.value, 'variant')}><option value="">All sizes and variants</option>{variants.map(item => <option key={item}>{item}</option>)}</select></label>}{colours.length > 1 && <label>Colour<select value={colour} onChange={event => setFilter('colour', event.target.value, 'colour')}><option value="">All colours</option>{colours.map(item => <option key={item}>{item}</option>)}</select></label>}<div className="filter-price"><span>Price range</span><div><input type="number" min="0" value={minPrice} onChange={event => setFilter('minPrice', event.target.value, 'min')} onBlur={() => updateUrl({ min: minPrice || null, max: maxPrice || null })} placeholder="Min" aria-label="Minimum price" /><input type="number" min="0" value={maxPrice} onChange={event => setFilter('maxPrice', event.target.value, 'max')} onBlur={() => updateUrl({ min: minPrice || null, max: maxPrice || null })} placeholder="Max" aria-label="Maximum price" /></div></div><label>Rating<select value={rating} onChange={event => setFilter('rating', Number(event.target.value), 'rating', event.target.value)}><option value="0">Any rating</option><option value="4">4★ and above</option><option value="4.5">4.5★ and above</option></select></label>{hasDietaryOptions && <div className="filter-checks"><span>Product attributes</span>{scopedProducts.some(product => product.isOrganic) && <label><input type="checkbox" checked={dietary === 'organic'} onChange={() => { const next = dietary === 'organic' ? '' : 'organic'; setFilter('dietary', next, 'dietary', next) }} /> Organic</label>}{scopedProducts.some(product => product.isVegetarian) && <label><input type="checkbox" checked={dietary === 'vegetarian'} onChange={() => { const next = dietary === 'vegetarian' ? '' : 'vegetarian'; setFilter('dietary', next, 'dietary', next) }} /> Vegetarian</label>}{scopedProducts.some(product => product.isGlutenFree) && <label><input type="checkbox" checked={dietary === 'glutenFree'} onChange={() => { const next = dietary === 'glutenFree' ? '' : 'glutenFree'; setFilter('dietary', next, 'dietary', next) }} /> Gluten-free</label>}</div>}<label className="filter-checkbox"><input type="checkbox" checked={availability} onChange={event => setFilter('availability', event.target.checked, 'available', event.target.checked ? '1' : '')} /> In stock only</label></div><div className="filter-drawer-footer"><button className="secondary-button" onClick={clearFilters}>Clear all</button><button className="primary-button" onClick={() => setFilterOpen(false)}>Show {matches.length} results</button></div></aside></>}{<div className="product-grid">{matches.length ? matches.map(product => <ProductCard key={product.id} product={product} />) : <section className="panel placeholder"><span>⌕</span><h2>No products found</h2><p>Try adjusting your filters.</p><button className="secondary-button" onClick={clearFilters}>Clear filters</button></section>}</div>}</section>
}
