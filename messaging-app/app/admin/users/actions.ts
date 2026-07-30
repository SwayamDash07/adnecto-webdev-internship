"use server";

import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import FriendRequest from "@/models/FriendRequest";
import Notification from "@/models/Notification";
import Flag from "@/models/Flag";
import ModerationNotice from "@/models/ModerationNotice";
import Appeal from "@/models/Appeal";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { adminPath } from "@/lib/admin-route";
import { createBanNotice, createWarningNotice } from "@/lib/moderation-notices";
import bcrypt from "bcryptjs";
import Admin from "@/models/Admin";

function getUserId(formData: FormData) {
  const userId = String(formData.get("userId") || "");
  return mongoose.Types.ObjectId.isValid(userId) ? userId : null;
}

export async function banUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = getUserId(formData);
  if (!userId) redirect(`${adminPath("/users")}?error=invalid_user`);
  const mode = String(formData.get("mode") || "timed");
  const reason = String(formData.get("reason") || "Account moderation review").trim().slice(0, 300);
  await connectDB();

  if (mode === "permanent") {
    await User.findByIdAndUpdate(userId, { bannedPermanently: true, bannedUntil: null });
    await createBanNotice(userId, String(admin._id), reason, true);
  } else {
    const days = Math.min(3650, Math.max(1, Number(formData.get("days") || 1)));
    const bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, { bannedPermanently: false, bannedUntil });
    await createBanNotice(userId, String(admin._id), reason, false, days);
  }
  await Admin.findByIdAndUpdate(admin._id, { $inc: { banCount: 1 } });
  redirect(`${adminPath(`/users/${userId}`)}?success=banned`);
}

export async function unbanUserAction(formData: FormData) {
  await requireAdmin();
  const userId = getUserId(formData);
  if (!userId) redirect(`${adminPath("/users")}?error=invalid_user`);
  await connectDB();
  await User.findByIdAndUpdate(userId, { bannedPermanently: false, bannedUntil: null });
  redirect(`${adminPath(`/users/${userId}`)}?success=unbanned`);
}

export async function issueWarningForUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = getUserId(formData);
  if (!userId) redirect(`${adminPath("/users")}?error=invalid_user`);
  const reason = String(formData.get("reason") || "Account moderation review").trim().slice(0, 300);
  await connectDB();
  const user = await User.findById(userId).select("_id");
  if (!user) redirect(`${adminPath("/users")}?error=invalid_user`);
  await User.findByIdAndUpdate(userId, { $inc: { warningCount: 1 }, $push: { warningHistory: { reason, admin: admin._id, createdAt: new Date() } } });
  await Admin.findByIdAndUpdate(admin._id, { $inc: { warningCount: 1 } });
  await createWarningNotice(userId, String(admin._id), reason);
  redirect(`${adminPath(`/users/${userId}`)}?success=warning`);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = getUserId(formData);
  const confirmationPassword = String(formData.get("confirmationPassword") || "");
  if (!userId) redirect(`${adminPath("/users")}?error=invalid_user`);
  if (!confirmationPassword || !(await bcrypt.compare(confirmationPassword, admin.passwordHash))) {
    redirect(`${adminPath(`/users/${userId}`)}?error=confirmation`);
  }

  await connectDB();
  const conversations = await Conversation.find({ participants: userId }).select("_id").lean<any[]>();
  const conversationIds = conversations.map((conversation) => conversation._id);
  const messageIds = await Message.find({ conversation: { $in: conversationIds } }).distinct("_id");

  await Promise.all([
    Message.deleteMany({ _id: { $in: messageIds } }),
    Flag.deleteMany({ $or: [{ sender: userId }, { message: { $in: messageIds } }] }),
    FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
    ModerationNotice.deleteMany({ recipient: userId }),
    Appeal.deleteMany({ user: userId }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    User.updateMany({ friends: userId }, { $pull: { friends: userId } }),
    User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } }),
    User.deleteOne({ _id: userId }),
    Admin.findByIdAndUpdate(admin._id, { $inc: { deletionCount: 1 } }),
  ]);

  redirect(`${adminPath("/users")}?success=deleted`);
}

