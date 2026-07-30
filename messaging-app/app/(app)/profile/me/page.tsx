import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";

export default async function MyProfileRedirect() {
  const user = await requireUser();
  redirect(`/profile/${user.username}`);
}