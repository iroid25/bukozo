import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;


async function parseParams(request: NextRequest, method: "GET" | "POST") {
  if (method === "GET") {
    const { searchParams } = new URL(request.url);
    return Object.fromEntries(searchParams.entries());
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

async function generateReport(request: NextRequest, method: "GET" | "POST") {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await parseParams(request, method);
    params.branchId = user.role !== "ADMIN" ? user.branchId : (params.branchId || undefined);
    // Account is the master balance source. SavingsAccount.balance is retired (TXN-001).
    // Exclude CLOSED accounts by default unless caller explicitly passes a status filter.
    const where: any = {
      accountType: { isShareAccount: false, hasFixedPeriod: false },
      status: { not: "CLOSED" },
    };

    if (params.branchId) where.branchId = params.branchId;
    if (params.status) where.status = params.status;
    if (params.accountTypeId) where.accountTypeId = params.accountTypeId;
    if (params.isDormant !== undefined) {
      const isDormant = params.isDormant === "true" || params.isDormant === true;
      where.status = isDormant ? "DORMANT" : { not: "DORMANT" };
    }
    if (params.isOverdrawn !== undefined) {
      const isOverdrawn = params.isOverdrawn === "true" || params.isOverdrawn === true;
      where.balance = isOverdrawn ? { lt: 0 } : { gte: 0 };
    }

    const accounts = await db.account.findMany({
      where,
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        accountType: {
          select: {
            name: true,
          },
        },
        branch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ balance: "desc" }, { accountNumber: "asc" }],
    });

    const now = new Date();
    const records = accounts.map((account) => {
      const isDormant = account.status === "DORMANT";
      const isOverdrawn = account.balance < 0;
      const lastTxDate = (account as any).lastTransactionDate
        ? new Date((account as any).lastTransactionDate)
        : null;
      const daysSinceLastActivity = lastTxDate
        ? Math.floor((now.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name || "N/A",
        accountType: account.accountType?.name || "Savings",
        branch: account.branch?.name || "N/A",
        balance: Number(account.balance),
        availableBalance: Number(account.balance),
        status: account.status,
        openedDate: account.openedAt ? account.openedAt.toISOString().split("T")[0] : "N/A",
        lastTransactionDate: lastTxDate ? lastTxDate.toISOString().split("T")[0] : "N/A",
        daysSinceLastActivity,
        isDormant: isDormant ? "Yes" : "No",
        isOverdrawn: isOverdrawn ? "Yes" : "No",
      };
    });

    const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
    const totalAvailableBalance = totalBalance;
    const summary = {
      totalAccounts: accounts.length,
      totalBalance,
      totalAvailableBalance,
      activeAccounts: accounts.filter((account) => account.status === "ACTIVE").length,
      dormantAccounts: accounts.filter((account) => account.status === "DORMANT").length,
      overdrawnAccounts: accounts.filter((account) => account.balance < 0).length,
      averageBalance: accounts.length > 0 ? totalBalance / accounts.length : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        data: records,
        summary,
      },
    });
  } catch (error) {
    console.error("Error generating savings performance report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate savings performance report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return generateReport(request, "GET");
}

export async function POST(request: NextRequest) {
  return generateReport(request, "POST");
}
