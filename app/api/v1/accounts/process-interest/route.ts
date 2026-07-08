import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { AccountStatus, TransactionType, TransactionStatus } from "@prisma/client";

// POST /api/v1/accounts/process-interest
// Admin-only: posts periodic interest for active savings accounts (Compulsory, Junior).
// Fixed Savings interest is handled at maturity via expectedInterest — not included here.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can process interest" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;

    const now = new Date();
    const year = body.year ? Number(body.year) : now.getFullYear();
    const month = body.month ? Number(body.month) : now.getMonth() + 1; // 1–12
    // interestPeriod to process: "MONTHLY" or "ANNUALLY"
    const period: "MONTHLY" | "ANNUALLY" = body.period === "MONTHLY" ? "MONTHLY" : "ANNUALLY";

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "month must be 1–12" }, { status: 400 });
    }

    const periodLabel =
      period === "MONTHLY"
        ? `${year}-${String(month).padStart(2, "0")}`
        : `${year}`;

    // Find active savings accounts with positive interest rate, excluding fixed-period and share accounts
    const accounts = await db.account.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        accountType: {
          interestRate: { gt: 0 },
          hasFixedPeriod: false,
          isShareAccount: false,
          interestPeriod: period,
        },
      },
      include: {
        accountType: {
          select: { id: true, name: true, interestRate: true, interestPeriod: true },
        },
        member: { include: { user: { select: { name: true } } } },
      },
    });

    const results: {
      accountId: string;
      accountNumber?: string;
      memberName?: string;
      productName: string;
      balance: number;
      interestRate: number;
      interestAmount: number;
      status: "posted" | "skipped" | "already_posted";
      reason?: string;
    }[] = [];

    let totalInterest = 0;
    let postedCount = 0;
    let skippedCount = 0;

    for (const account of accounts) {
      const rate = account.accountType.interestRate;
      const balance = account.balance;

      if (balance <= 0) {
        results.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          memberName: account.member?.user?.name,
          productName: account.accountType.name,
          balance,
          interestRate: rate,
          interestAmount: 0,
          status: "skipped",
          reason: "Zero or negative balance",
        });
        skippedCount++;
        continue;
      }

      // Calculate interest
      let interestAmount: number;
      if (period === "MONTHLY") {
        interestAmount = Math.round((balance * rate) / 100 / 12);
      } else {
        // ANNUALLY
        interestAmount = Math.round((balance * rate) / 100);
      }

      const descriptionKey = `Interest [${periodLabel}] - ${account.accountNumber}`;

      // Prevent double-posting for the same period
      const existing = await db.transaction.findFirst({
        where: {
          accountId: account.id,
          type: TransactionType.OTHER,
          description: { contains: `Interest [${periodLabel}]` },
          status: TransactionStatus.COMPLETED,
        },
      });

      if (existing) {
        results.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          memberName: account.member?.user?.name,
          productName: account.accountType.name,
          balance,
          interestRate: rate,
          interestAmount,
          status: "already_posted",
          reason: "Interest already posted for this period",
        });
        skippedCount++;
        continue;
      }

      if (!dryRun) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const transactionRef = `INT-${timestamp}-${random}`;

        await db.$transaction([
          db.account.update({
            where: { id: account.id },
            data: { balance: { increment: interestAmount } },
          }),
          db.transaction.create({
            data: {
              transactionRef,
              type: TransactionType.OTHER,
              amount: interestAmount,
              status: TransactionStatus.COMPLETED,
              description: descriptionKey,
              currency: "UGX",
              branchId: account.branchId,
              memberId: account.memberId ?? null,
              accountId: account.id,
              processedByUserId: user.id,
              channel: "SYSTEM",
            },
          }),
          db.auditLog.create({
            data: {
              userId: user.id,
              action: "UPDATE",
              entityType: "Account",
              entityId: account.id,
              details: `Interest UGX ${interestAmount} credited for period ${periodLabel} at ${rate}% ${period}`,
            },
          }),
        ]);
      }

      results.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name,
        productName: account.accountType.name,
        balance,
        interestRate: rate,
        interestAmount,
        status: "posted",
      });
      totalInterest += interestAmount;
      postedCount++;
    }

    if (!dryRun && postedCount > 0) {
      const configKey =
        period === "MONTHLY"
          ? "LAST_MONTHLY_INTEREST_DATE"
          : "LAST_ANNUAL_INTEREST_DATE";
      await db.systemConfiguration.upsert({
        where: { key: configKey },
        create: {
          key: configKey,
          value: new Date().toISOString(),
          description: `Last time ${period.toLowerCase()} interest was posted`,
          category: "PERIODIC",
        },
        update: { value: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      dryRun,
      period: periodLabel,
      interestPeriod: period,
      summary: {
        eligible: accounts.length,
        posted: postedCount,
        skipped: skippedCount,
        totalInterest,
      },
      details: results,
    });
  } catch (error: any) {
    console.error("process-interest error:", error);
    return NextResponse.json({ error: error.message || "Failed to process interest" }, { status: 500 });
  }
}
