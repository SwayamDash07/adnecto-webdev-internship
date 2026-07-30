"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import AdminSession from "@/models/AdminSession";
import { requireAdmin } from "@/lib/admin-auth-guard";
import { adminPath } from "@/lib/admin-route";
import mongoose from "mongoose";

function isSuperAdmin(admin: any) {
  return !admin.createdBy;
}

function canManageAdmin(currentAdmin: any, targetAdminId: string) {
  return isSuperAdmin(currentAdmin) || String(currentAdmin._id) === targetAdminId;
}

export async function createAdminAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  if (!isSuperAdmin(currentAdmin)) redirect(`${adminPath("/admins")}?error=not_allowed`);
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!/^[a-z0-9_.-]{3,32}$/.test(username) || password.length < 8) redirect(`${adminPath("/admins")}?error=invalid`);
  await connectDB();
  const exists = await Admin.exists({ username });
  if (exists) redirect(`${adminPath("/admins")}?error=exists`);
  await Admin.create({ username, passwordHash: await bcrypt.hash(password, 12), createdBy: currentAdmin._id });
  redirect(`${adminPath("/admins")}?success=created`);
}

export async function deleteAdminAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const targetAdminId = String(formData.get("adminId") || "");
  if (!isSuperAdmin(currentAdmin) || !mongoose.Types.ObjectId.isValid(targetAdminId) || targetAdminId === String(currentAdmin._id)) redirect(`${adminPath("/admins")}?error=not_allowed`);
  await connectDB();
  await Admin.deleteOne({ _id: targetAdminId, createdBy: { $ne: null } });
  redirect(`${adminPath("/admins")}?success=deleted`);
}

export async function changeAdminUsernameAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const targetAdminId = String(formData.get("adminId") || "");
  const username = String(formData.get("username") || "").trim().toLowerCase();
  if (!mongoose.Types.ObjectId.isValid(targetAdminId) || !canManageAdmin(currentAdmin, targetAdminId)) redirect(`${adminPath("/admins")}?error=not_allowed`);
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) redirect(`${adminPath("/admins")}?error=invalid_username`);
  await connectDB();
  const duplicate = await Admin.findOne({ username, _id: { $ne: targetAdminId } }).select("_id").lean();
  if (duplicate) redirect(`${adminPath("/admins")}?error=admin_exists`);
  const targetAdmin = await Admin.findById(targetAdminId).select("_id");
  if (!targetAdmin) redirect(`${adminPath("/admins")}?error=admin_not_found`);
  await Admin.findByIdAndUpdate(targetAdminId, { username }, { runValidators: true });
  await AdminSession.create({ adminId: targetAdminId, action: "username_change" });
  redirect(`${adminPath("/admins")}?success=admin_username`);
}

export async function changeManagedAdminPasswordAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const targetAdminId = String(formData.get("adminId") || "");
  const password = String(formData.get("password") || "");
  if (!mongoose.Types.ObjectId.isValid(targetAdminId) || !canManageAdmin(currentAdmin, targetAdminId)) redirect(`${adminPath("/admins")}?error=not_allowed`);
  if (password.length < 8) redirect(`${adminPath("/admins")}?error=admin_password`);
  if (targetAdminId === String(currentAdmin._id)) {
    const currentPassword = String(formData.get("currentPassword") || "");
    if (!currentPassword || !(await bcrypt.compare(currentPassword, currentAdmin.passwordHash))) redirect(`${adminPath("/admins")}?error=current_password`);
  }
  await connectDB();
  const targetAdmin = await Admin.findById(targetAdminId).select("_id createdBy");
  if (!targetAdmin) redirect(`${adminPath("/admins")}?error=admin_not_found`);
  if (targetAdminId !== String(currentAdmin._id) && !isSuperAdmin(currentAdmin)) redirect(`${adminPath("/admins")}?error=not_allowed`);
  await Admin.findByIdAndUpdate(targetAdminId, { passwordHash: await bcrypt.hash(password, 12) });
  await AdminSession.create({ adminId: targetAdminId, action: "password_change" });
  redirect(`${adminPath("/admins")}?success=${targetAdminId === String(currentAdmin._id) ? "password" : "admin_password"}`);
}
