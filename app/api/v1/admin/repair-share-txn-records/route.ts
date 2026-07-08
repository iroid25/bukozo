/**
 * POST /api/v1/admin/repair-share-txn-records
 *
 * Finds all ShareTransaction (PURCHASE/TRANSFER_IN) records that have no
 * corresponding Transaction row (the main ledger used by transaction listings).
 * Creates the missing Transaction rows so share purchases appear in
 * transaction history pages alongside deposits, withdrawals, etc.
 *
 * Query params:
 *   dryRun=true   – report gaps without writing anything (default)
 *   dryRun=false  – create missing Transaction records
 *
 * ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole, TransactionType, TransactionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") !== "false";

  // Load all share purchase / transfer-in transactions
  const shareTxns = await db.shareTransaction.findMany({
    where: {
      transactionType: { in: ["PURCHASE", "TRANSFER_IN"] },
      isReversed: false,
      reference: { not: null },
    },
    include: {
      account: {
        include: {
          member: {
            include: {
              accounts: {
                where: { accountType: { isShareAccount: true }, status: { not: "CLOSED" } },
                select: { id: true, accountNumber: true, branchId: true },
              },
            },
          },
        },
      },
    },
    orderBy: { transactionDate: "asc" },
  });

  // Find all Transaction refs that already exist for share purchases
  const existingRefs = new Set(
    (
      await db.transaction.findMany({
        where: {
          type: TransactionType.SHARES_PURCHASE,
          transactionRef: { in: shareTxns.map((t) => t.reference!).filter(Boolean) },
        },
        select: { transactionRef: true },
      })
    ).map((t) => t.transactionRef),
  );

  const gaps = shareTxns
    .filter((txn) => txn.reference && !existingRefs.has(txn.reference!))
    .map((txn) => {
      // Find the generic Account record for this member's share account
      // by matching accountNumber (the repair uses the same number for both tables)
      const genericAccount =
        txn.account.member.accounts.find(
          (a) => a.accountNumber === txn.account.accountNumber,
        ) ?? txn.account.member.accounts[0];

      return {
        reference: txn.reference!,
        amount: Number(txn.amount),
        shares: Number(txn.shares),
        shareValue: Number(txn.shareValue),
        memberId: txn.account.memberId,
        genericAccountId: genericAccount?.id ?? null,
        branchId: txn.account.branchId ?? genericAccount?.branchId ?? null,
        transactionDate: txn.transactionDate,
      };
    });

  if (gaps.length === 0) {
    return NextResponse.json({
      message: "No gaps — all share purchases already have a Transaction record.",
      dryRun,
      checked: shareTxns.length,
      repaired: 0,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      message: `${gaps.length} share purchase(s) are missing a Transaction record. Re-run with ?dryRun=false to repair.`,
      dryRun: true,
      checked: shareTxns.length,
      gaps: gaps.map((g) => ({
        reference: g.reference,
        amount: g.amount,
        shares: g.shares,
        memberId: g.memberId,
        genericAccountId: g.genericAccountId,
        note: !g.genericAccountId
          ? "WARNING: no generic Account found for this member — Transaction cannot be created"
          : undefined,
      })),
    });
  }

  // Repair
  let repairedCount = 0;
  const repairLog: Array<{ reference: string; error?: string }> = [];

  for (const gap of gaps) {
    if (!gap.genericAccountId) {
      repairLog.push({
        reference: gap.reference,
        error: "No generic Account record found for this member — skipped",
      });
      continue;
    }

    try {
      await db.transaction.create({
        data: {
          transactionRef: gap.reference,
          type: TransactionType.SHARES_PURCHASE,
          amount: gap.amount,
          status: TransactionStatus.COMPLETED,
          description: `[Repaired] Share purchase — ${gap.shares} share(s) @ ${gap.shareValue} each`,
          transactionDate: gap.transactionDate,
          accountId: gap.genericAccountId,
          memberId: gap.memberId,
          branchId: gap.branchId ?? undefined,
          channel: "CASH",
        },
      });

      repairedCount++;
      repairLog.push({ reference: gap.reference });
    } catch (err: any) {
      repairLog.push({
        reference: gap.reference,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: `Repaired ${repairedCount} of ${gaps.length} missing Transaction records.`,
    dryRun: false,
    checked: shareTxns.length,
    repaired: repairedCount,
    failed: gaps.length - repairedCount,
    log: repairLog,
  });
}
