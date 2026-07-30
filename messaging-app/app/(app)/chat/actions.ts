"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import { requireUser } from "@/lib/auth-guard";
import { hasBlockedUser } from "@/lib/relationships";
import mongoose from "mongoose";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

function parseIds(formData: FormData, field: string) {
  return [...new Set(formData.getAll(field).map(String).filter(mongoose.Types.ObjectId.isValid))];
}

export async function muteConversationAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const duration = String(formData.get("duration") || "");
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
  const conversationObjectId = new mongoose.Types.ObjectId(conversationId);

  await connectDB();
  const conversation = await Conversation.findOne({ _id: conversationId, participants: currentUser._id }).select("_id");
  if (!conversation) return;

  const mutedUntil = duration === "forever"
    ? null
    : duration === "1h"
      ? new Date(Date.now() + 60 * 60 * 1000)
      : duration === "8h"
        ? new Date(Date.now() + 8 * 60 * 60 * 1000)
        : null;

  await User.collection.updateOne(
    { _id: currentUser._id },
    { $pull: { mutedConversations: { conversation: conversationObjectId } } } as any,
  );
  if (duration && duration !== "off") {
    await User.collection.updateOne(
      { _id: currentUser._id },
      { $push: { mutedConversations: { conversation: conversationObjectId, mutedUntil } } } as any,
    );
  }
  revalidatePath("/chat");
  revalidatePath(`/chat/${conversationId}`);
}

export async function createGroupAction(formData: FormData) {
  const currentUser = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim().slice(0, 500);
  const memberIds = parseIds(formData, "memberId").filter((id) => id !== String(currentUser._id));
  const photo = formData.get("photo");
  if (!name || name.length > 80) redirect("/chat/groups/new?error=name");
  if (memberIds.length < 1) redirect("/chat/groups/new?error=members");
  if (memberIds.length > 255) redirect("/chat/groups/new?error=too_many_members");

  await connectDB();
  const validMembers = await User.find({ _id: { $in: memberIds } }).select("_id").lean<any[]>();
  if (validMembers.length !== memberIds.length) redirect("/chat/groups/new?error=members");

  let avatarUrl = "";
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/") || photo.size > 8 * 1024 * 1024) redirect("/chat/groups/new?error=photo");
    avatarUrl = await uploadImageToCloudinary(photo);
  }

  const conversation = await Conversation.create({
    participants: [currentUser._id, ...validMembers.map((member) => member._id)],
    type: "group",
    name,
    description,
    avatarUrl,
    creator: currentUser._id,
    admins: [currentUser._id],
  });
  redirect(`/chat/${conversation._id}`);
}

async function getGroupForUser(conversationId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) redirect("/chat");
  const conversation = await Conversation.findOne({ _id: conversationId, type: "group", participants: userId });
  if (!conversation) redirect("/chat");
  return conversation;
}

function isGroupAdmin(conversation: any, userId: string) {
  return String(conversation.creator) === userId || (conversation.admins || []).some((id: any) => String(id) === userId);
}

export async function updateGroupAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (!isGroupAdmin(conversation, String(currentUser._id))) redirect(`/chat/${conversationId}/group?error=not_allowed`);
  const name = String(formData.get("name") || "").trim();
  if (!name || name.length > 80) redirect(`/chat/${conversationId}/group?error=details`);
  const update: Record<string, unknown> = { name, description: String(formData.get("description") || "").trim().slice(0, 500) };
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/") || photo.size > 8 * 1024 * 1024) redirect(`/chat/${conversationId}/group?error=photo`);
    update.avatarUrl = await uploadImageToCloudinary(photo);
  }
  await Conversation.findByIdAndUpdate(conversationId, update);
  redirect(`/chat/${conversationId}/group?success=details`);
}

export async function updateGroupModerationAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const moderationMode = String(formData.get("moderationMode") || "all");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (String(conversation.creator) !== String(currentUser._id)) redirect(`/chat/${conversationId}/group?error=moderation_not_allowed`);
  if (!["all", "none"].includes(moderationMode)) redirect(`/chat/${conversationId}/group?error=moderation_invalid`);
  conversation.moderationMode = moderationMode;
  await conversation.save();
  redirect(`/chat/${conversationId}/group?success=moderation`);
}

