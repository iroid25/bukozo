import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userFloat = await db.userFloat.findUnique({
      where: { userId: session.user.id }
    });

    if (!userFloat) {
      // Create a float record if it doesn't exist (initial state)
      const newFloat = await db.userFloat.create({
        data: {
          userId: session.user.id,
          balance: 0
        }
      });
      return NextResponse.json({
        success: true,
        float: newFloat
      });
    }

    return NextResponse.json({
      success: true,
      float: userFloat
    });
  } catch (error: any) {
    console.error("❌ Error fetching user float:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
