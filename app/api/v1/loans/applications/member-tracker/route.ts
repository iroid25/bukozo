import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const apps = await db.loanApplication.findMany({
      where: { memberId },
      orderBy: { applicationDate: "desc" },
      include: {
        loanProduct: true,
        loanOfficer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: apps });
  } catch (error) {
    console.error("Error fetching member loan tracker:", error);
    return NextResponse.json({ error: "Failed to fetch loan applications" }, { status: 500 });
  }
}
