// app/api/vault/balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

/**
 * GET /api/vault/balance
 * Get the current user's vault balance
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    // Check if user has permission to view vault balance
    const allowedRoles: UserRole[] = [
      UserRole.ACCOUNTANT,
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
    ];

    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to view vault balance" },
        { status: 403 }
      );
    }

    // Get user's full details including branchId
    const user = await db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        branchId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find active vault for the user's branch
    const vault = await db.vault.findFirst({
      where: {
        branchId: user.branchId || undefined,
        isActive: true,
      },
      select: {
        id: true,
        balance: true,
        physicalCash: true,
        lastVerified: true,
      },
    });

    // If no vault exists, return 0 balance
    if (!vault) {
      return NextResponse.json(
        {
          balance: 0,
          physicalCash: 0,
          lastVerified: null,
          vaultId: null,
          message: "No active vault found for your branch",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        balance: vault.balance,
        physicalCash: vault.physicalCash,
        lastVerified: vault.lastVerified,
        vaultId: vault.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching vault balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch vault balance" },
      { status: 500 }
    );
  }
}
