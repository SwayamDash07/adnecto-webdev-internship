import { createClient } from '@supabase/supabase-js'

function readHidden(prompt) {
  const input = process.stdin
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this script in an interactive terminal so the password can be entered privately.')
  }

  input.setEncoding('utf8')
  input.setRawMode(true)
  input.resume()
  process.stdout.write(prompt)

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = (error) => {
      input.off('data', onData)
      input.setRawMode(false)
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Cancelled.'))
        if (character === '\r' || character === '\n') return finish()
        if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        if (character >= ' ') {
          value += character
          process.stdout.write('*')
        }
      }
    }
    input.on('data', onData)
  })
}

const userId = process.argv[2]
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? '')) {
  console.error('Usage: node --env-file=.env.local scripts/reset-supabase-user-password.mjs USER_ID')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.')
  process.exit(1)
}

try {
  const password = await readHidden('New password (input is hidden): ')
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
  const confirmation = await readHidden('Confirm new password (input is hidden): ')
  if (password !== confirmation) throw new Error('The passwords did not match.')

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase.auth.admin.updateUserById(userId, { password })
  if (error) throw error
  console.log('Password updated. Sign in with the new password.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Password update failed.')
  process.exitCode = 1
}
