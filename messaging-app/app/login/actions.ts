"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { generateSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/session";
import { requireUser } from "@/lib/auth-guard";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!identifier || !password) {
    redirect("/login?error=missing_fields");
  }

  await connectDB();

  const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
  if (!user) {
    redirect("/login?error=invalid_credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    redirect("/login?error=invalid_credentials");
  }

  const sessionToken = generateSessionToken();
  user.sessionToken = sessionToken;
  await user.save();

  await setSessionCookie(sessionToken);
  redirect("/home");
}

export async function logoutAction() {
  const user = await requireUser();
  await connectDB();
  await User.findByIdAndUpdate(user._id, { sessionToken: null });
  await clearSessionCookie();
  redirect("/login");
}
