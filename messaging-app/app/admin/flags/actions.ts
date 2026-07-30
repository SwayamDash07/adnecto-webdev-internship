"use server";

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Flag from "@/models/Flag";
import User from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { adminPath } from "@/lib/admin-route";
import { createBanNotice, createWarningNotice } from "@/lib/moderation-notices";
import Admin from "@/models/Admin";

function validId(formData: FormData, name: string) {
  const value = String(formData.get(name) || "");
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

export async function reviewFlagAction(formData: FormData) {
  const admin = await requireAdmin();
  const flagId = validId(formData, "flagId");
  if (!flagId) redirect(`${adminPath("/flags")}?error=invalid_flag`);
  await connectDB();
  const flag = await Flag.findById(flagId);
  if (!flag || flag.reviewed) redirect(`${adminPath("/flags")}?error=resolved_flag`);
  flag.reviewed = true;
  flag.reviewedBy = admin._id;
  await flag.save();
  redirect(adminPath("/flags"));
}

export async function issueWarningAction(formData: FormData) {
  const admin = await requireAdmin();
  const flagId = validId(formData, "flagId");
  const userId = validId(formData, "userId");
  if (!flagId || !userId) redirect(`${adminPath("/flags")}?error=invalid_flag`);
  const reason = String(formData.get("reason") || "Flagged message review").trim().slice(0, 300);
  await connectDB();
  const flag = await Flag.findById(flagId);
  if (!flag || flag.reviewed || String(flag.sender) !== userId) redirect(`${adminPath("/flags")}?error=resolved_flag`);
  await User.findByIdAndUpdate(userId, { $inc: { warningCount: 1 }, $push: { warningHistory: { reason, admin: admin._id, createdAt: new Date() } } });
  await Admin.findByIdAndUpdate(admin._id, { $inc: { warningCount: 1 } });
  await createWarningNotice(userId, String(admin._id), reason);
  flag.reviewed = true;
  flag.reviewedBy = admin._id;
  await flag.save();
  redirect(adminPath("/flags"));
}

export async function banFromFlagAction(formData: FormData) {
  const admin = await requireAdmin();
  const flagId = validId(formData, "flagId");
  const userId = validId(formData, "userId");
  if (!flagId || !userId) redirect(`${adminPath("/flags")}?error=invalid_flag`);
  const mode = String(formData.get("mode") || "timed");
  await connectDB();
  const flag = await Flag.findById(flagId);
  if (!flag || flag.reviewed || String(flag.sender) !== userId) redirect(`${adminPath("/flags")}?error=resolved_flag`);
  const reason = `Flagged language: ${(flag.matchedTerms || []).join(", ") || "moderation review"}`;
  if (mode === "permanent") {
    await User.findByIdAndUpdate(userId, { bannedPermanently: true, bannedUntil: null });
    await createBanNotice(userId, String(admin._id), reason, true);
  } else {
    const days = Math.min(3650, Math.max(1, Number(formData.get("days") || 1)));
    await User.findByIdAndUpdate(userId, { bannedPermanently: false, bannedUntil: new Date(Date.now() + days * 86400000) });
    await createBanNotice(userId, String(admin._id), reason, false, days);
  }
  await Admin.findByIdAndUpdate(admin._id, { $inc: { banCount: 1 } });
  flag.reviewed = true;
  flag.reviewedBy = admin._id;
  await flag.save();
  redirect(adminPath("/flags"));
}

export async function reopenFlagAction(formData: FormData) {
  await requireAdmin();
  const flagId = validId(formData, "flagId");
  if (!flagId) redirect(`${adminPath("/flags")}?error=invalid_flag`);
  await connectDB();
  const flag = await Flag.findById(flagId);
  if (!flag || !flag.reviewed) redirect(`${adminPath("/flags")}?error=open_flag`);
  flag.reviewed = false;
  await flag.save();
  redirect(adminPath("/flags"));
}
