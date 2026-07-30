"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { confirmAndRefreshAdminSessionAction, logoutAdminAction } from "./login/actions";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function AdminSessionControls({ sessionStartedAt, lastActiveAt }: { sessionStartedAt: string; lastActiveAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [idleExpiresAt, setIdleExpiresAt] = useState(() => new Date(lastActiveAt).getTime() + IDLE_TIMEOUT_MS);
  const [absoluteExpiresAt] = useState(() => new Date(sessionStartedAt).getTime() + ABSOLUTE_SESSION_LIFETIME_MS);
  const [isPending, startTransition] = useTransition();
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const remaining = Math.min(idleExpiresAt - now, absoluteExpiresAt - now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining <= 0) window.location.assign("/threadline-ops-9f3c7a2d8e1b4c6f/login");
  }, [remaining]);

  function refreshSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await confirmAndRefreshAdminSessionAction(formData);
      if (!result.ok) {
        if (result.error === "session") window.location.assign("/threadline-ops-9f3c7a2d8e1b4c6f/login");
        else setRefreshError(true);
        return;
      }
      setIdleExpiresAt(result.idleExpiresAt);
      setNow(Date.now());
      setRefreshError(false);
      setRefreshOpen(false);
    });
  }

  return <>
    <div className="admin-session-controls"><span className="admin-session-timer" aria-live="polite">Session {formatRemaining(remaining)}</span><button type="button" className="admin-button secondary small" onClick={() => { setRefreshError(false); setRefreshOpen(true); }}>Refresh</button><form action={logoutAdminAction}><button type="submit" className="admin-button secondary small">End session</button></form></div>
    {refreshOpen && <div className="admin-dialog-backdrop" role="dialog" aria-modal="true"><form className="admin-dialog admin-form admin-session-refresh-dialog" onSubmit={refreshSession}><div className="admin-section-heading"><h2>Refresh session</h2><button type="button" className="admin-icon-button" onClick={() => setRefreshOpen(false)} aria-label="Close">×</button></div><p className="admin-muted">Enter your admin password to refresh this session.</p><div className="admin-field"><label htmlFor="admin-session-refresh-password">Password</label><input id="admin-session-refresh-password" name="password" type="password" className="admin-input" required autoFocus /></div>{refreshError && <div className="admin-alert">Your admin password was incorrect.</div>}<div className="admin-form-actions"><button className="admin-button" disabled={isPending}>{isPending ? "Refreshing" : "Confirm refresh"}</button><button type="button" className="admin-button secondary" onClick={() => setRefreshOpen(false)}>Cancel</button></div></form></div>}
  </>;
}
