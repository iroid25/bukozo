import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const app = await db.loanApplication.update({
      where: { id },
      data: { stage: "FORWARDED_TO_MANAGER", forwardedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: app });
  } catch (error) {
    console.error("Error forwarding application to manager:", error);
    return NextResponse.json({ error: "Failed to forward application" }, { status: 500 });
  }
}
