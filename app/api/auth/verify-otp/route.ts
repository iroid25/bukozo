import { db } from "@/prisma/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.token !== otp) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Optional: Check expiry if schema supported it.
    
    return NextResponse.json({ message: "Identity verified successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error verifying token:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
