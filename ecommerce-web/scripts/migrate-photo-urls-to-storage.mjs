import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const bucket = 'product-media'
const staticFiles = [
  'constants/catalog.ts',
  'components/customer/category-banner.tsx',
  'components/customer/promo-ads.tsx',
]
const apply = process.argv.includes('--apply')
const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg' }
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const supabaseOrigin = new URL(supabaseUrl).origin
const staticContents = new Map(await Promise.all(staticFiles.map(async file => [file, await readFile(file, 'utf8')])))
const { data: productImages, error: productImagesError } = await supabase
  .from('product_images')
  .select('id,storage_path')
if (productImagesError) throw productImagesError
const { data: banners, error: bannersError } = await supabase
  .from('banners')
  .select('id,image_url')
if (bannersError) throw bannersError

const sources = new Map()
function canonicalUrl(value) {
  const url = new URL(value)
  return url.hostname === 'images.unsplash.com'
    ? `${url.origin}${url.pathname}`
    : url.toString()
}
function addSource(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === supabaseOrigin) return
    const key = canonicalUrl(value)
    const current = sources.get(key)
    const width = Number(url.searchParams.get('w') ?? 0)
    const currentWidth = current ? Number(new URL(current).searchParams.get('w') ?? 0) : -1
    if (!current || width > currentWidth) sources.set(key, value)
  } catch {
    // Ignore non-URL values and local paths.
  }
}

for (const row of productImages ?? []) addSource(row.storage_path)
for (const row of banners ?? []) addSource(row.image_url)
const imageUrlPattern = /https?:\/\/[^\s"'`<>]+/g
for (const text of staticContents.values()) {
  for (const match of text.matchAll(imageUrlPattern)) addSource(match[0].replace(/[),;]+$/, ''))
}

const candidates = [...sources.entries()]
console.log(`Found ${candidates.length} distinct external photo URLs.`)
console.log(`Database references: ${productImages?.length ?? 0} product images, ${banners?.length ?? 0} banners.`)
if (!apply) {
  let knownBytes = 0
  let knownSizes = 0
  const failedHeads = []
  for (let index = 0; index < candidates.length; index += 8) {
    await Promise.all(candidates.slice(index, index + 8).map(async ([, url]) => {
      try {
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
        if (!response.ok) failedHeads.push(`${response.status} ${new URL(url).hostname}${new URL(url).pathname}`)
        const size = Number(response.headers.get('content-length') ?? 0)
        if (response.ok && size > 0) {
          knownBytes += size
          knownSizes += 1
        }
      } catch {
        // Some image hosts don't support HEAD; their size is reported as unknown.
      }
    }))
  }
  console.log(`HEAD estimate: ${(knownBytes / 1048576).toFixed(2)} MiB across ${knownSizes}/${candidates.length} URLs with known sizes.`)
  if (failedHeads.length) console.log(`HEAD failures: ${failedHeads.join('; ')}`)
  console.log('Dry run only. Run with --apply to copy the photos into Supabase Storage and update the references.')
  process.exit(0)
}

const downloaded = []
let totalBytes = 0
for (const [key, url] of candidates) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Photo download failed (${response.status}) for ${new URL(url).hostname}${new URL(url).pathname}`)
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!extensionByType[contentType]) throw new Error(`Unsupported image type ${contentType || '(missing)'} from ${new URL(url).hostname}${new URL(url).pathname}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 25 * 1024 * 1024) throw new Error(`Photo exceeds the 25 MB Storage per-file limit: ${new URL(url).hostname}${new URL(url).pathname}`)
  totalBytes += bytes.length
  if (totalBytes > 512 * 1024 * 1024) throw new Error('Migration exceeds the 512 MB safety limit; no uploads have started.')
  downloaded.push({ key, url, bytes, contentType })
}
console.log(`Prepared ${downloaded.length} images (${(totalBytes / 1048576).toFixed(2)} MiB) for upload.`)

const publicUrls = new Map()
for (const image of downloaded) {
  const digest = createHash('sha256').update(image.key).digest('hex')
  const extension = extensionByType[image.contentType]
  const objectPath = `catalog/${digest}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(objectPath, image.bytes, {
    contentType: image.contentType,
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) throw error
  publicUrls.set(image.key, supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl)
}

for (const row of productImages ?? []) {
  try {
    const key = canonicalUrl(row.storage_path)
    const replacement = publicUrls.get(key)
    if (!replacement) continue
    const { error } = await supabase.from('product_images').update({ storage_path: replacement }).eq('id', row.id)
    if (error) throw error
  } catch (error) {
    console.error(`Could not update product image row ${row.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
    process.exitCode = 1
  }
}

for (const row of banners ?? []) {
  try {
    const key = canonicalUrl(row.image_url)
    const replacement = publicUrls.get(key)
    if (!replacement) continue
    const { error } = await supabase.from('banners').update({ image_url: replacement }).eq('id', row.id)
    if (error) throw error
  } catch (error) {
    console.error(`Could not update banner row ${row.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
    process.exitCode = 1
  }
}

for (const [file, original] of staticContents) {
  let updated = original
  for (const match of original.matchAll(imageUrlPattern)) {
    const value = match[0].replace(/[),;]+$/, '')
    try {
      const replacement = publicUrls.get(canonicalUrl(value))
      if (replacement) updated = updated.replaceAll(value, replacement)
    } catch {
      // Ignore non-URL values.
    }
  }
  if (updated !== original) await writeFile(path.resolve(file), updated, 'utf8')
}

console.log(`Uploaded ${publicUrls.size} unique photos to the ${bucket} bucket and updated photo references.`)
