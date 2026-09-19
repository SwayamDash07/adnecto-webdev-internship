import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'

const serviceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null
}

async function authorizeMainAdmin() {
  const profile = await getAdminProfile()
  if (!profile?.is_main_admin) return null
  return serviceClient()
}

export async function GET() {
  const client = await authorizeMainAdmin()
  if (!client) return NextResponse.json({ error: 'Only the main administrator can manage admins.' }, { status: 403 })
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
    return { id: user.id, email: user.email, full_name: profileMap.get(user.id)?.full_name || user.user_metadata?.full_name || '', role_name: roleName || 'customer' }
  }).filter(user => user.role_name !== 'customer'))
}

export async function POST(request: NextRequest) {
  const client = await authorizeMainAdmin()
  if (!client) return NextResponse.json({ error: 'Only the main administrator can manage admins.' }, { status: 403 })
  const body = await request.json() as { email?: string; password?: string; fullName?: string; role?: string }
  const allowedRoles = ['delivery_boy', 'picker', 'store_manager', 'inventory_manager', 'accountant', 'cashier']
  if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email) || !body.password || body.password.length < 8 || !body.fullName?.trim() || !body.role || !allowedRoles.includes(body.role)) return NextResponse.json({ error: 'A valid email, name, allowed staff role and a password of at least 8 characters are required.' }, { status: 400 })
  const { data, error } = await client.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true, user_metadata: { full_name: body.fullName } })
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Could not create admin.' }, { status: 400 })
  const { data: role } = await client.from('roles').select('id').eq('name', body.role).single()
  const { error: profileError } = await client.from('users').update({ full_name: body.fullName, role_id: role?.id }).eq('id', data.user.id)
  if (profileError) { await client.auth.admin.deleteUser(data.user.id); return NextResponse.json({ error: profileError.message }, { status: 400 }) }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const profile = await getAdminProfile()
  const client = await authorizeMainAdmin()
  if (!client || !profile) return NextResponse.json({ error: 'Only the main administrator can manage admins.' }, { status: 403 })
  const body = await request.json() as { id?: string; password?: string; fullName?: string; role?: string }
  if (!body.id) return NextResponse.json({ error: 'Admin id is required.' }, { status: 400 })
  if (body.password !== undefined && body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  if (body.id === profile.id && body.role && body.role !== 'super_admin') return NextResponse.json({ error: 'The main administrator cannot lose the main role.' }, { status: 400 })
  const { error: authError } = body.password ? await client.auth.admin.updateUserById(body.id, { password: body.password }) : { error: null }
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  const updates: { full_name?: string; role_id?: number } = {}
  if (body.fullName) updates.full_name = body.fullName
  if (body.role) { const { data: role } = await client.from('roles').select('id').eq('name', body.role).single(); if (!role) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 }); updates.role_id = role.id }
  if (Object.keys(updates).length) { const { error } = await client.from('users').update(updates).eq('id', body.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const profile = await getAdminProfile()
  const client = await authorizeMainAdmin()
  if (!client || !profile) return NextResponse.json({ error: 'Only the main administrator can manage admins.' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id || id === profile.id) return NextResponse.json({ error: 'You cannot delete the main administrator.' }, { status: 400 })
  const { error } = await client.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
