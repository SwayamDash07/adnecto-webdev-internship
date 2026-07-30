import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import { adminPath } from "@/lib/admin-route";
import { deleteAdminAction } from "../../actions";

export default async function DeleteAdminPage({ params }: { params: Promise<{ adminId: string }> }) {
  const currentAdmin = await requireAdmin();
  if (currentAdmin.createdBy) return <><Link href={adminPath("/admins")} className="admin-muted">← Back to admins</Link><div className="admin-alert">Only the main admin can remove another admin.</div></>;
  const { adminId } = await params;
  await connectDB();
  const targetAdmin = await Admin.findOne({ _id: adminId, createdBy: { $ne: null } }).select("username").lean<any>();
  if (!targetAdmin) notFound();
  return <><Link href={adminPath("/admins")} className="admin-muted">← Back to admins</Link><h1 className="admin-title" style={{ marginTop: 18 }}>Remove admin</h1><p className="admin-muted">You are removing @{targetAdmin.username}. This cannot be undone.</p><form action={deleteAdminAction} className="admin-card admin-form admin-narrow-form admin-danger-card"><input type="hidden" name="adminId" value={String(targetAdmin._id)} /><div className="admin-form-actions"><button className="admin-button danger">Confirm remove</button><Link href={adminPath("/admins")} className="admin-button secondary">Cancel</Link></div></form></>;
}

