import type { CSSProperties } from 'react'
import { categoryFromSlug } from '@/lib/category'
import { getActiveBanner } from '@/lib/banners-server'

const banners: Record<string, { title: string; copy: string; image: string }> = {
  Groceries: { title: 'Fresh picks for the week', copy: 'Pantry staples and everyday essentials in one place.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/6b133d25fd8a7670a849724a94992e8e436da31e80559839ec110c2c8cca6ff8.jpg' },
  Electronics: { title: 'Upgrade your everyday', copy: 'Smart gear and reliable tech for home, work and play.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/6172731877f7c77fd6389ce5b1f64ee90ae694e69cc52ba58b4b636d2ab05301.jpg' },
  'Personal care': { title: 'Your daily care routine', copy: 'Simple essentials for feeling your best every day.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/3a81d5d65f1146f6d4d9689cd22edce36ef8aeb587961052c41a6ed403b42c20.jpg' },
  Fashion: { title: 'Move in your own style', copy: 'Comfortable everyday pieces made for wherever you are going.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/f32fbd895140b49c4480b6977f91fc9865b182b4136e0cd3ad7df3ea863f70bd.jpg' },
  Sports: { title: 'Ready for your next session', copy: 'Useful gear for training, travel and active days.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/45502f39c0fd71cd17df93af29f7d8e04667ccc6121b057da5f9266bd44ee768.jpg' },
  'Home appliances': { title: 'Make home feel easier', copy: 'Thoughtful essentials for comfortable everyday living.', image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/5ebb4aaabcc0b38ccc591f6a65a56b5fa2ceb0486d4fa9fa05753ac95c124e5d.jpg' },
}

export async function CategoryBanner({ slug }: { slug: string }) {
  const category = categoryFromSlug(slug)
  const fallback = banners[category] ?? { title: category, copy: `Explore our ${category.toLowerCase()} collection.`, image: 'https://zvlbaufmahyfzvhqkuka.supabase.co/storage/v1/object/public/product-media/catalog/cefb3ccd89cf8809327a208f454da825dbc39b465f4af260593c9c632cd2bdd6.jpg' }
  const live = await getActiveBanner(category.toLowerCase().replaceAll(' ', '-'))
  const banner = live ? { title: live.title, copy: live.copy ?? fallback.copy, image: live.image_url } : fallback
  return <section className="category-banner" style={{ '--banner-image': `url(${banner.image})` } as CSSProperties}><div><p className="eyebrow">CURATED FOR YOU</p><h2>{banner.title}</h2><p>{banner.copy}</p></div></section>
}
