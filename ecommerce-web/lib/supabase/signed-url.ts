import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/** Generate private storage URLs only on the server; never expose the service role key. */
export async function createPrivateFileUrl(bucket: string, path: string, expiresIn = 300) {
  const client = createSupabaseAdminClient()
  if (!client) return null
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn)
  return error ? null : data.signedUrl
}
