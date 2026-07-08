import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getAuthenticatedRedirectPath } from "@/lib/auth-redirect";
import { resolveAuthenticatedUser } from "@/lib/auth-user";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAuthenticatedUser({
    id: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nextUrl = await getAuthenticatedRedirectPath({
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    phone: session.user.phone,
    preferredPath: "/dashboard",
  });

  return NextResponse.json({
    nextUrl,
    initialData: {
      surname: user.lastName || user.member?.surname || "",
      otherNames: user.firstName || user.member?.otherNames || "",
      email: user.email || "",
      nin: user.member?.nin || user.nationalId || "",
      dateOfBirth: user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: user.member?.gender || "",
      maritalStatus: user.member?.maritalStatus || "",
      occupation: user.member?.occupation || "",
      citizenship: user.member?.citizenship || "Ugandan",
      address: user.address || user.member?.postalAddress || "",
      phone: user.phone || "",
      nokName: user.member?.nokName || "",
      nokRelationship: user.member?.nokRelationship || "",
      nokPhone: user.member?.nokPhone || "",
    },
  });
}
