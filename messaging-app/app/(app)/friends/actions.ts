"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import Notification from "@/models/Notification";
import { requireUser } from "@/lib/auth-guard";
import { isBlockedBetween } from "@/lib/relationships";
import { isUserCurrentlyBanned } from "@/lib/account-status";

export async function sendFriendRequestAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetUsername = String(formData.get("targetUsername") || "").trim().toLowerCase();
  if (!targetUsername || targetUsername === currentUser.username) return;
  if (isUserCurrentlyBanned(currentUser)) {
    redirect(`/profile/${targetUsername}?error=restricted`);
  }

  await connectDB();
  const targetUser = await User.findOne({ username: targetUsername });
  if (!targetUser) return;

  const blocked = await isBlockedBetween(String(currentUser._id), String(targetUser._id));
  if (blocked) return;

  const alreadyFriends = (currentUser.friends || []).some(
    (id: any) => String(id) === String(targetUser._id)
  );
  if (alreadyFriends) return;

  const existing = await FriendRequest.findOne({
    $or: [
      { from: currentUser._id, to: targetUser._id },
      { from: targetUser._id, to: currentUser._id },
    ],
    status: "pending",
  });
  if (existing) return;

  const request = await FriendRequest.create({
    from: currentUser._id,
    to: targetUser._id,
    status: "pending",
  });

  await Notification.create({
    recipient: targetUser._id,
    type: "friend_request",
    actor: currentUser._id,
    relatedId: request._id,
  });

  revalidatePath(`/profile/${targetUser.username}`);
}

export async function acceptFriendRequestAction(formData: FormData) {
  const currentUser = await requireUser();
  const requestId = String(formData.get("requestId") || "");
  if (isUserCurrentlyBanned(currentUser)) {
    redirect("/friends?error=restricted");
  }

  await connectDB();
  const request = await FriendRequest.findById(requestId);
  if (!request || String(request.to) !== String(currentUser._id) || request.status !== "pending") {
    redirect("/friends");
  }

  request.status = "accepted";
  await request.save();

  await Notification.updateOne(
    {
      recipient: request.to,
      type: "friend_request",
      relatedId: request._id,
    },
    { read: true }
  );

  await User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } });
  await User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } });

  await Notification.create({
    recipient: request.from,
    type: "friend_accepted",
    actor: request.to,
  });

  revalidatePath("/friends");
  revalidatePath("/notifications");
  revalidatePath("/home");
}

export async function declineFriendRequestAction(formData: FormData) {
  const currentUser = await requireUser();
  const requestId = String(formData.get("requestId") || "");

  await connectDB();
  const request = await FriendRequest.findById(requestId);
  if (request && String(request.to) === String(currentUser._id)) {
    request.status = "declined";
    await request.save();

    await Notification.updateOne(
      {
        recipient: request.to,
        type: "friend_request",
        relatedId: request._id,
      },
      { read: true }
    );
  }

  revalidatePath("/friends");
  revalidatePath("/notifications");
}

export async function cancelFriendRequestAction(formData: FormData) {
  const currentUser = await requireUser();
  const requestId = String(formData.get("requestId") || "");

  await connectDB();
  const request = await FriendRequest.findById(requestId);
  if (request && String(request.from) === String(currentUser._id)) {
    await FriendRequest.deleteOne({ _id: request._id });
  }

  revalidatePath("/friends");
}

export async function removeFriendAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetUsername = String(formData.get("targetUsername") || "").trim().toLowerCase();

  await connectDB();
  const targetUser = await User.findOne({ username: targetUsername });
  if (!targetUser) return;

  await User.findByIdAndUpdate(currentUser._id, { $pull: { friends: targetUser._id } });
  await User.findByIdAndUpdate(targetUser._id, { $pull: { friends: currentUser._id } });

  revalidatePath("/friends");
  revalidatePath(`/profile/${targetUsername}`);
}

export async function blockUserAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetUsername = String(formData.get("targetUsername") || "").trim().toLowerCase();
  const returnTo = String(formData.get("returnTo") || "");

  await connectDB();
  const targetUser = await User.findOne({ username: targetUsername });
  if (!targetUser) return;

  await User.findByIdAndUpdate(currentUser._id, {
    $addToSet: { blockedUsers: targetUser._id },
    $pull: { friends: targetUser._id },
  });
  await User.findByIdAndUpdate(targetUser._id, { $pull: { friends: currentUser._id } });

  await FriendRequest.deleteMany({
    $or: [
      { from: currentUser._id, to: targetUser._id },
      { from: targetUser._id, to: currentUser._id },
    ],
  });

  revalidatePath(`/profile/${targetUsername}`);
  revalidatePath("/profile/me");
  revalidatePath("/chat");

  if (returnTo) {
    redirect(returnTo);
  }
}

export async function unblockUserAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetUserId = String(formData.get("targetUserId") || "");
  const returnTo = String(formData.get("returnTo") || "");

  await connectDB();
  await User.findByIdAndUpdate(currentUser._id, { $pull: { blockedUsers: targetUserId } });

  revalidatePath("/profile/me");
  revalidatePath("/chat");

  if (returnTo) {
    redirect(returnTo);
  }
}
