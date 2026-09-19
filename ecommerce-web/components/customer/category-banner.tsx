import type { CSSProperties } from 'react'
import { categoryFromSlug } from '@/lib/data'
import { getActiveBanner } from '@/lib/banners-server'

const banners: Record<string, { title: string; copy: string; image: string }> = {
  Groceries: { title: 'Fresh picks for the week', copy: 'Pantry staples and everyday essentials in one place.', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85' },
  Electronics: { title: 'Upgrade your everyday', copy: 'Smart gear and reliable tech for home, work and play.', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1400&q=85' },
  'Personal care': { title: 'Your daily care routine', copy: 'Simple essentials for feeling your best every day.', image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1400&q=85' },
  Fashion: { title: 'Move in your own style', copy: 'Comfortable everyday pieces made for wherever you are going.', image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=85' },
  Sports: { title: 'Ready for your next session', copy: 'Useful gear for training, travel and active days.', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=85' },
  'Home appliances': { title: 'Make home feel easier', copy: 'Thoughtful essentials for comfortable everyday living.', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1400&q=85' },
}

export async function CategoryBanner({ slug }: { slug: string }) {
  const category = categoryFromSlug(slug)
  const fallback = banners[category] ?? { title: category, copy: `Explore our ${category.toLowerCase()} collection.`, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=85' }
  const live = await getActiveBanner(category.toLowerCase().replaceAll(' ', '-'))
  const banner = live ? { title: live.title, copy: live.copy ?? fallback.copy, image: live.image_url } : fallback
  return <section className="category-banner" style={{ '--banner-image': `url(${banner.image})` } as CSSProperties}><div><p className="eyebrow">CURATED FOR YOU</p><h2>{banner.title}</h2><p>{banner.copy}</p></div></section>
}
