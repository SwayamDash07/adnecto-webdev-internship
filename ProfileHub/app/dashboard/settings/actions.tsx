"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { getSession } from "@/lib/session";

export async function changePasswordAction(formData: FormData) {
  const currentUser = await getSession();
  if (!currentUser) redirect("/login");

  const currentPassword = formData.get("currentPassword")?.toString();
  const newPassword = formData.get("newPassword")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/dashboard/settings?section=password&error=missing");
  }

  if (newPassword !== confirmPassword) {
    redirect("/dashboard/settings?section=password&error=passwordMismatch");
  }

  await connectDB();
  const user = await User.findById(currentUser._id);
  if (!user) redirect("/login");

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentValid) {
    redirect("/dashboard/settings?section=password&error=currentPassword");
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(user._id, { password: hashedNewPassword });

  redirect("/dashboard/settings?section=password&success=1");
}