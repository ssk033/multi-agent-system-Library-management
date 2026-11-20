import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccessPath } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/api/auth") ||
    path === "/api/health";

  if (isPublic) return NextResponse.next();

  if (!request.auth?.user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  const role = request.auth.user.role;
  if (role && !canAccessPath(role, path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/overview", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
