import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, otp } = body;

    if (!userId || !otp) {
      return NextResponse.json(
        { error: "userId and otp are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (user?.token !== otp) {
      return NextResponse.json({ status: 403 }, { status: 403 });
    }

    await db.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        token: null,
      },
    });

    return NextResponse.json({ status: 200 });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return NextResponse.json({ status: 403 }, { status: 403 });
  }
}
