import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getAuthenticatedRedirectPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ nextUrl: "/login" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const preferredPath = searchParams.get("callbackUrl") || searchParams.get("returnUrl");

  const nextUrl = await getAuthenticatedRedirectPath({
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    phone: session.user.phone,
    preferredPath,
  });

  return NextResponse.json({ nextUrl });
}
