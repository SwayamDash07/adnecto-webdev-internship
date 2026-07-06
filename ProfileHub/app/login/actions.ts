"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { createSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const username = formData.get("username")?.toString().trim();
  const password = formData.get("password")?.toString();

  console.log("LOGIN ATTEMPT:", { username, password });

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  await connectDB();
  const user = await User.findOne({ username });

  console.log("FOUND USER:", user);

  if (!user) {
    redirect("/login?error=invalid");
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    redirect("/login?error=invalid");
  }

  await createSession(user._id.toString());
  redirect("/dashboard");
}