import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { success: false, error: "Email and token are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Token is valid",
    });
  } catch (error) {
    console.error("Verify token error:", error);
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
