import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Flag from "@/models/Flag";
import Admin from "@/models/Admin";
import { adminPath } from "@/lib/admin-route";
import Appeal from "@/models/Appeal";
import AutoRefresh from "./AutoRefresh";
import { reviewAppealAction } from "./actions";

export default async function AdminDashboardPage() {
  await requireAdmin();
  await connectDB();
  const [users, flags, openFlags, admins, resolvedFlags, appeals] = await Promise.all([
    User.countDocuments(),
    Flag.countDocuments(),
    Flag.countDocuments({ reviewed: false }),
    Admin.countDocuments(),
    Flag.find({ reviewed: true }).populate("sender", "name username").sort({ createdAt: -1 }).limit(8).lean<any[]>(),
    Appeal.find({ status: "pending" }).populate("user", "name username").populate("notice", "type reason message").sort({ createdAt: -1 }).limit(8).lean<any[]>(),
  ]);

  return (
    <>
      <AutoRefresh />
      <h1 className="admin-title">Moderation dashboard</h1>
      <p className="admin-muted">Platform-level controls. Conversation contents are not available here.</p>
      <div className="admin-grid">
        <div className="admin-stat">Users<strong>{users}</strong></div>
        <div className="admin-stat">Open flags<strong>{openFlags}</strong></div>
        <div className="admin-stat">All flags<strong>{flags}</strong></div>
        <div className="admin-stat">Admins<strong>{admins}</strong></div>
      </div>
      <div className="admin-card admin-actions">
        <Link href={adminPath("/users")} className="admin-button">Review users</Link>
        <Link href={adminPath("/flags")} className="admin-button secondary">Review flags</Link>
      </div>
      <div className="admin-dashboard-columns">
        <section className="admin-card">
          <div className="admin-actions" style={{ justifyContent: "space-between" }}><div><h2 style={{ margin: 0 }}>Resolved issues</h2><p className="admin-muted">Closed flags are kept out of the active queue.</p></div><span className="admin-badge">{resolvedFlags.length}</span></div>
          {resolvedFlags.length === 0 ? <p className="admin-muted">No resolved issues.</p> : resolvedFlags.map((flag: any) => <div key={flag._id} className="admin-dashboard-row"><span>{flag.sender?.name || "Unknown user"}</span><span className="admin-muted">{(flag.matchedTerms || []).join(", ")}</span></div>)}
        </section>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Appeals</h2><p className="admin-muted">Users can appeal warnings and bans from their account notice.</p>
          {appeals.length === 0 ? <p className="admin-muted">No pending appeals.</p> : appeals.map((appeal: any) => <div key={appeal._id} className="admin-appeal-row"><div><strong>{appeal.user?.name || "Unknown user"}</strong><div className="admin-muted">{appeal.notice?.type === "ban" ? "Ban" : "Warning"}: {appeal.notice?.reason || "No reason"}</div><p>{appeal.reason}</p></div><div className="admin-actions"><form action={reviewAppealAction}><input type="hidden" name="appealId" value={String(appeal._id)} /><button name="decision" value="approved" className="admin-button">Approve</button></form><form action={reviewAppealAction}><input type="hidden" name="appealId" value={String(appeal._id)} /><button name="decision" value="denied" className="admin-button danger">Deny</button></form></div></div>)}
        </section>
      </div>
    </>
  );
}
