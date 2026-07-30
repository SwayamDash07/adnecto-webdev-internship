import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { adminPath } from "@/lib/admin-route";
import UserDetailsEditor from "./UserDetailsEditor";

export default async function EditUserDetailsPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAdmin();
  const { userId } = await params;
  const query = await searchParams;
  await connectDB();
  const user = await User.findById(userId).select("name username email location hobbies interests musicTaste movieTaste favoriteFood bio personalNote avatarUrl createdAt").lean<any>();
  if (!user) notFound();
  return (<><Link href={adminPath(`/users/${userId}`)} className="admin-muted">Back to user</Link><h1 className="admin-title" style={{ marginTop: 18 }}>Change user details</h1><p className="admin-muted">Select the pencil beside any detail to edit it. Save or cancel each change independently.</p>{query.error && <div className="admin-alert">{query.error === "duplicate" ? "That username or email is already in use." : query.error === "password" ? "Password must be at least 8 characters." : query.error === "invalid_email" ? "Enter a valid email address." : query.error === "invalid_username" ? "Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens." : "This field is required."}</div>}{query.success && <div className="admin-success">User detail updated.</div>}<UserDetailsEditor user={JSON.parse(JSON.stringify(user))} /></>);
}
