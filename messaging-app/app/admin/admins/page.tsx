import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import { adminPath } from "@/lib/admin-route";
import { CreateAdminDialog, DeleteAdminDialog, ManageAdminDialog } from "./AdminAccountDialogs";

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const currentAdmin = await requireAdmin();
  const isSuperAdmin = !currentAdmin.createdBy;
  await connectDB();
  const admins = await Admin.find(isSuperAdmin ? {} : { _id: currentAdmin._id })
    .select("username createdBy")
    .sort({ createdAt: 1 })
    .lean<any[]>();
  const query = await searchParams;

  return (
    <>
      <h1 className="admin-title">Admin accounts</h1>
      <p className="admin-muted">{isSuperAdmin ? "Manage administrator accounts and credentials." : "Manage your own administrator credentials."}</p>
      {query.error === "exists" && <div className="admin-alert">That admin username already exists.</div>}
      {query.error === "admin_exists" && <div className="admin-alert">That admin username is already in use.</div>}
      {query.error === "not_allowed" && <div className="admin-alert">You do not have permission for that action.</div>}
      {query.error === "password" && <div className="admin-alert">Use an admin password of at least 8 characters.</div>}
      {query.error === "admin_password" && <div className="admin-alert">Use a password of at least 8 characters.</div>}
      {query.error === "admin_not_found" && <div className="admin-alert">That admin account no longer exists.</div>}
      {query.error === "invalid" && <div className="admin-alert">Use a valid username and a password of at least 8 characters.</div>}
      {query.error === "invalid_username" && <div className="admin-alert">Use a valid admin username.</div>}
      {query.error === "current_password" && <div className="admin-alert">Your current admin password was incorrect.</div>}
      {query.success === "created" && <div className="admin-success">Admin account created.</div>}
      {query.success === "deleted" && <div className="admin-success">Admin account removed.</div>}
      {query.success === "password" && <div className="admin-success">Your admin password was changed.</div>}
      {query.success === "admin_password" && <div className="admin-success">The selected admin password was changed.</div>}
      {query.success === "admin_username" && <div className="admin-success">The admin username was changed.</div>}

      <div className="admin-admins-layout">
        <section className="admin-card admin-table-wrap admin-admins-table">
          <div className="admin-section-heading">
            <div><h2>{isSuperAdmin ? "Admins" : "My admin account"}</h2><p className="admin-muted">{isSuperAdmin ? "Select an admin to manage credentials." : "Only your own account is visible here."}</p></div>
            {isSuperAdmin && <span className="admin-badge">{admins.length} admins</span>}
          </div>
          <table className="admin-table">
            <thead><tr><th>Admin</th><th>Actions</th></tr></thead>
            <tbody>{admins.map((admin: any) => {
              const adminId = String(admin._id);
              const isSelf = adminId === String(currentAdmin._id);
              return <tr key={adminId}><td><strong>@{admin.username}</strong></td><td><div className="admin-admin-row-actions"><ManageAdminDialog adminId={adminId} username={admin.username} canManage={isSuperAdmin || isSelf} isSelf={isSelf} />{isSuperAdmin && admin.createdBy && <DeleteAdminDialog adminId={adminId} username={admin.username} canDelete />}</div></td></tr>;
            })}</tbody>
          </table>
        </section>

        {isSuperAdmin && <aside className="admin-admin-actions"><CreateAdminDialog /><Link href={adminPath("/admins/control")} className="admin-card admin-link-card admin-compact-card"><span className="admin-link-card-icon">▣</span><span><strong>Admin Control</strong><small>Review activity, credential changes, and session history.</small></span></Link></aside>}
      </div>
    </>
  );
}
