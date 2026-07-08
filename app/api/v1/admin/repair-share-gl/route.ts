/**
 * POST /api/v1/admin/repair-share-gl
 *
 * Audits every PURCHASE/TRANSFER_IN share transaction to see whether a
 * matching double-entry journal pair exists.  Optionally repairs the gaps.
 *
 * Query params:
 *   dryRun=true   – report gaps without writing anything (default)
 *   dryRun=false  – write missing journal entries and update COA balances
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

  // Resolve the actual DB user ID by email so the FK on JournalEntry.createdByUserId works
  // even if the JWT id field is stale.
  const dbUser = await db.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Could not resolve current user in database." }, { status: 400 });
  }
  const resolvedUserId = dbUser.id;

  // 1. Ensure both equity and asset COA accounts exist.
  await Promise.all([ensureEquityStructure(), ensureAssetStructure()]);

  const shareCapitalAccount = await db.chartOfAccount.findUnique({
    where: { accountCode: SHARE_CAPITAL_CODE },
  });
  const cashAccount = await db.chartOfAccount.findFirst({
    where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
  });

  if (!shareCapitalAccount) {
    return NextResponse.json(
      { error: "Share capital account (304000) not found even after ensureEquityStructure. Check COA setup." },
      { status: 500 },
    );
  }
  if (!cashAccount) {
    return NextResponse.json(
      { error: `Cash at hand account (${CASH_AT_HAND_CODE}) not found or inactive. Check COA asset structure.` },
      { status: 500 },
    );
  }

  // 2. Find all share purchase transactions (with account for branchId).
  const sharePurchases = await db.shareTransaction.findMany({
    where: {
      transactionType: { in: ["PURCHASE", "TRANSFER_IN"] },
      isReversed: false,
    },
    include: { account: { select: { branchId: true } } },
    orderBy: { transactionDate: "asc" },
  });

  // 3. Find all journal entries that already cover a share purchase reference.
  const coveredRefs = new Set(
    (
      await db.journalEntry.findMany({
        where: {
          accountId: shareCapitalAccount.id,
          creditAmount: { gt: 0 },
        },
        select: { reference: true },
      })
    ).map((je) => je.reference),
  );

  const gaps = sharePurchases.filter(
    (txn) => txn.reference && !coveredRefs.has(txn.reference),
  );

  if (gaps.length === 0) {
    return NextResponse.json({
      message: "No gaps found – all share purchases have GL entries.",
      dryRun,
      checked: sharePurchases.length,
      repaired: 0,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      message: `${gaps.length} share purchase(s) are missing GL entries. Re-run with ?dryRun=false to repair.`,
      dryRun: true,
      checked: sharePurchases.length,
      gaps: gaps.map((txn) => ({
        reference: txn.reference,
        date: txn.transactionDate,
        amount: Number(txn.amount),
        shares: Number(txn.shares),
        accountId: txn.accountId,
      })),
    });
  }

  // 4. Repair: write missing journal entries inside a single transaction.
  let repairedCount = 0;
  const repairLog: Array<{ reference: string; amount: number; error?: string }> = [];

  for (const txn of gaps) {
    try {
      await db.$transaction(async (tx) => {
        // Re-read COA accounts inside the transaction for up-to-date balances.
        const debitAcc = await tx.chartOfAccount.findFirst({
          where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
        });
        const creditAcc = await tx.chartOfAccount.findUnique({
          where: { accountCode: SHARE_CAPITAL_CODE },
        });

        if (!debitAcc || !creditAcc) throw new Error("COA accounts disappeared during repair");

        const amount = Number(txn.amount);
        const entryNumber = `JE-SHARE-REPAIR-${txn.reference}`;
        const entryDate = txn.transactionDate;

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: debitAcc.id,
            debitAmount: amount,
            creditAmount: 0,
            entryDate,
            branchId: txn.account?.branchId ?? null,
            description: `[Repaired] Share purchase - ${txn.reference}`,
            reference: txn.reference ?? entryNumber,
            createdByUserId: resolvedUserId,
          },
        });
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: creditAcc.id,
            debitAmount: 0,
            creditAmount: amount,
            entryDate,
            branchId: txn.account?.branchId ?? null,
            description: `[Repaired] Share purchase - ${txn.reference}`,
            reference: txn.reference ?? entryNumber,
            createdByUserId: resolvedUserId,
          },
        });
        await tx.chartOfAccount.update({
          where: { id: debitAcc.id },
          data: buildAccountBalanceUpdate(debitAcc, { debitAmount: amount }),
        });
        await tx.chartOfAccount.update({
          where: { id: creditAcc.id },
          data: buildAccountBalanceUpdate(creditAcc, { creditAmount: amount }),
        });
      });

      repairedCount++;
      repairLog.push({ reference: txn.reference ?? "", amount: Number(txn.amount) });
    } catch (err: any) {
      repairLog.push({
        reference: txn.reference ?? "",
        amount: Number(txn.amount),
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: `Repaired ${repairedCount} of ${gaps.length} missing GL entries.`,
    dryRun: false,
    checked: sharePurchases.length,
    repaired: repairedCount,
    failed: gaps.length - repairedCount,
    log: repairLog,
  });
}
