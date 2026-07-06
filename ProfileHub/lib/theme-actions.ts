"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export async function toggleThemeAction() {
  const cookieStore = await cookies();
  const current = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";

  cookieStore.set("theme", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const headerList = await headers();
  const referer = headerList.get("referer") || "/";
  redirect(referer);
}