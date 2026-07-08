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

    const whereClause: any = {
      user: {
        ...(user.role !== UserRole.ADMIN && user.branchId ? { branchId: user.branchId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };


    const members = await db.member.findMany({
      where: whereClause,
      select: {
        id: true,
        memberNumber: true,
        fingerprintTemplate: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            branchId: true,
            isActive: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
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
        user: {
          name: "asc",
        },
      },
    });

    const filtered = members.filter((member) =>
      Array.isArray(member.accounts) &&
      member.accounts.some((account) => !account.accountType?.isShareAccount),
    );

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error("Error fetching members API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
