import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [user, recentActivity] = await Promise.all([
      db.user.findUnique({
        where: { id },
        include: {
          branch: true,
          member: {
            include: {
              accounts: { include: { accountType: true } },
              fixedDeposits: { orderBy: { createdAt: "desc" } },
            },
          },
          deposits: {
            orderBy: { depositDate: "desc" },
            take: 20,
            include: {
              member: { select: { memberNumber: true } },
              account: { select: { accountNumber: true } },
            },
          },
          withdrawals: {
            orderBy: { withdrawalDate: "desc" },
            take: 20,
            include: {
              member: { select: { memberNumber: true } },
              account: { select: { accountNumber: true } },
            },
          },
          loanRepayments: {
            orderBy: { repaymentDate: "desc" },
            take: 20,
            include: { member: { select: { memberNumber: true } } },
          },
          userFloat: true,
          floatTransactions: { orderBy: { transactionDate: "desc" }, take: 20 },
          transactions: { orderBy: { transactionDate: "desc" }, take: 20 },
        },
      }),
      db.auditLog.findMany({
        where: { userId: id },
        orderBy: { timestamp: "desc" },
        take: 10,
      }),
    ]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const activityData = recentActivity.map((log) => ({
      action: log.action.replace(/_/g, " ").toLowerCase(),
      details: log.details || `${log.entityType} operation`,
      timestamp: log.timestamp,
    }));

    return NextResponse.json({
      success: true,
      data: { user, recentActivity: activityData },
    });
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}
