export type Banner = { banner_id: number; placement: string; title: string; copy: string | null; image_url: string; active: boolean; sort_order: number }

export type BannerForm = { placement: string; title: string; copy: string; imageUrl: string; sortOrder: string; active: boolean }
