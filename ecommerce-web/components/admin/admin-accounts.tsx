'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { MAIN_ADMIN_ROLE, MANAGER_ROLE, PERMISSIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS, type Role } from '@/lib/permission-definitions'

type Admin = { id: string; email: string; full_name: string; role_name: string; is_current?: boolean }
type FieldErrors = Partial<Record<'fullName' | 'email' | 'password', string>>
const roleLabel = (role: string) => ROLE_LABELS[role as Role] ?? role.replaceAll('_', ' ')

export function AdminAccounts({ currentRole }: { currentRole: string }) {
  const isMainAdmin = currentRole === MAIN_ADMIN_ROLE
  const roles = ROLE_KEYS.filter(role => role !== MAIN_ADMIN_ROLE && (isMainAdmin || role !== 'admin'))
  const [admins, setAdmins] = useState<Admin[]>([])
  const [form, setForm] = useState({ email: '', fullName: '', password: '', role: MANAGER_ROLE })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Admin | null>(null)
  const [showRolePermissions, setShowRolePermissions] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [editForm, setEditForm] = useState({ username: '', password: '' })
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const availableRoles = ROLE_KEYS
  const filteredAdmins = admins.filter(admin => (roleFilter === 'all' || admin.role_name === roleFilter) && (!searchTerm || `${admin.full_name} ${admin.email}`.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase())))

  async function load() {
    const response = await fetch('/api/admin/admins', { cache: 'no-store' })
    if (response.ok) setAdmins(await response.json() as Admin[])
    else setError((await response.json()).error || 'Unable to load administrator accounts.')
  }

  useEffect(() => { void load() }, [])

  function validateForm() {
    const errors: FieldErrors = {}
    if (!form.fullName.trim()) errors.fullName = 'Enter the administrator’s full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function createAdmin() {
    setMessage(''); setError('')
    if (!validateForm()) return
    setAdding(true)
    try {
      const response = await fetch('/api/admin/admins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Unable to create administrator.'); return }
      setForm({ email: '', fullName: '', password: '', role: MANAGER_ROLE })
      setFieldErrors({})
      setMessage('Administrator added.')
      await load()
    } catch { setError('Unable to create administrator. Check your connection and try again.') }
    finally { setAdding(false) }
  }

  function openEdit(admin: Admin) {
    setEditForm({ username: admin.full_name, password: '' })
    setEditError('')
    setEditingAdmin(admin)
  }

  async function saveAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingAdmin) return
    if (!editForm.username.trim()) { setEditError('Username is required.'); return }
    if (editForm.password && editForm.password.length < 8) { setEditError('Password must be at least 8 characters.'); return }
    setSavingEdit(true); setEditError('')
    try {
      const response = await fetch('/api/admin/admins', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: editingAdmin.id, fullName: editForm.username.trim(), role: editingAdmin.role_name, password: editForm.password || undefined }) })
      const result = await response.json()
      if (!response.ok) { setEditError(result.error || 'Unable to update administrator.'); return }
      setEditingAdmin(null)
      setMessage('Administrator updated.')
      await load()
    } catch { setEditError('Unable to update administrator. Check your connection and try again.') }
    finally { setSavingEdit(false) }
  }

  async function removeAdmin() {
    if (!pendingDelete) return
    setDeleting(true); setError('')
    try {
      const response = await fetch(`/api/admin/admins?id=${encodeURIComponent(pendingDelete.id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Unable to delete administrator.'); return }
      setPendingDelete(null)
      setMessage('Administrator deleted.')
      await load()
    } catch { setError('Unable to delete administrator. Check your connection and try again.') }
    finally { setDeleting(false) }
  }

  return <section className="panel admin-accounts">
    <div className="panel-heading"><div><h2>Add accounts</h2><p>{isMainAdmin ? 'Create admins and staff accounts, update access, or remove accounts.' : 'Create staff accounts and update their details. Only the main administrator can add or remove admins.'}</p></div></div>
    <div className="admin-accounts-form">
      <div className="admin-form-grid">
        <label>Full name<input autoComplete="name" placeholder="Jane Doe" value={form.fullName} aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'admin-name-error' : undefined} onChange={event => setForm({ ...form, fullName: event.target.value })} />{fieldErrors.fullName && <small className="admin-field-error" id="admin-name-error">{fieldErrors.fullName}</small>}</label>
        <label>Email<input type="email" autoComplete="email" placeholder="jane@store.com" value={form.email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined} onChange={event => setForm({ ...form, email: event.target.value })} />{fieldErrors.email && <small className="admin-field-error" id="admin-email-error">{fieldErrors.email}</small>}</label>
        <label>Temporary password<input type="password" autoComplete="new-password" placeholder="Min. 8 characters" value={form.password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined} onChange={event => setForm({ ...form, password: event.target.value })} />{fieldErrors.password && <small className="admin-field-error" id="admin-password-error">{fieldErrors.password}</small>}</label>
        <label>Role<span className="admin-select-wrap"><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as Role })}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></span></label>
      </div>
      <button className="primary-button admin-add-button" disabled={adding} onClick={() => void createAdmin()}>{adding ? 'Adding administrator…' : 'Add account'}</button>
    </div>
    {message && <p className="success-message" role="status">{message}</p>}
    {error && <p className="low-stock" role="alert">{error}</p>}
    <div className="admin-list-section">
      <div className="admin-list-heading"><h3>Current accounts</h3><div className="admin-list-tools"><form className="admin-account-search" role="search" onSubmit={event => { event.preventDefault(); setSearchTerm(searchDraft.trim()) }}><input type="search" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Search name or email" aria-label="Search people by name or email" /><button type="submit"><Search size={15} aria-hidden="true" />Search</button></form><label className="admin-role-filter">Filter by role<span className="admin-select-wrap"><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filter administrators by role"><option value="all">All roles</option>{availableRoles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></span></label></div></div>
      {filteredAdmins.length ? <div className="admin-list" role="table" aria-label="Current administrators">
        <div className="admin-list-header" role="row"><span role="columnheader">Name</span><span role="columnheader">Email</span><span role="columnheader">Role</span><span role="columnheader">Actions</span></div>
        {filteredAdmins.map(admin => <div className="admin-row" role="row" key={admin.id}>
          <strong className="admin-name" role="cell">{admin.full_name || 'Unnamed admin'}</strong>
          <span className="admin-email" role="cell" title={admin.email}>{admin.email}</span>
          <span className={`admin-role-badge ${admin.role_name === MAIN_ADMIN_ROLE ? 'super-admin' : ''}`} role="cell">{roleLabel(admin.role_name)}</span>
          <div className="admin-actions" role="cell"><button type="button" className="secondary-button" disabled={!isMainAdmin && (admin.role_name === MAIN_ADMIN_ROLE || (admin.role_name === 'admin' && !admin.is_current))} title={!isMainAdmin && (admin.role_name === MAIN_ADMIN_ROLE || (admin.role_name === 'admin' && !admin.is_current)) ? 'Only the main administrator can edit another admin account' : undefined} onClick={() => openEdit(admin)}>Edit</button>{isMainAdmin && <button type="button" className="admin-delete-button" disabled={admin.role_name === MAIN_ADMIN_ROLE || admin.is_current} title={admin.role_name === MAIN_ADMIN_ROLE ? 'You cannot delete the main administrator' : admin.is_current ? 'You cannot delete your own account' : undefined} onClick={() => setPendingDelete(admin)}>Delete</button>}</div>
        </div>)}
      </div> : null}
      {!filteredAdmins.length && (admins.length ? <div className="admin-empty-state"><strong>{searchTerm ? 'No people match your search' : 'No administrators with this role'}</strong><span>{searchTerm ? 'Try another name or email address.' : 'Choose another role to see matching accounts.'}</span></div> : <div className="admin-empty-state"><strong>No other administrator accounts</strong><span>Add an administrator using the form above.</span></div>)}
    </div>
    <section className="role-permissions"><h3>What can each role do?</h3>{showRolePermissions && <div className="role-permissions-scroll" id="role-permissions-table"><table><thead><tr><th>Permission</th>{(Object.keys(ROLE_PERMISSIONS) as Role[]).map(role => <th key={role}>{roleLabel(role)}</th>)}</tr></thead><tbody>{PERMISSIONS.map(permission => <tr key={permission}><th scope="row">{permission.replaceAll(':', ' · ').replaceAll('_', ' ')}</th>{(Object.keys(ROLE_PERMISSIONS) as Role[]).map(role => <td key={role}>{ROLE_PERMISSIONS[role].includes(permission) ? '✓' : '—'}</td>)}</tr>)}</tbody></table></div>}<button type="button" className="role-permissions-toggle" aria-expanded={showRolePermissions} aria-controls="role-permissions-table" onClick={() => setShowRolePermissions(value => !value)}>{showRolePermissions ? <>Show fewer role permissions <ChevronUp size={16} aria-hidden="true" /></> : <>Learn more about each roles <ChevronDown size={16} aria-hidden="true" /></>}</button></section>
    {pendingDelete && <div className="admin-delete-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null) }}>
      <section className="admin-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-delete-title" aria-describedby="admin-delete-description">
        <h3 id="admin-delete-title">Delete administrator?</h3><p id="admin-delete-description">Delete <strong>{pendingDelete.email}</strong>? This will disable their login.</p>
        <div><button type="button" className="secondary-button" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button><button type="button" className="admin-delete-button" disabled={deleting} onClick={() => void removeAdmin()}>{deleting ? 'Deleting…' : 'Delete administrator'}</button></div>
      </section>
    </div>}
    {editingAdmin && <div className="admin-delete-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !savingEdit) setEditingAdmin(null) }}>
      <form className="admin-edit-dialog" role="dialog" aria-modal="true" onSubmit={event => void saveAdmin(event)} aria-labelledby="admin-edit-title">
        <h3 id="admin-edit-title">Edit administrator</h3>
        <p>Update the username or set a new password for <strong>{editingAdmin.email}</strong>.</p>
        <label>Username<input autoFocus autoComplete="username" value={editForm.username} aria-invalid={Boolean(editError && !editForm.username.trim())} onChange={event => setEditForm({ ...editForm, username: event.target.value })} /></label>
        <label>New password <span>(leave blank to keep current)</span><input type="password" autoComplete="new-password" placeholder="Min. 8 characters" value={editForm.password} onChange={event => setEditForm({ ...editForm, password: event.target.value })} /></label>
        {editError && <p className="admin-edit-error" role="alert">{editError}</p>}
        <div><button type="button" className="secondary-button" disabled={savingEdit} onClick={() => setEditingAdmin(null)}>Cancel</button><button type="submit" className="primary-button" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>}
  </section>
}
