import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import { getAdminSessionToken } from "@/lib/admin-session";
import { adminPath } from "@/lib/admin-route";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export async function getCurrentAdmin(): Promise<any> {
  const token = await getAdminSessionToken();
  if (!token) return null;

  await connectDB();
  const admin = await Admin.findOne({ sessionToken: token });
  if (!admin) return null;

  const now = Date.now();
  const sessionStartedAt = admin.sessionStartedAt?.getTime?.() || 0;
  const lastActiveAt = admin.lastActiveAt?.getTime?.() || 0;
  const expired = !sessionStartedAt || !lastActiveAt || now - sessionStartedAt > ABSOLUTE_SESSION_LIFETIME_MS || now - lastActiveAt > IDLE_TIMEOUT_MS;

  if (expired) {
    admin.sessionToken = null;
    admin.sessionStartedAt = null;
    admin.lastActiveAt = null;
    await admin.save();
    const { clearAdminSessionCookie } = await import("@/lib/admin-session");
    await clearAdminSessionCookie();
    return null;
  }

  admin.lastActiveAt = new Date(now);
  await admin.save();
  return admin.toObject();
}

export async function requireAdmin(): Promise<any> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(adminPath("/login"));
  return admin;
}
