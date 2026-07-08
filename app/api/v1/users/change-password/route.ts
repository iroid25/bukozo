import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import bcrypt from "bcryptjs";
import { compare } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// POST /api/v1/users/change-password
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const body = await request.json();
    const { oldPassword, newPassword } = schema.parse(body);

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordMatch = await compare(oldPassword, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        requiresPasswordChange: false,
        passwordLastChanged: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 });
    }
    console.error("Error changing password:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
