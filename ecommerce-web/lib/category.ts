import { categorySlugMap } from '@/constants/categories'

export function categoryFromSlug(slug: string) { return categorySlugMap[slug.trim().toLowerCase()] ?? slug.trim().replaceAll('-', ' ') }
