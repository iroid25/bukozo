// app/api/v1/account-types/for-creation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { normalizeAccountTypeName } from "@/types/accountTypes";

// GET /api/v1/account-types/for-creation - Fetch simplified account types for account creation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountTypes = await db.accountType.findMany({
      select: {
        id: true,
        name: true,
        interestRate: true,
        minBalance: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Normalize account type names
    const normalized = accountTypes.map((x) => ({
      ...x,
      name: normalizeAccountTypeName(x.name),
    }));

    return NextResponse.json({
      data: normalized,
    });
  } catch (error) {
    console.error("Error fetching account types for creation:", error);
    return NextResponse.json(
      { error: "Failed to fetch account types" },
      { status: 500 }
    );
  }
}