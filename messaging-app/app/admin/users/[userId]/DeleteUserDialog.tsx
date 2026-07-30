"use client";

import { useState } from "react";
import { deleteUserAction } from "../actions";

export default function DeleteUserDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);

  return <>
    <button type="button" className="admin-button danger" onClick={() => setOpen(true)}>Delete user permanently</button>
    {open && <div className="admin-dialog-backdrop" role="dialog" aria-modal="true"><form action={deleteUserAction} className="admin-dialog admin-form admin-danger-card"><input type="hidden" name="userId" value={userId} /><div className="admin-section-heading"><h2>Delete user</h2><button type="button" className="admin-icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button></div><p className="admin-muted">You are permanently deleting @{username} and related data. This cannot be undone.</p><div className="admin-field"><label htmlFor={`delete-user-confirmation-${userId}`}>Your current admin password</label><input id={`delete-user-confirmation-${userId}`} name="confirmationPassword" type="password" className="admin-input" required autoFocus /></div><div className="admin-form-actions"><button className="admin-button danger">Confirm delete</button><button type="button" className="admin-button secondary" onClick={() => setOpen(false)}>Cancel</button></div></form></div>}
  </>;
}
