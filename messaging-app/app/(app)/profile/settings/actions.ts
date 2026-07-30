"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireUser } from "@/lib/auth-guard";

export async function changePasswordAction(formData: FormData) {
  const currentUser = await requireUser();

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (newPassword.length < 8) {
    redirect("/profile/settings?section=password&error=weak_password");
  }

  await connectDB();
  const user = await User.findById(currentUser._id);

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    redirect("/profile/settings?section=password&error=wrong_current_password");
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  redirect("/profile/settings?section=password&success=password_changed");
}

export async function updatePersonalChatModerationAction(formData: FormData) {
  const currentUser = await requireUser();
  const moderationMode = String(formData.get("personalChatModeration") || "");
  if (!["strangers", "all", "none"].includes(moderationMode)) {
    redirect("/profile/settings?section=personal-chats&error=moderation_invalid");
  }
  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, { personalChatModeration: moderationMode });
  redirect("/profile/settings?section=personal-chats&success=moderation_updated");
}
