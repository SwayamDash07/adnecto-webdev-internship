import crypto from "crypto";
import { cookies } from "next/headers";

const ADMIN_SESSION_COOKIE = "threadline_admin_session";

export function generateAdminSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

export { ADMIN_SESSION_COOKIE };
