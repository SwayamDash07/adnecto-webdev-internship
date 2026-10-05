'use client'

import { AdminShell } from './admin-shell'
import { useBannerManager } from '@/hooks/use-banner-manager'
import { BannerEditor } from './banners/banner-editor'
import { BannerLibrary } from './banners/banner-library'

export function BannerManager() {
  const manager = useBannerManager()
  return <AdminShell title="Banner management" description="Create poster-first promotions and place them where shoppers will see them."><div className="banner-manager"><BannerEditor form={manager.form} editing={manager.editing} poster={manager.poster} posterPreview={manager.posterPreview} error={manager.error} message={manager.message} saving={manager.saving} updateForm={manager.updateForm} choosePoster={manager.choosePoster} replacePoster={manager.replacePoster} resetForm={manager.resetForm} save={() => void manager.save()} /><BannerLibrary banners={manager.banners} load={manager.load} edit={manager.edit} /></div></AdminShell>
}
