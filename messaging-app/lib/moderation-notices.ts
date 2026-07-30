import ModerationNotice from "@/models/ModerationNotice";

export async function createWarningNotice(userId: string, adminId: string, reason: string) {
  return ModerationNotice.create({
    recipient: userId,
    type: "warning",
    title: "Moderation warning",
    message: "A moderator issued a warning on your account.",
    reason,
    admin: adminId,
  });
}

export async function createBanNotice(
  userId: string,
  adminId: string,
  reason: string,
  permanent: boolean,
  days?: number
) {
  const duration = permanent ? "permanently" : `for ${days} day${days === 1 ? "" : "s"}`;
  return ModerationNotice.create({
    recipient: userId,
    type: "ban",
    title: "Account restriction",
    message: `A moderator restricted your account ${duration}. You can still browse Threadline, but sending messages and friend requests is disabled while the restriction is active.`,
    reason,
    admin: adminId,
  });
}
