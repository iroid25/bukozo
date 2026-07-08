import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

/**
 * GET /api/v1/reserve
 * Fetch the Organisational Reserve (Main Office Vault)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reserve = await db.vault.findFirst({
      where: {
        location: "Main Office",
        isActive: true,
      },
      include: {
        branch: true,
        custodian: true,
      }
    });

    if (!reserve) {
      return NextResponse.json(
        { error: "Organisational Reserve not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: reserve });
  } catch (error) {
    console.error("Error fetching Organisational Reserve:", error);
    return NextResponse.json(
      { error: "Failed to fetch reserve" },
      { status: 500 }
    );
  }
}
