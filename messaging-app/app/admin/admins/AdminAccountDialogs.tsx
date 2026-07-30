"use client";

import { useState } from "react";
import { changeAdminUsernameAction, changeManagedAdminPasswordAction, createAdminAction, deleteAdminAction } from "./actions";

type ManageMode = "options" | "username" | "password";

export function ManageAdminDialog({ adminId, username, canManage, isSelf }: { adminId: string; username: string; canManage: boolean; isSelf: boolean }) {
  const [mode, setMode] = useState<ManageMode>("options");
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    setMode("options");
  }

  return <>
    <button type="button" className="admin-button secondary" onClick={() => setOpen(true)} disabled={!canManage}>Manage</button>
    {open && <div className="admin-dialog-backdrop" role="dialog" aria-modal="true"><div className="admin-dialog admin-form">
      <div className="admin-section-heading"><h2>{mode === "options" ? "Manage @" + username : mode === "username" ? "Change username" : "Change password"}</h2><button type="button" className="admin-icon-button" onClick={close} aria-label="Close">×</button></div>
      {mode === "options" && <div className="admin-modal-options"><button type="button" className="admin-button secondary" onClick={() => setMode("username")}>Change Username</button><button type="button" className="admin-button secondary" onClick={() => setMode("password")}>Change Password</button></div>}
      {mode === "username" && <form action={changeAdminUsernameAction} onSubmit={close} className="admin-form"><input type="hidden" name="adminId" value={adminId} /><div className="admin-field"><label htmlFor={"admin-username-" + adminId}>Username</label><input id={"admin-username-" + adminId} name="username" className="admin-input" defaultValue={username} minLength={3} maxLength={32} required autoFocus /></div><div className="admin-form-actions"><button type="button" className="admin-button secondary" onClick={() => setMode("options")}>Back</button><button className="admin-button">Save username</button></div></form>}
      {mode === "password" && <form action={changeManagedAdminPasswordAction} onSubmit={close} className="admin-form"><input type="hidden" name="adminId" value={adminId} />{isSelf && <div className="admin-field"><label htmlFor={"admin-current-password-" + adminId}>Current password</label><input id={"admin-current-password-" + adminId} name="currentPassword" type="password" className="admin-input" required autoFocus /></div>}<div className="admin-field"><label htmlFor={"admin-new-password-" + adminId}>New password</label><input id={"admin-new-password-" + adminId} name="password" type="password" className="admin-input" minLength={8} required autoFocus={!isSelf} /></div><div className="admin-form-actions"><button type="button" className="admin-button secondary" onClick={() => setMode("options")}>Back</button><button className="admin-button">Save password</button></div></form>}
    </div></div>}
  </>;
}

export function CreateAdminDialog() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="admin-card admin-link-card admin-compact-card admin-dialog-trigger" onClick={() => setOpen(true)}><span className="admin-link-card-icon">+</span><span><strong>Add new admin</strong><small>Create a separate login for a trusted moderator.</small></span></button>
    {open && <div className="admin-dialog-backdrop" role="dialog" aria-modal="true"><form action={createAdminAction} onSubmit={() => setOpen(false)} className="admin-dialog admin-form"><div className="admin-section-heading"><h2>Add new admin</h2><button type="button" className="admin-icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><div className="admin-field"><label htmlFor="new-admin-username">Username</label><input id="new-admin-username" name="username" className="admin-input" minLength={3} required autoFocus /></div><div className="admin-field"><label htmlFor="new-admin-password">Temporary password</label><input id="new-admin-password" name="password" type="password" className="admin-input" minLength={8} required /></div><div className="admin-form-actions"><button className="admin-button">Create admin</button><button type="button" className="admin-button secondary" onClick={() => setOpen(false)}>Cancel</button></div></form></div>}
  </>;
}

export function DeleteAdminDialog({ adminId, username, canDelete }: { adminId: string; username: string; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="admin-button danger" onClick={() => setOpen(true)} disabled={!canDelete}>Delete</button>
    {open && <div className="admin-dialog-backdrop" role="dialog" aria-modal="true"><div className="admin-dialog admin-form admin-danger-card"><div className="admin-section-heading"><h2>Delete admin</h2><button type="button" className="admin-icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><p className="admin-muted">Delete @{username}? This cannot be undone.</p><form action={deleteAdminAction} onSubmit={() => setOpen(false)}><input type="hidden" name="adminId" value={adminId} /><div className="admin-form-actions"><button className="admin-button danger">Confirm delete</button><button type="button" className="admin-button secondary" onClick={() => setOpen(false)}>Cancel</button></div></form></div></div>}
  </>;
}
