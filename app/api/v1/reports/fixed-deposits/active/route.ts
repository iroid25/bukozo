import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// GET /api/v1/reports/fixed-deposits/active
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branchId = user.role !== "ADMIN" ? user.branchId : undefined;

    const deposits = await db.fixedDeposit.findMany({
      where: {
        status: "ACTIVE",
        ...(branchId && { branchId }),
      },
      include: {
        member: { include: { user: true } },
        institution: true,
        branch: true,
      },
      orderBy: { maturityDate: "asc" },
    });

    const records = deposits.map((fd) => {
      const daysToMaturity = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: fd.id,
        accountNumber: fd.accountNumber,
        memberName: fd.member?.user?.name || fd.institution?.institutionName || "N/A",
        principalAmount: fd.principalAmount,
        interestRate: fd.interestRate,
        startDate: fd.startDate.toISOString(),
        maturityDate: fd.maturityDate.toISOString(),
        daysToMaturity,
        branch: fd.branch?.name || "N/A",
      };
    });

    return NextResponse.json({
      success: true,
      data: records,
      summary: { 
        totalRecords: records.length, 
        totalAmount: records.reduce((sum, r) => sum + r.principalAmount, 0) 
      },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
