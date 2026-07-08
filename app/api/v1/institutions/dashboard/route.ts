import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "INSTITUTION") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userId = user.id;

    // Fetch institution with accounts for all queries
    const institution = await db.institution.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
                contactPerson: true,
                contactPhone: true,
              },
            },
          },
        },
        accounts: {
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                minBalance: true,
              },
            },
            branch: {
              select: { id: true, name: true },
            },
          },
          orderBy: { openedAt: "desc" },
        },
      },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const accountIds = institution.accounts.map((acc) => acc.id);

    // Fetch transactions in parallel with stats query
    const [transactions, allStatTransactions] = await Promise.all([
      db.transaction.findMany({
        where: {
          OR: [
            { accountId: { in: accountIds } },
            { institutionId: institution.id },
          ],
        },
        include: {
          member: {
            include: {
              user: {
                select: { id: true, name: true, email: true, phone: true, image: true },
              },
            },
          },
          account: {
            include: {
              accountType: { select: { id: true, name: true, interestRate: true } },
              branch: { select: { id: true, name: true, location: true } },
            },
          },
          processedByUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 200,
      }),
      db.transaction.findMany({
        where: {
          OR: [
            { accountId: { in: accountIds } },
            { institutionId: institution.id },
          ],
          status: "COMPLETED",
        },
        select: { id: true, type: true, amount: true, transactionDate: true, memberId: true },
      }),
    ]);

    // Compute statistics
    const depositTypes = ["DEPOSIT", "LOAN_REPAYMENT", "FLOAT_ALLOCATION"];
    const withdrawalTypes = ["WITHDRAWAL", "LOAN_DISBURSEMENT"];

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const todayTransactions = allStatTransactions.filter((t) => {
      const d = new Date(t.transactionDate);
      return d >= todayStart && d <= todayEnd;
    });

    const typeMap = new Map<string, { count: number; amount: number }>();
    allStatTransactions.forEach((t) => {
      const existing = typeMap.get(t.type) || { count: 0, amount: 0 };
      typeMap.set(t.type, { count: existing.count + 1, amount: existing.amount + Math.abs(t.amount) });
    });

    const activeAccounts = institution.accounts.filter((a: any) => a.status === "ACTIVE");

    const statistics = {
      totalTransactions: allStatTransactions.length,
      totalDeposits: allStatTransactions.filter((t) => depositTypes.includes(t.type)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalWithdrawals: allStatTransactions.filter((t) => withdrawalTypes.includes(t.type)).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      accountBalance: activeAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0),
      todayTransactions: todayTransactions.length,
      todayAmount: todayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      activeAccounts: activeAccounts.length,
      totalMembers: new Set(allStatTransactions.map((t) => t.memberId).filter(Boolean)).size,
      typeBreakdown: Array.from(typeMap.entries()).map(([type, data]) => ({ type, count: data.count, amount: data.amount })),
    };

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        statistics,
        institutionDetails: institution,
        userId,
      },
    });
  } catch (error: any) {
    console.error("Error fetching institution dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
