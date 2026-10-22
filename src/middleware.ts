import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OC_SESSION_COOKIE } from "@/src/lib/auth/constants";
import { isTokenExpired } from "@/src/lib/auth/jwt-utils";
import { canAccessPage, isSuperAdmin, getDefaultRedirectPage } from "@/src/lib/auth/role-utils";
import { deserializeSession } from "@/src/lib/auth/session-cookie";

// List of public paths that do not require authentication
const PUBLIC_FILE = /\.(.*)$/;
const PUBLIC_PATHS = ["/login", "/unauthorized", "/api/ordercloud/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass static files, Next.js internals, and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(OC_SESSION_COOKIE);
  const sessionData = deserializeSession(sessionCookie?.value);

  const token = sessionData?.accessToken;
  const isExpired = token ? isTokenExpired(token) : true;
  const isAuthenticated = !!token && !isExpired;

  // 1. If currently accessing /login
  if (pathname === "/login") {
    // If token is expired and cookie exists, delete cookie
    if (sessionCookie && isExpired) {
      const response = NextResponse.next();
      response.cookies.set(OC_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "none",
        secure: true,
      });
      return response;
    }

    // If authenticated, redirect to home page "/"
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // 2. /unauthorized is accessible freely
  if (pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 3. If unauthenticated or token expired
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (sessionCookie && isExpired) {
      loginUrl.searchParams.set("expired", "1");
    } else {
      loginUrl.searchParams.set("from", pathname);
    }

    const response = NextResponse.redirect(loginUrl);
    if (sessionCookie) {
      response.cookies.set(OC_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        sameSite: "none",
        secure: true,
      });
    }
    return response;
  }

  // 4. Role-based access control (RBAC) - Strictly checks xp.Roles
  const roles: string[] = Array.isArray(sessionData?.xpRoles)
    ? sessionData.xpRoles
    : [];
  const userIsSuperAdmin =
    sessionData?.isSuperAdmin ?? isSuperAdmin(roles, sessionData?.username);

  // If navigating to Admin section without Super Admin role
  if (pathname.startsWith("/admin") && !userIsSuperAdmin) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  // Check access permission for module page
  if (!canAccessPage(pathname, roles, sessionData?.username)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
