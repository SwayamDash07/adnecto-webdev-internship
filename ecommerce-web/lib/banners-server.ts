import { createClient } from '@supabase/supabase-js'

type Banner = { title: string; copy: string | null; image_url: string }

export async function getActiveBanner(placement: string): Promise<Banner | null> {
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const { data } = await client.from('banners').select('title,copy,image_url').eq('placement', placement).eq('active', true).order('sort_order').order('id').limit(1).maybeSingle()
    return data as Banner | null
  } catch { return null }
}
