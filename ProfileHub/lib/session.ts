import { cookies } from "next/headers";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await connectDB();
  await User.findByIdAndUpdate(userId, { sessionToken: token });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  await connectDB();
  const user = await User.findOne({ sessionToken: token });
  return user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (token) {
    await connectDB();
    await User.updateOne({ sessionToken: token }, { $unset: { sessionToken: "" } });
  }

  cookieStore.delete("session");
}