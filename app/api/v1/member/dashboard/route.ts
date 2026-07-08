// app/api/v1/member/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { TransactionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "MEMBER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parallel fetching for performance
    const [member, accounts, transactions, loans] = await Promise.all([
      db.member.findUnique({
        where: { userId: user.id },
        include: {
          user: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              image: true,
              branch: {
                select: { name: true }
              }
            }
          }
        }
      }),
      db.account.findMany({
        where: { 
          member: { userId: user.id },
          status: "ACTIVE"
        },
        include: {
          accountType: {
            select: { name: true }
          }
        }
      }),
      db.transaction.findMany({
        where: {
          member: { userId: user.id },
          status: TransactionStatus.COMPLETED
        },
        orderBy: { transactionDate: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          amount: true,
          transactionDate: true,
          description: true,
          transactionRef: true
        }
      }),
      db.loan.findMany({
        where: {
          member: { userId: user.id },
          status: { in: ["DISBURSED", "OVERDUE"] }
        },
        select: {
          id: true,
          loanApplicationId: true,
          amountGranted: true,
          outstandingBalance: true,
          dueDate: true,
          status: true,
          loanApplication: {
            select: {
              applicationDate: true,
              loanProduct: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 }
      );
    }

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLoanOutstanding = loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0);

    // Build response
    const dashboard = {
      profile: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.user.name || `${member.user.firstName} ${member.user.lastName}`,
        email: member.user.email,
        phone: member.user.phone,
        avatar: member.user.image,
        branch: member.user.branch?.name,
        joinDate: member.registrationDate
      },
      stats: {
        totalBalance,
        accountCount: accounts.length,
        loanCount: loans.length,
        totalLoanOutstanding
      },
      accounts: accounts.map(acc => ({
        id: acc.id,
        number: acc.accountNumber,
        type: acc.accountType.name,
        balance: acc.balance,
        status: acc.status
      })),
      recentTransactions: transactions.map(t => ({
        id: t.id,
        ref: t.transactionRef,
        type: t.type,
        amount: t.amount,
        date: t.transactionDate.toISOString(),
        description: t.description || t.type
      })),
      activeLoans: loans.map(l => ({
        id: l.id,
        loanNumber: l.loanApplicationId.slice(0, 8).toUpperCase(),
        productName: l.loanApplication?.loanProduct?.name || "Loan",
        amount: l.amountGranted,
        outstanding: l.outstandingBalance,
        dueDate: l.dueDate.toISOString(),
        status: l.status,
        applicationDate: l.loanApplication?.applicationDate?.toISOString?.() || null
      }))
    };

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error("❌ Error fetching member dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
