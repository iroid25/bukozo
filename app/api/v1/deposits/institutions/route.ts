import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    // Show any institution that has at least one active account at the branch.
    // Do NOT gate on isApproved / user.isActive — institutions still being processed
    // should still be transactable as long as they have an open account.
    const accountFilter =
      user.role !== UserRole.ADMIN && user.branchId
        ? { some: { status: "ACTIVE", branchId: user.branchId } }
        : { some: { status: "ACTIVE" } };

    const whereClause: any = {
      accounts: accountFilter,
      ...(search
        ? {
            OR: [
              { institutionName: { contains: search, mode: "insensitive" } },
              { institutionNumber: { contains: search, mode: "insensitive" } },
              { institutionEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const institutions = await db.institution.findMany({
      where: whereClause,
      select: {
        id: true,
        institutionNumber: true,
        institutionName: true,
        institutionType: true,
        institutionEmail: true,
        accounts: {
          where: {
            status: "ACTIVE",
            ...(user.role !== UserRole.ADMIN && user.branchId
              ? { branchId: user.branchId }
              : {}),
          },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            accountType: {
              select: {
                name: true,
                isShareAccount: true,
                canWithdraw: true,
                hasFixedPeriod: true,
              },
            },
          },
        },
      },
      orderBy: {
        institutionName: "asc",
      },
    });

    return NextResponse.json(institutions);
  } catch (error: any) {
    console.error("Error fetching institutions API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
