import { CatalogueBrowser } from '@/components/customer/products/catalogue-browser'
import type { ComponentProps } from 'react'

export function SearchResults(props: ComponentProps<typeof CatalogueBrowser>) { return <CatalogueBrowser {...props} /> }
