"use server";

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Appeal from "@/models/Appeal";
import User from "@/models/User";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { adminPath } from "@/lib/admin-route";
import Admin from "@/models/Admin";

export async function reviewAppealAction(formData: FormData) {
  const admin = await requireAdmin();
  const appealId = String(formData.get("appealId") || "");
  const decision = String(formData.get("decision") || "");
  if (!mongoose.Types.ObjectId.isValid(appealId) || !["approved", "denied"].includes(decision)) {
    redirect(`${adminPath("/dashboard")}?error=invalid_appeal`);
  }

  await connectDB();
  const appeal = await Appeal.findOne({ _id: appealId, status: "pending" }).populate("notice");
  if (!appeal) redirect(`${adminPath("/dashboard")}?error=resolved_appeal`);

  appeal.status = decision as "approved" | "denied";
  appeal.reviewedBy = admin._id;
  appeal.reviewedAt = new Date();
  await appeal.save();

  if (decision === "approved") {
    const notice: any = appeal.notice;
    const user: any = await User.findById(appeal.user);
    if (!user) redirect(`${adminPath("/dashboard")}?error=invalid_user`);
    if (notice?.type === "ban") {
      user.bannedPermanently = false;
      user.bannedUntil = null;
    } else if (notice?.type === "warning") {
      user.warningCount = Math.max(0, Number(user.warningCount || 0) - 1);
      user.warningHistory = (user.warningHistory || []).filter(
        (warning: any) => !(warning.reason === notice.reason && String(warning.admin) === String(notice.admin))
      );
    }
    if (notice?.type === "ban") {
      await Admin.findByIdAndUpdate(notice.admin, { $inc: { banCount: -1 } });
    } else if (notice?.type === "warning") {
      await Admin.findByIdAndUpdate(notice.admin, { $inc: { warningCount: -1 } });
    }
    await user.save();
  }

  redirect(adminPath("/dashboard"));
}
