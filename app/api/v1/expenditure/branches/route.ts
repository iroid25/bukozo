import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

// GET /api/v1/expenditure/branches - Get branches for expenditure
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    // Admin can see all branches
    if (user.role === UserRole.ADMIN) {
      const branches = await db.branch.findMany({
        select: {
          id: true,
          name: true,
          location: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ data: branches });
    }

    // Other users can only see their branch
    if (!user.branchId) {
      return NextResponse.json({ data: [] });
    }

    const branch = await db.branch.findUnique({
      where: { id: user.branchId },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    return NextResponse.json({ data: branch ? [branch] : [] });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}