function csvToArray(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export async function updateUserDetailsAction(formData: FormData) {
  await requireAdmin();
  const userId = getUserId(formData);
  if (!userId) redirect(`${adminPath("/users")}?error=invalid_user`);

  const username = String(formData.get("username") || "").trim().toLowerCase();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  if (!/^[a-z0-9_.-]{3,32}$/.test(username) || !email || !name || (password && password.length < 8)) {
    redirect(`${adminPath(`/users/${userId}`)}?error=invalid_details`);
  }

  await connectDB();
  const duplicate = await User.findOne({ $or: [{ username }, { email }], _id: { $ne: userId } }).select("_id").lean();
  if (duplicate) redirect(`${adminPath(`/users/${userId}`)}?error=duplicate_details`);

  const update: Record<string, unknown> = {
    username,
    email,
    name,
    location: String(formData.get("location") || "").trim(),
    hobbies: csvToArray(formData.get("hobbies")),
    interests: csvToArray(formData.get("interests")),
    musicTaste: String(formData.get("musicTaste") || "").trim(),
    movieTaste: String(formData.get("movieTaste") || "").trim(),
    favoriteFood: String(formData.get("favoriteFood") || "").trim(),
    bio: String(formData.get("bio") || "").trim(),
    personalNote: String(formData.get("personalNote") || "").trim(),
    avatarUrl: String(formData.get("avatarUrl") || "").trim(),
  };
  if (password) {
    update.passwordHash = await bcrypt.hash(password, 12);
    update.sessionToken = null;
  }
  await User.findByIdAndUpdate(userId, update, { runValidators: true });
  redirect(`${adminPath(`/users/${userId}`)}?success=details`);
}

const editableUserFields = new Set([
  "name", "username", "email", "location", "hobbies", "interests", "musicTaste", "movieTaste",
  "favoriteFood", "bio", "personalNote", "avatarUrl", "password",
]);

export async function updateUserFieldAction(formData: FormData) {
  await requireAdmin();
  const userId = getUserId(formData);
  const field = String(formData.get("field") || "");
  if (!userId || !editableUserFields.has(field)) redirect(`${adminPath("/users")}?error=invalid_user`);

  const rawValue = String(formData.get("value") || "").trim();
  if ((field === "name" || field === "email" || field === "username") && !rawValue) {
    redirect(`${adminPath(`/users/${userId}/edit`)}?error=required`);
  }
  if (field === "username" && !/^[a-z0-9_.-]{3,32}$/.test(rawValue.toLowerCase())) {
    redirect(`${adminPath(`/users/${userId}/edit`)}?error=invalid_username`);
  }
  if (field === "email" && !/^\S+@\S+\.\S+$/.test(rawValue)) {
    redirect(`${adminPath(`/users/${userId}/edit`)}?error=invalid_email`);
  }
  if (field === "password" && rawValue.length < 8) {
    redirect(`${adminPath(`/users/${userId}/edit`)}?error=password`);
  }

  await connectDB();
  if (field === "username" || field === "email") {
    const duplicate = await User.findOne({ [field]: field === "username" ? rawValue.toLowerCase() : rawValue.toLowerCase(), _id: { $ne: userId } }).select("_id").lean();
    if (duplicate) redirect(`${adminPath(`/users/${userId}/edit`)}?error=duplicate`);
  }

  let value: unknown = rawValue;
  if (field === "username" || field === "email") value = rawValue.toLowerCase();
  if (field === "hobbies" || field === "interests") value = csvToArray(rawValue);
  if (field === "password") {
    value = await bcrypt.hash(rawValue, 12);
    await User.findByIdAndUpdate(userId, { passwordHash: value, sessionToken: null });
  } else {
    await User.findByIdAndUpdate(userId, { [field]: value }, { runValidators: true });
  }
  redirect(`${adminPath(`/users/${userId}/edit`)}?success=${field}`);
}
