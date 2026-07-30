"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { generateSessionToken, setSessionCookie } from "@/lib/session";

export async function signupAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!username || !email || !password || !name) {
    redirect("/signup?error=missing_fields");
  }

  if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
    redirect("/signup?error=invalid_username");
  }

  if (password.length < 8) {
    redirect("/signup?error=weak_password");
  }

  await connectDB();

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    redirect("/signup?error=already_exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const sessionToken = generateSessionToken();

  await User.create({
    username,
    email,
    passwordHash,
    name,
    sessionToken,
  });

  await setSessionCookie(sessionToken);
  redirect("/home");
}
