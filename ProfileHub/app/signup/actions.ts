"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function registerAction(formData: FormData) {
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const username = formData.get("username")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const dob = formData.get("dob")?.toString();
  const state = formData.get("state")?.toString().trim();
  const country = formData.get("country")?.toString();
  const phoneNumber = formData.get("phoneNumber")?.toString().trim();

  if (
    !firstName || !lastName || !username || !email ||
    !password || !dob || !state || !country || !phoneNumber
  ) {
    redirect("/signup?error=missing");
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phoneNumber)) {
    redirect("/signup?error=phone");
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    redirect("/signup?error=email");
  }

  const dobDate = new Date(dob);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(dobDate.getTime()) || dobDate > today) {
    redirect("/signup?error=dob");
  }

  await connectDB();

  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    redirect("/signup?error=username");
  }

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    redirect("/signup?error=exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.create({
    firstName,
    lastName,
    username,
    email,
    password: hashedPassword,
    dob: dobDate,
    state,
    country,
    phoneNumber,
  });

  redirect("/login?success=1");
}