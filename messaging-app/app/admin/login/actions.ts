"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import { clearAdminSessionCookie, generateAdminSessionToken, getAdminSessionToken, setAdminSessionCookie } from "@/lib/admin-session";
import { adminPath } from "@/lib/admin-route";
import { getCurrentAdmin } from "@/lib/admin-auth-guard";

export async function loginAdminAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!username || !password) redirect(`${adminPath("/login")}?error=missing_fields`);

  await connectDB();
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    redirect(`${adminPath("/login")}?error=invalid_credentials`);
  }

  const token = generateAdminSessionToken();
  const now = new Date();
  admin.sessionToken = token;
  admin.sessionStartedAt = now;
  admin.lastActiveAt = now;
  await admin.save();
  await AdminSession.create({ adminId: admin._id, action: "login" });
  await setAdminSessionCookie(token);
  redirect(adminPath("/dashboard"));
}

export async function logoutAdminAction() {
  const token = await getAdminSessionToken();
  if (token) {
    await connectDB();
    const admin = await Admin.findOne({ sessionToken: token }).select("_id");
    if (admin) {
      await AdminSession.create({ adminId: admin._id, action: "logout" });
      await Admin.findByIdAndUpdate(admin._id, { sessionToken: null, sessionStartedAt: null, lastActiveAt: null });
    }
  }
  await clearAdminSessionCookie();
  redirect(adminPath("/login"));
}

export async function confirmAndRefreshAdminSessionAction(formData: FormData) {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, idleExpiresAt: 0, error: "session" };
  const password = String(formData.get("password") || "");
  if (!password || !(await bcrypt.compare(password, admin.passwordHash))) {
    return { ok: false, idleExpiresAt: 0, error: "password" };
  }
  return { ok: true, idleExpiresAt: Date.now() + 30 * 60 * 1000 };
}
