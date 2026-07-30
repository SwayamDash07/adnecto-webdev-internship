"use server";

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Appeal from "@/models/Appeal";
import ModerationNotice from "@/models/ModerationNotice";
import { requireUser } from "@/lib/auth-guard";

export async function submitAppealAction(formData: FormData) {
  const currentUser = await requireUser();
  const noticeId = String(formData.get("noticeId") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 1000);
  if (!mongoose.Types.ObjectId.isValid(noticeId) || !reason) redirect("/home?error=appeal_invalid");

  await connectDB();
  const notice = await ModerationNotice.findOne({ _id: noticeId, recipient: currentUser._id });
  if (!notice || notice.appealSubmitted) redirect("/home?error=appeal_exists");

  await Appeal.create({ notice: notice._id, user: currentUser._id, reason });
  notice.appealSubmitted = true;
  await notice.save();
  redirect("/home?appeal=submitted");
}

export async function dismissModerationNoticeAction(formData: FormData) {
  const currentUser = await requireUser();
  const noticeId = String(formData.get("noticeId") || "");
  if (!mongoose.Types.ObjectId.isValid(noticeId)) redirect("/home");
  await connectDB();
  await ModerationNotice.updateOne({ _id: noticeId, recipient: currentUser._id }, { $set: { dismissed: true } });
  redirect("/home");
}
