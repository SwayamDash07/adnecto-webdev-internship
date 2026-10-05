import type { BannerForm } from '@/types/admin-banner'

export const placements = [['homepage', 'Homepage hero'], ['groceries', 'Groceries'], ['electronics', 'Electronics'], ['personal-care', 'Personal care'], ['home-appliances', 'Home appliances'], ['fashion', 'Fashion'], ['sports', 'Sports'], ['stationery-art', 'Stationery & art']] as const

export const blank: BannerForm = { placement: 'homepage', title: 'Promotional poster', copy: '', imageUrl: '', sortOrder: '0', active: true }
