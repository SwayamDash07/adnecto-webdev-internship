import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSessionToken } from "@/lib/session";
import User from "@/models/User";

export async function getCurrentUser(): Promise<any> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  await connectDB();
  const user = await User.findOne({ sessionToken: token }).lean<any>();
  return user;
}

export async function requireUser(): Promise<any> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}