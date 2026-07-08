import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    pathname !== "/dashboard/force-password-change"
  ) {
    // Only redirect if they are not already on the force-password-change page
    // and they are not trying to logout (if logout is under /apih/auth)
    return NextResponse.redirect(
      new URL("/dashboard/force-password-change", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
