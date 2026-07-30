import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import Flag from "@/models/Flag";
import { adminPath } from "@/lib/admin-route";
import AdminControlList from "./AdminControlList";

export default async function AdminControlPage() {
  const currentAdmin = await requireAdmin();
  if (currentAdmin.createdBy) redirect(adminPath("/admins"));

  await connectDB();
  const admins = await Admin.find().select("username createdBy").sort({ createdAt: 1 }).lean<any[]>();
  const controlRows = await Promise.all(admins.map(async (admin) => {
    const [flagCount, latestEvent] = await Promise.all([
      Flag.countDocuments({ reviewedBy: admin._id }),
      AdminSession.findOne({ adminId: admin._id }).sort({ createdAt: -1 }).select("action createdAt").lean<any>(),
    ]);
    return {
      id: String(admin._id),
      username: admin.username,
      isMainAdmin: !admin.createdBy,
      flagCount,
      latestActivity: latestEvent ? latestEvent.action.replaceAll("_", " ") : null,
    };
  }));

  return (
    <>
      <Link href={adminPath("/admins")} className="admin-muted">Back to admins</Link>
      <h1 className="admin-title" style={{ marginTop: 18 }}>Admin Control</h1>
      <p className="admin-muted">Select an admin to review their moderation activity, sessions, and credential changes.</p>
      <AdminControlList admins={controlRows} />
    </>
  );
}
