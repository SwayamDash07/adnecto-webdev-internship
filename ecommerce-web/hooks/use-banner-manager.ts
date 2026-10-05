'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeReload } from '@/lib/use-realtime-reload'
import { blank } from '@/constants/admin-banners'
import type { Banner, BannerForm } from '@/types/admin-banner'

export function useBannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]); const [form, setForm] = useState<BannerForm>(blank); const [editing, setEditing] = useState<number | null>(null); const [poster, setPoster] = useState<File | null>(null); const [posterPreview, setPosterPreview] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false)
  async function load() { const client = createSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.rpc('admin_list_banners'); if (queryError) setError(queryError.message); else setBanners((data ?? []) as Banner[]) }
  useEffect(() => { void load() }, [])
  useRealtimeReload('admin-banners-live', ['banners'], () => { void load() })
  function updateForm<K extends keyof BannerForm>(key: K, value: BannerForm[K]) { setForm(current => ({ ...current, [key]: value })) }
  function choosePoster(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; setPoster(file); setPosterPreview(URL.createObjectURL(file)) }
  function replacePoster() { setPoster(null); setPosterPreview(''); updateForm('imageUrl', '') }
  async function uploadPoster(client: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>) { if (!poster) return form.imageUrl; const path = `banners/${crypto.randomUUID()}-${poster.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const { error: uploadError } = await client.storage.from('product-media').upload(path, poster, { upsert: false }); if (uploadError) throw new Error(`Poster upload failed: ${uploadError.message}`); return client.storage.from('product-media').getPublicUrl(path).data.publicUrl }
  async function save() { setError(''); setMessage(''); setSaving(true); try { const client = createSupabaseBrowserClient(); if (!client) return; const imageUrl = await uploadPoster(client); const { error: saveError } = await client.rpc('admin_upsert_banner', { p_banner_id: editing, p_placement: form.placement, p_title: form.title, p_copy: form.copy || null, p_image_url: imageUrl, p_active: form.active, p_sort_order: Number(form.sortOrder) }); if (saveError) throw new Error(saveError.message); setMessage(editing ? 'Poster updated.' : 'Poster published.'); resetForm(); await load() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save poster.') } finally { setSaving(false) } }
  function resetForm() { setEditing(null); setForm(blank); setPoster(null); setPosterPreview('') }
  function edit(banner: Banner) { setEditing(banner.banner_id); setForm({ placement: banner.placement, title: banner.title, copy: banner.copy ?? '', imageUrl: banner.image_url, sortOrder: String(banner.sort_order), active: banner.active }); setPoster(null); setPosterPreview(banner.image_url); setError(''); setMessage('') }
  return { banners, form, editing, poster, posterPreview, error, message, saving, load, updateForm, choosePoster, replacePoster, save, resetForm, edit }
}
