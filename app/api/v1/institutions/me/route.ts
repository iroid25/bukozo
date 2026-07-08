import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const institution = await db.institution.findUnique({
      where: { userId: (session.user as any).id },
      select: {
        id: true,
        institutionName: true,
        institutionNumber: true,
        institutionEmail: true,
        institutionPhone: true,
      },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: institution });
  } catch (error: any) {
    console.error("Error fetching institution for current user:", error);
    return NextResponse.json({ error: "Failed to fetch institution" }, { status: 500 });
  }
}
