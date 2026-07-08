import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await db.user.findMany({
      where: {
        phone: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: users.filter((u) => u.phone) });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
