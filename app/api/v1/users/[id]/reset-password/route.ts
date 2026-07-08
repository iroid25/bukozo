import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { hash } from "bcryptjs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = session.user as any;
    if (!["ADMIN", "BRANCHMANAGER"].includes(admin.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: userId } = await params;
    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

    const hashedPassword = await hash(password, 10);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordLastChanged: new Date(), requiresPasswordChange: true },
    });

    return NextResponse.json({ success: true, message: "Password reset successfully." });
  } catch (error: any) {
    console.error("Admin reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 });
  }
}
