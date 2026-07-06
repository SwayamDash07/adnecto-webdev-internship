import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export async function requireUser() {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireManager() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/login");
  }

  return user;
}