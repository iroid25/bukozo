/**
 * POST /api/v1/admin/repair-share-account-drift
 *
 * Some share-linked Account rows were funded through the generic
 * /api/v1/deposits or /api/v1/transfers/internal endpoints instead of
 * /api/v1/shares/purchase — those endpoints credit Account.balance but never
 * touch ShareAccount.totalValue/numberOfShares, never create a
 * ShareTransaction, and never post a journal entry to 304000 Share Capital.
 * (Both endpoints now reject share accounts outright, so this should not
 * recur — this tool reconciles drift that already happened.)
 *
 * For every share-linked Account whose balance exceeds its ShareAccount's
 * totalValue, treats the difference as an unrecorded purchase and — in
 * repair mode — records it exactly as /api/v1/shares/purchase would have:
 * increments ShareAccount, creates a ShareTransaction, and posts the missing
 * double-entry journal pair crediting 304000.
 *
 * Query params:
 *   dryRun=true   – report gaps without writing anything (default)
 *   dryRun=false  – write missing ShareTransaction/journal entries and update balances
 *
 * ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE, ensureAssetStructure } from "@/lib/services/asset-structure";
import { ensureEquityStructure, SHARE_CAPITAL_CODE } from "@/lib/services/equity-structure";

export const dynamic = "force-dynamic";

const WHOLE_SHARE_TOLERANCE = 0.000001;

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

  const dbUser = await db.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Could not resolve current user in database." }, { status: 400 });
  }
  const resolvedUserId = dbUser.id;

  // 1. Load every share-linked generic Account alongside its ShareAccount
  //    (linked by accountNumber, the convention /api/v1/shares/purchase uses
  //    when creating the paired Account row).
  const shareLinkedAccounts = await db.account.findMany({
    where: { accountType: { isShareAccount: true } },
    select: { id: true, accountNumber: true, balance: true, memberId: true, branchId: true },
  });

  const shareAccounts = await db.shareAccount.findMany({
    where: { accountNumber: { in: shareLinkedAccounts.map((a) => a.accountNumber) } },
  });
  const shareAccountByNumber = new Map(shareAccounts.map((sa) => [sa.accountNumber, sa]));

  type Gap = {
    accountId: string;
    accountNumber: string;
    memberId: string | null;
    branchId: string | null;
    shareAccountId: string;
    difference: number;
    shareValue: number;
    computedShares: number;
    wholeShareMultiple: boolean;
    contextDescriptions: string[];
  };

  const gaps: Gap[] = [];
  for (const acc of shareLinkedAccounts) {
    const shareAccount = shareAccountByNumber.get(acc.accountNumber);
    if (!shareAccount) continue;

    const difference = Number(acc.balance) - Number(shareAccount.totalValue);
    if (difference <= 0.01) continue; // no drift, or Account.balance is behind (different issue, not this tool's job)

    const shareValue = Number(shareAccount.shareValue || 0);
    const computedShares = shareValue > 0 ? difference / shareValue : 0;
    const wholeShareMultiple =
      shareValue > 0 && Math.abs(computedShares - Math.round(computedShares)) < WHOLE_SHARE_TOLERANCE;

    const recentTxns = await db.transaction.findMany({
      where: { accountId: acc.id },
      select: { description: true },
      orderBy: { transactionDate: "desc" },
      take: 5,
    });

    gaps.push({
      accountId: acc.id,
      accountNumber: acc.accountNumber,
      memberId: acc.memberId,
      branchId: acc.branchId,
      shareAccountId: shareAccount.id,
      difference,
      shareValue,
      computedShares: wholeShareMultiple ? Math.round(computedShares) : computedShares,
      wholeShareMultiple,
      contextDescriptions: recentTxns.map((t) => t.description || "").filter(Boolean),
    });
  }

  if (gaps.length === 0) {
    return NextResponse.json({
      message: "No drift found — every share-linked Account.balance matches its ShareAccount.totalValue.",
      dryRun,
      checked: shareLinkedAccounts.length,
      repaired: 0,
    });
  }

  const repairable = gaps.filter((g) => g.wholeShareMultiple);
  const needsManualReview = gaps.filter((g) => !g.wholeShareMultiple);

  if (dryRun) {
    return NextResponse.json({
      message: `${gaps.length} share account(s) have unrecorded balance vs ShareAccount.totalValue drift. Re-run with ?dryRun=false to repair the ${repairable.length} whole-share-multiple case(s).`,
      dryRun: true,
      checked: shareLinkedAccounts.length,
      repairable: repairable.map((g) => ({
        accountNumber: g.accountNumber,
        memberId: g.memberId,
        difference: g.difference,
        computedShares: g.computedShares,
        shareValue: g.shareValue,
        context: g.contextDescriptions,
      })),
      needsManualReview: needsManualReview.map((g) => ({
        accountNumber: g.accountNumber,
        memberId: g.memberId,
        difference: g.difference,
        shareValue: g.shareValue,
        note: "Difference is not a whole multiple of shareValue — skipped, requires manual review.",
        context: g.contextDescriptions,
      })),
    });
  }

  // 2. Repair mode — one purchase-equivalent posting per gap.
  await Promise.all([ensureEquityStructure(), ensureAssetStructure()]);

  let repairedCount = 0;
  const repairLog: Array<{ accountNumber: string; amount: number; error?: string }> = [];

  for (const gap of repairable) {
    try {
      await db.$transaction(async (tx) => {
        const shareAccount = await tx.shareAccount.findUniqueOrThrow({ where: { id: gap.shareAccountId } });

        const updatedShareAccount = await tx.shareAccount.update({
          where: { id: gap.shareAccountId },
          data: {
            numberOfShares: { increment: gap.computedShares },
            totalValue: { increment: gap.difference },
            lastTransactionDate: new Date(),
          },
        });

        const reference = `SHR-REPAIR-DRIFT-${gap.accountNumber}-${Date.now()}`;

        await tx.shareTransaction.create({
          data: {
            accountId: gap.shareAccountId,
            transactionType: "PURCHASE",
            shares: gap.computedShares,
            shareValue: gap.shareValue,
            amount: gap.difference,
            sharesBefore: shareAccount.numberOfShares,
            sharesAfter: updatedShareAccount.numberOfShares,
            description: "[Repaired] Unrecorded share purchase — reconciled from Account.balance drift",
            reference,
            tellerId: resolvedUserId,
          },
        });

        const debitAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
        });
        const shareCapitalAccount = await tx.chartOfAccount.findUnique({
          where: { accountCode: SHARE_CAPITAL_CODE },
        });

        if (!debitAccount || !shareCapitalAccount) {
          throw new Error("Required COA accounts (cash-at-hand / share-capital) not found for repair posting.");
        }

        const entryNumber = `JE-SHARE-REPAIR-${reference}`;
        const entryDate = new Date();

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: debitAccount.id,
            debitAmount: gap.difference,
            creditAmount: 0,
            entryDate,
            branchId: gap.branchId,
            description: `[Repaired] Share purchase drift reconciliation - ${gap.accountNumber}`,
            reference,
            createdByUserId: resolvedUserId,
          },
        });
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: shareCapitalAccount.id,
            debitAmount: 0,
            creditAmount: gap.difference,
            entryDate,
            branchId: gap.branchId,
            description: `[Repaired] Share purchase drift reconciliation - ${gap.accountNumber}`,
            reference,
            createdByUserId: resolvedUserId,
          },
        });
        await tx.chartOfAccount.update({
          where: { id: debitAccount.id },
          data: buildAccountBalanceUpdate(debitAccount, { debitAmount: gap.difference }),
        });
        await tx.chartOfAccount.update({
          where: { id: shareCapitalAccount.id },
          data: buildAccountBalanceUpdate(shareCapitalAccount, { creditAmount: gap.difference }),
        });
      });

      repairedCount++;
      repairLog.push({ accountNumber: gap.accountNumber, amount: gap.difference });
    } catch (err: any) {
      repairLog.push({
        accountNumber: gap.accountNumber,
        amount: gap.difference,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: `Repaired ${repairedCount} of ${repairable.length} whole-share-multiple gap(s). ${needsManualReview.length} case(s) still need manual review.`,
    dryRun: false,
    checked: shareLinkedAccounts.length,
    repaired: repairedCount,
    failed: repairable.length - repairedCount,
    log: repairLog,
    needsManualReview: needsManualReview.map((g) => ({
      accountNumber: g.accountNumber,
      difference: g.difference,
    })),
  });
}
