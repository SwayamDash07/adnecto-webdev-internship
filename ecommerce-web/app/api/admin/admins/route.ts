import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { requirePermission } from '@/lib/permissions'
import { MAIN_ADMIN_ROLE, ROLE_KEYS, type Role } from '@/lib/permission-definitions'

const serviceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null
}

async function authorizeTeamManager() {
  try {
    const profile = await requirePermission('team:manage')
    return { profile, client: serviceClient() }
  } catch { return null }
}

export async function GET() {
  let profile
  try { profile = await requirePermission('team:manage') } catch { return NextResponse.json({ error: 'You do not have permission to manage accounts.' }, { status: 403 }) }
  const client = serviceClient()
  if (!client) return NextResponse.json({ error: 'Administrator service is unavailable.' }, { status: 500 })
  const { data: authUsers, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = authUsers.users.map(user => user.id)
  const { data: profiles } = ids.length ? await client.from('users').select('id,full_name,role_id,roles(name)').in('id', ids) : { data: [] }
  const profileMap = new Map((profiles ?? []).map(profile => {
    const row = profile as unknown as { id: string; full_name: string; roles: { name: string }[] | { name: string } | null }
    return [row.id, row]
  }))
  return NextResponse.json(authUsers.users.map(user => {
    const roles = profileMap.get(user.id)?.roles
    const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name
    return { id: user.id, email: user.email, full_name: profileMap.get(user.id)?.full_name || user.user_metadata?.full_name || '', role_name: roleName || 'customer', is_current: user.id === profile.id }
  }).filter(user => user.role_name !== 'customer'))
}

export async function POST(request: NextRequest) {
  const auth = await authorizeTeamManager()
  if (!auth?.client) return NextResponse.json({ error: 'You do not have permission to manage accounts.' }, { status: 403 })
  const client = auth.client
  const body = await request.json() as { email?: string; password?: string; fullName?: string; role?: string }
  const allowedRoles = ROLE_KEYS.filter(role => role !== MAIN_ADMIN_ROLE && (auth.profile.role_name === MAIN_ADMIN_ROLE || role !== 'admin'))
  if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email) || !body.password || body.password.length < 8 || !body.fullName?.trim() || !body.role || !allowedRoles.includes(body.role as Role)) return NextResponse.json({ error: 'A valid email, name, allowed staff role and a password of at least 8 characters are required.' }, { status: 400 })
  const { data, error } = await client.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { full_name: body.fullName } })
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Could not create admin.' }, { status: 400 })
  const { data: role } = await client.from('roles').select('id').eq('name', body.role).single()
  const { error: profileError } = await client.from('users').update({ full_name: body.fullName, role_id: role?.id }).eq('id', data.user.id)
  if (profileError) { await client.auth.admin.deleteUser(data.user.id); return NextResponse.json({ error: profileError.message }, { status: 400 }) }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeTeamManager()
  if (!auth?.client) return NextResponse.json({ error: 'You do not have permission to manage accounts.' }, { status: 403 })
  const { profile } = auth
  const client = auth.client
  const body = await request.json() as { id?: string; password?: string; fullName?: string; role?: string }
  if (!body.id) return NextResponse.json({ error: 'Admin id is required.' }, { status: 400 })
  if (body.role && !ROLE_KEYS.includes(body.role as typeof ROLE_KEYS[number])) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  if (profile.role_name !== MAIN_ADMIN_ROLE) {
    const { data: target } = await client.from('users').select('role_id,roles(name)').eq('id', body.id).single()
    const targetRole = target?.roles as unknown as { name?: string } | null
    const editingOwnAdminAccount = body.id === profile.id && targetRole?.name === 'admin'
    if (body.role === MAIN_ADMIN_ROLE || (body.role === 'admin' && !editingOwnAdminAccount)) return NextResponse.json({ error: 'Only the main administrator can assign an admin role.' }, { status: 403 })
    if (targetRole?.name === MAIN_ADMIN_ROLE || (targetRole?.name === 'admin' && !editingOwnAdminAccount)) return NextResponse.json({ error: 'Only the main administrator can edit another admin account.' }, { status: 403 })
  }
  if (body.password !== undefined && body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  if (body.id === profile.id && body.role && body.role !== profile.role_name) return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 })
  if (body.role === MAIN_ADMIN_ROLE && body.id !== profile.id) {
    const { data: existingMainRole } = await client.from('roles').select('id').eq('name', MAIN_ADMIN_ROLE).single()
    const { data: target } = await client.from('users').select('role_id').eq('id', body.id).single()
    if (!existingMainRole || target?.role_id !== existingMainRole.id) return NextResponse.json({ error: 'A second main administrator cannot be assigned.' }, { status: 400 })
  }
  if (body.role && body.role !== MAIN_ADMIN_ROLE) {
    const { count } = await client.from('users').select('id', { count: 'exact', head: true }).eq('role_id', (await client.from('roles').select('id').eq('name', MAIN_ADMIN_ROLE).single()).data?.id)
    const { data: target } = await client.from('users').select('role_id,roles(name)').eq('id', body.id).single()
    const targetRole = target?.roles as unknown as { name?: string } | null
    if (targetRole?.name === MAIN_ADMIN_ROLE && (count ?? 0) <= 1) return NextResponse.json({ error: 'The last main administrator cannot be demoted.' }, { status: 400 })
  }
  const { error: authError } = body.password ? await client.auth.admin.updateUserById(body.id, { password: body.password }) : { error: null }
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  const updates: { full_name?: string; role_id?: number } = {}
  if (body.fullName) updates.full_name = body.fullName
  if (body.role) { const { data: role } = await client.from('roles').select('id').eq('name', body.role).single(); if (!role) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 }); updates.role_id = role.id }
  if (Object.keys(updates).length) { const { error } = await client.from('users').update(updates).eq('id', body.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeTeamManager()
  if (!auth?.client) return NextResponse.json({ error: 'You do not have permission to manage accounts.' }, { status: 403 })
  if (auth.profile.role_name !== MAIN_ADMIN_ROLE) return NextResponse.json({ error: 'Only the main administrator can remove accounts.' }, { status: 403 })
  const { profile } = auth
  const client = auth.client
  const id = new URL(request.url).searchParams.get('id')
  if (!id || id === profile.id) return NextResponse.json({ error: 'You cannot delete the main administrator.' }, { status: 400 })
  const { data: superRole } = await client.from('roles').select('id').eq('name', MAIN_ADMIN_ROLE).single()
  const { data: target } = await client.from('users').select('role_id').eq('id', id).single()
  if (superRole && target?.role_id === superRole.id) {
    const { count } = await client.from('users').select('id', { count: 'exact', head: true }).eq('role_id', superRole.id)
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'The last main administrator cannot be deleted.' }, { status: 400 })
  }
  const { error } = await client.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
