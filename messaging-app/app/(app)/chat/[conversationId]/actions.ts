"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { requireUser } from "@/lib/auth-guard";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { hasBlockedUser } from "@/lib/relationships";
import User from "@/models/User";
import { markConversationRead } from "@/lib/read-receipts";
import { isUserCurrentlyBanned } from "@/lib/account-status";
import Flag from "@/models/Flag";
import { scanFlaggedTerms } from "@/lib/moderation";

async function assertParticipant(conversationId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    redirect("/chat");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.some((p: any) => String(p) === userId)) {
    redirect("/chat");
  }
  return conversation;
}

export async function sendMessageAction(formData: FormData) {
  const currentUser = await requireUser();
  const conversationId = String(formData.get("conversationId") || "");
  if (isUserCurrentlyBanned(currentUser)) {
    redirect(`/chat/${conversationId}?error=restricted`);
  }
  const text = String(formData.get("text") || "").trim();
  const photo = formData.get("photo");

  if (text.length > 2000) {
    return;
  }

  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!text && !hasPhoto) {
    return;
  }

  await connectDB();
  const conversation = await assertParticipant(conversationId, String(currentUser._id));

  const otherParticipantId = conversation.participants
    .map((p: any) => String(p))
    .find((id: string) => id !== String(currentUser._id));

  let hiddenFrom: string[] = [];

  if (otherParticipantId) {
    const [iBlockedThem, theyBlockedMe] = await Promise.all([
      hasBlockedUser(String(currentUser._id), otherParticipantId),
      hasBlockedUser(otherParticipantId, String(currentUser._id)),
    ]);

    if (iBlockedThem) {
      redirect(`/chat/${conversationId}?error=blocked`);
    }

    if (theyBlockedMe) {
      hiddenFrom = [otherParticipantId];
    }
  }

  let imageUrl: string | null = null;

  if (hasPhoto) {
    const file = photo as File;
    if (!file.type.startsWith("image/")) {
      redirect(`/chat/${conversationId}?error=invalid_file_type`);
    }
    if (file.size > 8 * 1024 * 1024) {
      redirect(`/chat/${conversationId}?error=file_too_large`);
    }
    imageUrl = await uploadImageToCloudinary(file);
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: currentUser._id,
    text,
    imageUrl,
    deliveredAt: new Date(),
    hiddenFrom,
  });

  const matchedTerms = scanFlaggedTerms(text);
  let shouldMonitor = false;
  if (matchedTerms.length > 0) {
    if (conversation.type === "group") {
      shouldMonitor = conversation.moderationMode !== "none";
    } else if (otherParticipantId) {
      const recipient = await User.findById(otherParticipantId).select("personalChatModeration friends").lean<any>();
      const mode = recipient?.personalChatModeration || "all";
      shouldMonitor = mode === "all" || (mode === "strangers" && !(recipient?.friends || []).some((id: any) => String(id) === String(currentUser._id)));
    }
  }
  if (shouldMonitor) {
    try {
      await Flag.create({ message: message._id, sender: currentUser._id, matchedTerms });
    } catch {}
  }

  conversation.lastMessageAt = new Date();
  await conversation.save();

  revalidatePath(`/chat/${conversationId}`);
}

export async function getNewMessagesAction(conversationId: string, afterTimestamp: string | null) {
  const currentUser = await requireUser();
  await connectDB();
  await assertParticipant(conversationId, String(currentUser._id));

  const query: Record<string, unknown> = {
    conversation: conversationId,
    hiddenFrom: { $ne: currentUser._id },
  };
  if (afterTimestamp) {
    query.createdAt = { $gt: new Date(afterTimestamp) };
  }

  const messages = await Message.find(query).populate("sender", "name username").sort({ createdAt: 1 }).lean();

  return messages.map((message: any) => ({
    id: String(message._id),
    sender: String(message.sender?._id || message.sender),
    senderName: message.sender?.name || "",
    text: message.text,
    imageUrl: message.imageUrl ?? null,
    deliveredAt: message.deliveredAt
      ? new Date(message.deliveredAt).toISOString()
      : (message.createdAt as Date).toISOString(),
    deleted: Boolean(message.deleted),
    editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
    createdAt: (message.createdAt as Date).toISOString(),
  }));
}

export async function editMessageAction(messageId: string, newText: string) {
  const currentUser = await requireUser();
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length > 2000) return;

  await connectDB();
  const message = await Message.findById(messageId);
  if (!message || String(message.sender) !== String(currentUser._id)) return;
  if (message.imageUrl || message.deleted) return;

  message.text = trimmed;
  message.editedAt = new Date();
  await message.save();

  revalidatePath(`/chat/${message.conversation}`);
}

export async function deleteMessageAction(messageId: string) {
  const currentUser = await requireUser();

  await connectDB();
  const message = await Message.findById(messageId);
  if (!message || String(message.sender) !== String(currentUser._id)) return;

  message.deleted = true;
  message.text = "";
  message.imageUrl = null;
  await message.save();

  revalidatePath(`/chat/${message.conversation}`);
}

export async function getReadStatusAction(conversationId: string) {
  const currentUser = await requireUser();
  await connectDB();
  const conversation = await assertParticipant(conversationId, String(currentUser._id));

  const otherParticipantId = conversation.participants
    .map((p: any) => String(p))
    .find((id: string) => id !== String(currentUser._id));

  if (!otherParticipantId) return { lastReadAt: null, hasOpenedConversation: false };

  const User = (await import("@/models/User")).default;
  const otherUser = await User.findById(otherParticipantId).select("readReceipts").lean<any>();

  const receipt = (otherUser?.readReceipts || []).find(
    (r: any) => String(r.conversation) === conversationId
  );

  return {
    lastReadAt: receipt ? new Date(receipt.lastReadAt).toISOString() : null,
    hasOpenedConversation: Boolean(receipt),
  };
}

export async function markConversationReadAction(conversationId: string) {
  const currentUser = await requireUser();
  await connectDB();
  await assertParticipant(conversationId, String(currentUser._id));

  const lastReadAt = await markConversationRead(String(currentUser._id), conversationId);

  return { lastReadAt: lastReadAt.toISOString() };
}
