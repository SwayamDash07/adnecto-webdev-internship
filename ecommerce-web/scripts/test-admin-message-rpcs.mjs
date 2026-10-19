/**
 * Checks the Messages RPC surface with an admin and a store-manager session.
 * Set ADMIN_ACCESS_TOKEN and STORE_MANAGER_ACCESS_TOKEN to Supabase access tokens.
 * The optional mark-all-read RPC is skipped unless TEST_MARK_ALL_READ=1 because
 * it intentionally marks every unread message on that account as read.
 */
import { readFile } from 'node:fs/promises'

function readEnvFile(source, key) {
  const match = source.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
}

let envFile = ''
try { envFile = await readFile('.env.local', 'utf8') } catch {}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvFile(envFile, 'NEXT_PUBLIC_SUPABASE_URL')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? readEnvFile(envFile, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const sessions = [
  { role: 'admin', token: process.env.ADMIN_ACCESS_TOKEN },
  { role: 'store manager', token: process.env.STORE_MANAGER_ACCESS_TOKEN },
]

if (!supabaseUrl || !anonKey || sessions.some(session => !session.token)) {
  console.error('Set Supabase URL/key in .env.local and provide ADMIN_ACCESS_TOKEN and STORE_MANAGER_ACCESS_TOKEN.')
  process.exit(2)
}

const checks = [
  { name: 'get_my_admin_profile', args: {}, admin: 'ok', manager: 'ok' },
  { name: 'staff_list_admin_messages', args: {}, admin: 'ok', manager: 'ok' },
  { name: 'staff_update_admin_message', args: { p_recipient_row_id: -1, p_action: 'read', p_done_note: null }, admin: 'reachable', manager: 'reachable' },
  { name: 'admin_list_sent_staff_messages', args: {}, admin: 'ok', manager: 'denied' },
  { name: 'admin_list_staff_message_targets', args: {}, admin: 'ok', manager: 'denied' },
  { name: 'admin_send_staff_message', args: { p_type: '', p_title: '', p_body: '', p_recipient_ids: [] }, admin: 'reachable', manager: 'denied' },
  { name: 'admin_remind_staff_message', args: { p_message_id: -1 }, admin: 'reachable', manager: 'denied' },
  { name: 'admin_staff_message_recipients', args: { p_message_id: -1 }, admin: 'reachable', manager: 'denied' },
]
if (process.env.TEST_MARK_ALL_READ === '1') {
  checks.push({ name: 'staff_mark_all_admin_messages_read', args: {}, admin: 'ok', manager: 'ok' })
} else {
  console.log('SKIP staff_mark_all_admin_messages_read (set TEST_MARK_ALL_READ=1; it changes unread state)')
}

let failures = 0
for (const session of sessions) {
  console.log(`\n${session.role}:`)
  for (const check of checks) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${check.name}`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(check.args),
      })
      const payload = await response.json().catch(() => null)
      const code = payload?.code
      const message = String(payload?.message ?? '')
      const expectation = check[session.role === 'admin' ? 'admin' : 'manager']
      const isMissing = response.status === 404 && code === 'PGRST202'
      const passed = expectation === 'ok'
        ? response.ok
        : expectation === 'denied'
          ? !isMissing && !response.ok && (code === '42501' || /permission|required|forbidden/i.test(message))
          : !isMissing
      if (!passed) failures++
      const result = isMissing ? `MISSING (${message || code})` : passed ? 'OK' : `FAIL HTTP ${response.status} ${message || code || ''}`
      console.log(`${passed ? 'PASS' : 'FAIL'} ${check.name}: ${result}`)
    } catch (error) {
      failures++
      console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

console.log(`\n${failures ? `${failures} check(s) failed.` : 'All requested RPC checks passed.'}`)
process.exitCode = failures ? 1 : 0
