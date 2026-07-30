"use server";

import { cookies } from "next/headers";

export async function toggleThemeAction() {
  const cookieStore = await cookies();
  const current = cookieStore.get("threadline_theme")?.value === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";

  cookieStore.set("threadline_theme", next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}