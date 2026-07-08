import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "MEMBER") {
      return NextResponse.json({ error: "Access denied - Member role required" }, { status: 403 });
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
        accounts: {
          include: {
            accountType: true,
            branch: true,
            _count: { select: { transactions: true } },
          },
        },
        loans: {
          include: {
            loanApplication: { include: { loanProduct: true } },
            branch: true,
            _count: { select: { repayments: true } },
          },
          orderBy: { disbursementDate: "desc" },
        },
        _count: { select: { accounts: true, loans: true } },
      },
    });

    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const [recentTransactions, loanRecords] = await Promise.all([
      db.transaction.findMany({
        where: { memberId: member.id },
        include: {
          account: { include: { accountType: true, branch: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 10,
      }),
      db.loan.findMany({
        where: { memberId: member.id },
        include: { _count: { select: { repayments: true } } },
      }),
    ]);

    const totalBalance = member.accounts.reduce((s, a) => s + a.balance, 0);
    const accountsByType = member.accounts.reduce((acc, account) => {
      const typeName = account.accountType.name;
      const existing = acc.find((item: any) => item.accountType === typeName);
      if (existing) { existing.count += 1; existing.totalBalance += account.balance; }
      else acc.push({ accountType: typeName, count: 1, totalBalance: account.balance });
      return acc;
    }, [] as any[]);

    const activeLoans = loanRecords.filter((l) => l.status === "DISBURSED" || l.status === "OVERDUE");
    const loanSummary = {
      totalLoans: loanRecords.length,
      activeLoans: activeLoans.length,
      totalLoanAmount: loanRecords.reduce((s, l) => s + l.amountGranted, 0),
      outstandingBalance: loanRecords.reduce((s, l) => s + l.outstandingBalance, 0),
      totalRepaid: loanRecords.reduce((s, l) => s + l.amountPaid, 0),
      overdueLoans: loanRecords.filter((l) => l.status === "OVERDUE").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        member,
        accountOverview: {
          totalBalance,
          accountsCount: member.accounts.length,
          accountsByType,
          accounts: member.accounts,
        },
        loanSummary,
        recentTransactions,
        currentUserId: user.id,
      },
    });
  } catch (error) {
    console.error("Error fetching member account dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch account data" }, { status: 500 });
  }
}
