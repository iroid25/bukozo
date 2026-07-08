import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { memberId, applicationId, reason } = await request.json();

    if (!memberId || !applicationId || !reason) {
      return NextResponse.json({ error: "memberId, applicationId, and reason are required" }, { status: 400 });
    }

    const appeal = await db.loanAppeal.create({
      data: { applicationId, memberId, reason },
    });

    return NextResponse.json({ success: true, data: appeal }, { status: 201 });
  } catch (error) {
    console.error("Error creating loan appeal:", error);
    return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
  }
}
