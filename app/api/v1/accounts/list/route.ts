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

    const accounts = await db.account.findMany({
      include: {
        member: {
          include: {
            user: true,
          },
        },
        institution: {
          include: {
            user: true,
          },
        },
        accountType: true,
        branch: true,
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true,
          },
        },
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("Error fetching account list:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load accounts",
      },
      { status: 500 },
    );
  }
}
