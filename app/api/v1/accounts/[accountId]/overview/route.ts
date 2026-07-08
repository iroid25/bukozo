import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

function sumBy<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;

    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            registrationDate: true,
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        institution: {
          select: {
            id: true,
            institutionNumber: true,
            institutionName: true,
            registrationDate: true,
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        accountType: true,
        branch: true,
        transactions: {
          include: {
            processedByUser: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            transactionDate: "desc",
          },
          take: 50,
        },
        deposits: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            depositDate: "desc",
          },
          take: 20,
        },
        withdrawals: {
          include: {
            handler: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            withdrawalDate: "desc",
          },
          take: 20,
        },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const summary = {
      totalDeposits: sumBy(account.deposits, (deposit) => deposit.amount),
      totalWithdrawals: sumBy(account.withdrawals, (withdrawal) => withdrawal.amount),
      depositsCount: account.deposits.length,
      withdrawalsCount: account.withdrawals.length,
      transactionCount: account.transactions.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        account,
        summary,
      },
    });
  } catch (error) {
    console.error("Error fetching account overview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load account overview",
      },
      { status: 500 },
    );
  }
}
