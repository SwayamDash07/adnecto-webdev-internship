import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth-guard";
import { logoutAdminAction } from "@/app/admin/login/actions";
import { adminPath } from "@/lib/admin-route";
import AdminSessionControls from "./AdminSessionControls";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  return (
    <div className="admin-shell">
      {admin && (
        <nav className="admin-nav">
          <Link href={adminPath("/dashboard")} className="admin-brand">Threadline Control</Link>
          <div className="admin-nav-tools">
            <div className="admin-nav-links">
            <Link href={adminPath("/dashboard")}>Dashboard</Link>
            <Link href={adminPath("/users")}>Users</Link>
            <Link href={adminPath("/flags")}>Flags</Link>
            <Link href={adminPath("/admins")}>Admins</Link>
            </div>
            <AdminSessionControls sessionStartedAt={new Date(admin.sessionStartedAt).toISOString()} lastActiveAt={new Date(admin.lastActiveAt).toISOString()} />
          </div>
        </nav>
      )}
      <main className={admin ? "admin-main" : ""}>{children}</main>
    </div>
  );
}
