import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getBanLabel, isUserCurrentlyBanned } from "@/lib/account-status";
import { banUserAction, deleteUserAction, issueWarningForUserAction, unbanUserAction } from "../actions";
import { adminPath } from "@/lib/admin-route";
import DeleteUserDialog from "./DeleteUserDialog";

export default async function AdminUserDetailPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAdmin();
  const { userId } = await params;
  const query = await searchParams;
  await connectDB();
  const user = await User.findById(userId).select("name username email location hobbies interests musicTaste movieTaste favoriteFood bio personalNote avatarUrl createdAt warningCount warningHistory bannedUntil bannedPermanently").lean<any>();
  if (!user) notFound();

  return (<>
    <Link href={adminPath("/users")} className="admin-muted">Back to users</Link>
    <h1 className="admin-title" style={{ marginTop: 18 }}>Manage {user.name}</h1>
    <p className="admin-muted">Edit every account detail, including the password, or take moderation action.</p>
    {query.success && query.success !== "details" && <div className="admin-success">User status updated.</div>}{query.error === "confirmation" && <div className="admin-alert">Your current admin password was incorrect.</div>}

    <div className="admin-grid"><div className="admin-stat">Current ban<strong style={{ fontSize: 18 }}>{getBanLabel(user)}</strong></div><div className="admin-stat">Warnings<strong>{user.warningCount || 0}</strong></div><div className="admin-stat">Joined<strong style={{ fontSize: 18 }}>{new Date(user.createdAt).toLocaleDateString()}</strong></div></div>

    <Link href={adminPath(`/users/${user._id}/edit`)} className="admin-card admin-link-card"><span className="admin-link-card-icon">✎</span><span><strong>Change user details</strong><small>Edit profile fields and password one at a time.</small></span><span className="admin-link-arrow">→</span></Link>

    <div className="admin-card admin-profile-summary"><h2>Profile details</h2><div className="admin-profile-grid"><div><span>Name</span><strong>{user.name}</strong></div><div><span>Username</span><strong>@{user.username}</strong></div><div><span>Email</span><strong>{user.email}</strong></div><div><span>Location</span><strong>{user.location || "Not provided"}</strong></div><div><span>Hobbies</span><strong>{(user.hobbies || []).join(", ") || "Not provided"}</strong></div><div><span>Interests</span><strong>{(user.interests || []).join(", ") || "Not provided"}</strong></div><div><span>Music</span><strong>{user.musicTaste || "Not provided"}</strong></div><div><span>Movies / shows</span><strong>{user.movieTaste || "Not provided"}</strong></div><div><span>Favorite food</span><strong>{user.favoriteFood || "Not provided"}</strong></div><div className="admin-profile-wide"><span>Bio</span><strong>{user.bio || "Not provided"}</strong></div><div className="admin-profile-wide"><span>Personal note</span><strong>{user.personalNote || "Not provided"}</strong></div></div></div>

    <div className="admin-card"><h2>Moderation actions</h2>{isUserCurrentlyBanned(user) ? <form action={unbanUserAction}><input type="hidden" name="userId" value={String(user._id)} /><button type="submit" className="admin-button secondary">Unban</button></form> : <form action={banUserAction} className="admin-form"><input type="hidden" name="userId" value={String(user._id)} /><div className="admin-form-inline"><div className="admin-field"><label htmlFor="days">Timed ban, days</label><input id="days" name="days" type="number" min="1" max="3650" defaultValue="7" className="admin-input" /></div><button name="mode" value="timed" className="admin-button">Ban temporarily</button><button name="mode" value="permanent" className="admin-button danger">Ban permanently</button></div><input name="reason" className="admin-input" placeholder="Ban reason" maxLength={300} /></form>}<form action={issueWarningForUserAction} className="admin-form" style={{ marginTop: 16 }}><input type="hidden" name="userId" value={String(user._id)} /><input name="reason" className="admin-input" placeholder="Warning reason" maxLength={300} required /><button type="submit" className="admin-button">Issue warning</button></form><div style={{ marginTop: 20 }}><DeleteUserDialog userId={String(user._id)} username={user.username} /></div></div>
    <div className="admin-card"><h2>Warning history</h2>{(user.warningHistory || []).length === 0 ? <p className="admin-muted">No warnings issued.</p> : (user.warningHistory || []).map((warning: any, index: number) => <div key={index} className="notification-row"><strong>{warning.reason || "No reason supplied"}</strong><div className="admin-muted">{new Date(warning.createdAt).toLocaleString()}</div></div>)}</div>
  </>);
}
