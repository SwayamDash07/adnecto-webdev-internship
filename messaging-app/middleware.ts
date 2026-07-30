import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/home", "/search", "/profile", "/chat", "/friends", "/notifications"];
const DEFAULT_ADMIN_PATH = "/threadline-ops-9f3c7a2d8e1b4c6f";

function getAdminBasePath() {
  const configured = String(process.env.THREADLINE_ADMIN_PATH || "").trim().replace(/\/+$/, "");
  return /^\/[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(configured) ? configured : DEFAULT_ADMIN_PATH;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const adminBasePath = getAdminBasePath();
  const isSecretAdminRoute = pathname === adminBasePath || pathname.startsWith(`${adminBasePath}/`);
  const isPublicAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isPublicAdminRoute) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (isSecretAdminRoute) {
    const adminPath = pathname.slice(adminBasePath.length) || "/";
    const isLogin = adminPath === "/login" || adminPath.startsWith("/login?");
    const adminToken = request.cookies.get("threadline_admin_session")?.value;
    if (!adminToken && !isLogin) {
      return NextResponse.redirect(new URL(`${adminBasePath}/login`, request.url));
    }

    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = `/admin${adminPath}`;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-threadline-admin", "1");
    return NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } });
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get("threadline_session")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
