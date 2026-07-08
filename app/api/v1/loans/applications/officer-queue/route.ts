import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const officerUserId = (session.user as any).id;

    const apps = await db.loanApplication.findMany({
      where: {
        applicantId: officerUserId,
        stage: { in: ["SUBMITTED", "IN_ANALYSIS", "FORWARDED_TO_MANAGER"] },
      },
      orderBy: { applicationDate: "desc" },
      include: { member: { include: { user: true } }, loanProduct: true },
    });

    return NextResponse.json({ success: true, data: apps });
  } catch (error) {
    console.error("Error fetching officer queue:", error);
    return NextResponse.json({ error: "Failed to fetch officer queue" }, { status: 500 });
  }
}
