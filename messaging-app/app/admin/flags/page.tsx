import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import Flag from "@/models/Flag";
import { banFromFlagAction, issueWarningAction, reopenFlagAction, reviewFlagAction } from "./actions";
import { adminPath } from "@/lib/admin-route";
import AutoRefresh from "./AutoRefresh";

export default async function AdminFlagsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  await connectDB();
  const [flags, resolvedFlags] = await Promise.all([
    Flag.find({ reviewed: false }).populate("sender", "name username").populate("message", "text createdAt").sort({ createdAt: -1 }).limit(100).lean<any[]>(),
    Flag.find({ reviewed: true }).populate("sender", "name username").sort({ createdAt: -1 }).limit(100).lean<any[]>(),
  ]);

  return (
    <>
      <AutoRefresh />
      <h1 className="admin-title">Flagged messages</h1>
      <p className="admin-muted">Each entry exposes only the single message that triggered its flag.</p>
      {query.error && <div className="admin-alert">{query.error === "resolved_flag" ? "That issue is already resolved. Reopen it before taking action." : "Unable to process that flag."}</div>}
      {flags.length === 0 && <div className="admin-card admin-muted">No flagged messages.</div>}
      {flags.map((flag: any) => (
        <article key={flag._id} className="admin-card">
          <div className="admin-actions" style={{ justifyContent: "space-between" }}><div><strong>{flag.sender?.name || "Unknown user"}</strong> <span className="admin-muted">@{flag.sender?.username || "unknown"}</span></div><span className="admin-badge">{flag.reviewed ? "Reviewed" : "Open"}</span></div>
          <p className="admin-muted">Matched: {flag.matchedTerms.join(", ")}</p>
          <div className="admin-message">{flag.message?.text || "Message unavailable."}</div>
          <div className="admin-flag-actions">
            <Link href={adminPath(`/users/${flag.sender?._id}`)} className="admin-button secondary">Open user</Link>
            {!flag.reviewed && (
              <form action={reviewFlagAction} className="admin-action-form">
                <input type="hidden" name="flagId" value={String(flag._id)} />
                <button className="admin-button secondary">Mark reviewed</button>
              </form>
            )}
            <form action={issueWarningAction} className="admin-warning-form">
              <input type="hidden" name="flagId" value={String(flag._id)} />
              <input type="hidden" name="userId" value={String(flag.sender?._id)} />
              <input name="reason" className="admin-input" placeholder="Warning reason" maxLength={300} />
              <button className="admin-button">Issue warning</button>
            </form>
            <form action={banFromFlagAction} className="admin-ban-form">
              <input type="hidden" name="flagId" value={String(flag._id)} />
              <input type="hidden" name="userId" value={String(flag.sender?._id)} />
              <input name="days" type="number" min="1" max="3650" defaultValue="7" className="admin-input admin-days-input" />
              <button name="mode" value="timed" className="admin-button danger">Ban days</button>
              <button name="mode" value="permanent" className="admin-button danger">Permanent ban</button>
            </form>
          </div>
        </article>
      ))}
      <section className="admin-card admin-resolved-section">
        <div className="admin-actions" style={{ justifyContent: "space-between" }}>
          <div><h2 style={{ margin: 0 }}>Resolved issues</h2><p className="admin-muted">Resolved issues are kept here and have no moderation actions.</p></div>
          <span className="admin-badge">{resolvedFlags.length}</span>
        </div>
        {resolvedFlags.length === 0 ? <p className="admin-muted">No resolved issues yet.</p> : resolvedFlags.map((flag: any) => (
          <div key={flag._id} className="admin-resolved-row">
            <div><strong>{flag.sender?.name || "Unknown user"}</strong><div className="admin-muted">Matched: {(flag.matchedTerms || []).join(", ")}</div></div>
            <form action={reopenFlagAction}><input type="hidden" name="flagId" value={String(flag._id)} /><button className="admin-button secondary">Reopen issue</button></form>
          </div>
        ))}
      </section>
    </>
  );
}
