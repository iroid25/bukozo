import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateCsrfToken, setCsrfCookie, validateCsrf } from "@/lib/csrf";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF protection for API mutations
  if (pathname.startsWith("/api/")) {
    if (!validateCsrf(request)) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  console.log(`[Middleware] Request to: ${pathname}`);

  // 1. Get the token
  const token: any = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 2. Protected Routes Check
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isLoginPage = pathname === "/login";

  if (isDashboardPage && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 3. Force Password Change Check
  if (
    token?.requiresPasswordChange &&
    isDashboardPage &&
    pathname !== "/dashboard/force-password-change" &&
    !pathname.startsWith("/api/auth")
  ) {
    return NextResponse.redirect(
      new URL("/dashboard/force-password-change", request.url)
    );
  }

  // 4. Set CSRF cookie on page loads if not present
  let response = NextResponse.next();
  if (!request.cookies.has("csrf-token") && !pathname.startsWith("/api/")) {
    response = setCsrfCookie(response, generateCsrfToken());
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};
