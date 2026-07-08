import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchId = session.user.role !== "ADMIN" ? (session.user as any).branchId : undefined;

    const stats = await db.fixedDeposit.aggregate({
      where: {
        status: "ACTIVE",
        isWithdrawn: false,
        ...(branchId && { branchId }),
      },
      _count: true,
      _sum: {
        principalAmount: true,
        maturityAmount: true,
      }
    });

    const totalPrincipal = stats._sum.principalAmount || 0;
    const totalMaturity = stats._sum.maturityAmount || 0;
    return NextResponse.json({
      success: true,
      data: {
        totalCount: stats._count || 0,
        totalPrincipal,
        expectedInterest: Math.max(0, totalMaturity - totalPrincipal),
      }
    });
  } catch (error: any) {
    console.error("Error fetching fixed deposit stats:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
