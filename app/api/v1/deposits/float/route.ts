import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Fetch the user's float balance for the day
    const userFloat = await db.userFloat.findUnique({
      where: { userId },
      select: {
          balance: true,
          isActiveForDay: true
      }
    });

    return NextResponse.json({
      data: {
        userFloat: userFloat || null
      }
    });
  } catch (error: any) {
    console.error("Error fetching float API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