export async function addGroupMembersAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const memberIds = parseIds(formData, "memberId");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (!isGroupAdmin(conversation, String(currentUser._id))) redirect(`/chat/${conversationId}/group?error=not_allowed`);
  const newMembers = memberIds.filter((id) => !conversation.participants.some((participant: any) => String(participant) === id));
  if (!newMembers.length) redirect(`/chat/${conversationId}/group?error=no_members`);
  if (conversation.participants.length + newMembers.length > 256) redirect(`/chat/${conversationId}/group?error=too_many_members`);
  const validMembers = await User.find({ _id: { $in: newMembers } }).select("_id").lean<any[]>();
  await Conversation.findByIdAndUpdate(conversationId, { $addToSet: { participants: { $each: validMembers.map((member) => member._id) } } });
  redirect(`/chat/${conversationId}/group?success=members`);
}

export async function removeGroupMemberAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const targetUserId = String(formData.get("targetUserId") || "");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  const requesterId = String(currentUser._id);
  if (!isGroupAdmin(conversation, requesterId)) redirect(`/chat/${conversationId}/group?error=not_allowed`);
  if (!mongoose.Types.ObjectId.isValid(targetUserId) || String(conversation.creator) === targetUserId) redirect(`/chat/${conversationId}/group?error=creator_protected`);
  const targetIsAdmin = (conversation.admins || []).some((id: any) => String(id) === targetUserId);
  if (targetIsAdmin && String(conversation.creator) !== requesterId) redirect(`/chat/${conversationId}/group?error=admin_protected`);
  await Conversation.findByIdAndUpdate(conversationId, { $pull: { participants: targetUserId, admins: targetUserId } });
  redirect(`/chat/${conversationId}/group?success=removed`);
}

export async function promoteGroupAdminAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const targetUserId = String(formData.get("targetUserId") || "");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (String(conversation.creator) !== String(currentUser._id)) redirect(`/chat/${conversationId}/group?error=creator_only`);
  if (!conversation.participants.some((participant: any) => String(participant) === targetUserId)) redirect(`/chat/${conversationId}/group?error=invalid_member`);
  await Conversation.findByIdAndUpdate(conversationId, { $addToSet: { admins: targetUserId } });
  redirect(`/chat/${conversationId}/group?success=promoted`);
}

export async function demoteGroupAdminAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  const targetUserId = String(formData.get("targetUserId") || "");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (String(conversation.creator) !== String(currentUser._id)) redirect(`/chat/${conversationId}/group?error=creator_only`);
  if (String(conversation.creator) === targetUserId) redirect(`/chat/${conversationId}/group?error=creator_protected`);
  await Conversation.findByIdAndUpdate(conversationId, { $pull: { admins: targetUserId } });
  redirect(`/chat/${conversationId}/group?success=demoted`);
}

export async function leaveGroupAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  await connectDB();
  const conversation = await getGroupForUser(conversationId, String(currentUser._id));
  if (String(conversation.creator) === String(currentUser._id)) redirect(`/chat/${conversationId}/group?error=creator_leave`);
  await Conversation.findByIdAndUpdate(conversationId, { $pull: { participants: currentUser._id, admins: currentUser._id } });
  redirect("/chat");
}

export async function startConversationAction(formData: FormData) {
  const currentUser = await requireUser();
  const targetUsername = String(formData.get("targetUsername") || "").trim().toLowerCase();

  if (!targetUsername || targetUsername === currentUser.username) {
    redirect("/search?error=invalid_target");
  }

  await connectDB();
  const targetUser = await User.findOne({ username: targetUsername });
  if (!targetUser) {
    redirect("/search?error=user_not_found");
  }

  const iBlockedThem = await hasBlockedUser(String(currentUser._id), String(targetUser._id));
  if (iBlockedThem) {
    redirect("/search?error=blocked");
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [currentUser._id, targetUser._id], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [currentUser._id, targetUser._id],
    });
  }

  redirect(`/chat/${conversation._id}`);
}
