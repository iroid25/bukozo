import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// GET /api/v1/reports/standing-orders?status=ACTIVE
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);

    if (!branchId && user.role !== "ADMIN") {
      return NextResponse.json({ data: [], summary: { totalRecords: 0, totalMonthlyAmount: 0, activeOrders: 0, pausedOrders: 0 } });
    }

    const status = searchParams.get("status");

    const standingOrders = await db.standingOrder.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(branchId ? { account: { branchId } } : {}),
      },
      include: {
        account: {
          include: {
            member: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        createdBy: { select: { name: true } },
        executions: {
          orderBy: { executionDate: "desc" },
          take: 5,
        },
      },
      orderBy: { nextExecutionDate: "asc" },
    });

    const records = standingOrders.map((so) => ({
      referenceNumber: so.referenceNumber,
      memberName: so.account.member?.user?.name || "N/A",
      accountNumber: so.account.accountNumber,
      beneficiaryName: so.beneficiaryName,
      beneficiaryAccount: so.beneficiaryAccount,
      amount: Number(so.amount),
      frequency: so.frequency,
      startDate: so.startDate.toISOString().split("T")[0],
      endDate: so.endDate?.toISOString().split("T")[0] || "Ongoing",
      nextExecutionDate: so.nextExecutionDate.toISOString().split("T")[0],
      lastExecutionDate: so.lastExecutionDate?.toISOString().split("T")[0] || "Never",
      status: so.status,
      executionCount: so.executionCount,
      failureCount: so.failureCount,
      createdBy: so.createdBy.name,
    }));

    return NextResponse.json({
      data: records,
      summary: {
        totalRecords: records.length,
        totalMonthlyAmount: records
          .filter((r) => r.frequency === "MONTHLY")
          .reduce((sum, r) => sum + r.amount, 0),
        activeOrders: records.filter((r) => r.status === "ACTIVE").length,
        pausedOrders: records.filter((r) => r.status === "PAUSED").length,
      },
    });
  } catch (error) {
    console.error("Standing orders report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
