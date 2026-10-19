export type CatalogueSort = 'relevance' | 'price-low' | 'price-high' | 'rating' | 'discount'
export type CatalogueDietary = 'organic' | 'vegetarian' | 'glutenFree' | ''
export type CatalogueFilters = {
  category: string
  brand: string
  variant: string
  colour: string
  sort: CatalogueSort
  rating: number
  availability: boolean
  minPrice: string
  maxPrice: string
  dietary: CatalogueDietary
}

export const defaultCatalogueFilters: CatalogueFilters = {
  category: '', brand: '', variant: '', colour: '', sort: 'relevance', rating: 0,
  availability: false, minPrice: '', maxPrice: '', dietary: '',
}

export function catalogueFiltersFromParams(params: { [key: string]: string | string[] | undefined }): CatalogueFilters {
  const value = (key: string) => Array.isArray(params[key]) ? params[key]?.[0] ?? '' : params[key] ?? ''
  const sortValue = value('sort')
  const ratingValue = Number(value('rating'))
  const dietaryValue = value('dietary')
  return {
    category: value('category'),
    brand: value('brand'),
    variant: value('variant'),
    colour: value('colour'),
    sort: (['relevance', 'price-low', 'price-high', 'rating', 'discount'].includes(sortValue) ? sortValue : 'relevance') as CatalogueSort,
    rating: [0, 4, 4.5].includes(ratingValue) ? ratingValue : 0,
    availability: value('available') === '1',
    minPrice: value('min'),
    maxPrice: value('max'),
    dietary: (['organic', 'vegetarian', 'glutenFree'].includes(dietaryValue) ? dietaryValue : '') as CatalogueDietary,
  }
}
