import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import Flag from "@/models/Flag";
import { adminPath } from "@/lib/admin-route";
import mongoose from "mongoose";

function formatAction(action: string) {
  return action.replaceAll("_", " ");
}

export default async function AdminControlDetailPage({ params, searchParams }: { params: { adminId: string }; searchParams: Promise<{ from?: string; to?: string; type?: string }> }) {
  const currentAdmin = await requireAdmin();
  if (currentAdmin.createdBy) redirect(adminPath("/admins"));
  if (!mongoose.Types.ObjectId.isValid(params.adminId)) notFound();

  const query = await searchParams;
  const type = ["login", "logout", "username_change", "password_change"].includes(query.type || "") ? query.type : undefined;
  const dateFilter: any = {};
  if (query.from && !Number.isNaN(Date.parse(query.from))) dateFilter.$gte = new Date(query.from);
  if (query.to && !Number.isNaN(Date.parse(query.to))) {
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  await connectDB();
  const admin = await Admin.findById(params.adminId).select("username createdBy").lean<any>();
  if (!admin) notFound();
  const eventFilter: any = { adminId: admin._id };
  if (type) eventFilter.action = type;
  if (Object.keys(dateFilter).length) eventFilter.createdAt = dateFilter;
  const [flagCount, events] = await Promise.all([
    Flag.countDocuments({ reviewedBy: admin._id }),
    AdminSession.find(eventFilter).sort({ createdAt: -1 }).limit(100).lean<any[]>(),
  ]);

  return (
    <>
      <Link href={adminPath("/admins/control")} className="admin-muted">Back to Admin Control</Link>
      <div className="admin-detail-heading"><div><h1 className="admin-title">@{admin.username}</h1>{!admin.createdBy && <p className="admin-muted">Main admin</p>}</div><span className="admin-badge">{flagCount} flags</span></div>
      <section className="admin-card admin-control-filters">
        <form className="admin-form-inline" method="get">
          <div className="admin-field"><label htmlFor="admin-control-from">From</label><input id="admin-control-from" name="from" type="date" className="admin-input" defaultValue={query.from || ""} /></div>
          <div className="admin-field"><label htmlFor="admin-control-to">To</label><input id="admin-control-to" name="to" type="date" className="admin-input" defaultValue={query.to || ""} /></div>
          <div className="admin-field"><label htmlFor="admin-control-type">Activity</label><select id="admin-control-type" name="type" className="admin-select" defaultValue={query.type || ""}><option value="">All activity</option><option value="login">Login</option><option value="logout">Logout</option><option value="username_change">Username changes</option><option value="password_change">Password changes</option></select></div>
          <button className="admin-button small">Filter</button><Link href={adminPath(`/admins/control/${params.adminId}`)} className="admin-button secondary small">Clear</Link>
        </form>
      </section>
      <section className="admin-card admin-control-card">
        <div className="admin-section-heading"><div><h2>Activity history</h2><p className="admin-muted">Showing up to the latest 100 matching events.</p></div><span className="admin-badge">{events.length} events</span></div>
        {events.length === 0 ? <p className="admin-muted">No activity matches these filters.</p> : <div className="admin-session-list">{events.map((event: any) => <div className="admin-session-row" key={String(event._id)}><span className={event.action === "logout" ? "admin-session-action logout" : "admin-session-action login"}>{formatAction(event.action)}</span><time>{new Date(event.createdAt).toLocaleString()}</time></div>)}</div>}
      </section>
    </>
  );
}
