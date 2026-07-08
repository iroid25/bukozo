// app/api/v1/floats/user/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/floats/user/[userId]
 * Get float status for a specific user
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const params = await props.params;
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user's float record
    const userFloat = await db.userFloat.findFirst({
      where: { userId },
      select: {
        id: true,
        balance: true,
        isActiveForDay: true,
        canStartNewDay: true,
        pendingReconciliation: true,
        currentDayStarted: true,
        lastReconciliation: true,
        lastDayReconciled: true,
      },
    });

    // If no float record exists, return null (indicates new user, eligible for allocation)
    if (!userFloat) {
      return NextResponse.json(
        {
          exists: false,
          balance: 0,
          isActiveForDay: false,
          canStartNewDay: true,
          pendingReconciliation: false,
          currentDayStarted: null,
          lastReconciliation: null,
          lastDayReconciled: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        exists: true,
        ...userFloat,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user float:", error);
    return NextResponse.json(
      { error: "Failed to fetch user float status" },
      { status: 500 }
    );
  }
}
