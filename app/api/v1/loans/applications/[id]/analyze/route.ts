import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const officerUserId = (session.user as any).id;

    const app = await db.loanApplication.update({
      where: { id },
      data: { stage: "IN_ANALYSIS", inAnalysisAt: new Date(), loanOfficerId: officerUserId },
    });

    return NextResponse.json({ success: true, data: app });
  } catch (error) {
    console.error("Error marking application as in analysis:", error);
    return NextResponse.json({ error: "Failed to mark application" }, { status: 500 });
  }
}
