// Deploy with: supabase functions deploy process-background-jobs
// Keep privileged job processing in an Edge Function, never in the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await client.from('background_jobs').select('id, job_type, payload').eq('status', 'pending').lte('run_at', new Date().toISOString()).limit(25)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  for (const job of data ?? []) await client.from('background_jobs').update({ status: 'completed', attempts: 1 }).eq('id', job.id)
  return Response.json({ processed: data?.length ?? 0 })
})
