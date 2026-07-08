import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const { id: branchId } = await params;

    const [
      totalUsers,
      totalAccounts,
      totalLoans,
      activeLoans,
      totalFloatAllocations,
      accountsBalance,
      loansOutstanding,
    ] = await Promise.all([
      db.user.count({ where: { branchId } }),
      db.account.count({ where: { branchId } }),
      db.loan.count({ where: { branchId } }),
      db.loan.count({ where: { branchId, status: { in: ["DISBURSED", "OVERDUE"] } } }),
      db.floatAllocation.count({ where: { branchId } }),
      db.account.aggregate({ where: { branchId, status: "ACTIVE" }, _sum: { balance: true } }),
      db.loan.aggregate({ where: { branchId, status: { in: ["DISBURSED", "OVERDUE"] } }, _sum: { outstandingBalance: true } }),
    ]);

    return successResponse({
      totalUsers,
      totalAccounts,
      totalLoans,
      activeLoans,
      totalFloatAllocations,
      totalAccountsBalance: accountsBalance._sum.balance || 0,
      totalLoansOutstanding: loansOutstanding._sum.outstandingBalance || 0,
    });
  } catch (error: any) {
    console.error("Error fetching branch statistics:", error);
    return ApiErrors.internalError(error.message);
  }
}
