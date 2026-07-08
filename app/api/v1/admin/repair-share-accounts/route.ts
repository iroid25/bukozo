/**
 * POST /api/v1/admin/repair-share-accounts
 *
 * Backfills ShareAccount records for any existing generic Account records
 * where accountType.isShareAccount = true but no ShareAccount yet exists.
 * This fixes the equity page showing 0 for share products that were opened
 * before the ShareAccount table was introduced.
 *
 * Query params:
 *   dryRun=true   – report gaps without writing anything (default)
 *   dryRun=false  – create missing ShareAccount records
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

  // Find all generic Account records that belong to a share account type
  const shareAccounts = await db.account.findMany({
    where: {
      accountType: { isShareAccount: true },
      status: { not: "CLOSED" },
      memberId: { not: null },
    },
    include: {
      accountType: true,
    },
  });

  if (shareAccounts.length === 0) {
    return NextResponse.json({
      message: "No share Account records found.",
      dryRun,
      checked: 0,
      gaps: [],
    });
  }

  // For each generic share Account, check whether a ShareAccount already exists
  const gaps: Array<{
    accountId: string;
    accountNumber: string;
    memberId: string;
    accountTypeId: string;
    accountTypeName: string;
    balance: number;
    sharesCount: number;
    branchId: string | null;
    sharePrice: number;
    accountNumberTaken: boolean; // accountNumber already used in ShareAccount by a different record
  }> = [];

  for (const acct of shareAccounts) {
    const [existingByMemberType, existingByNumber] = await Promise.all([
      db.shareAccount.findFirst({
        where: { memberId: acct.memberId!, accountTypeId: acct.accountTypeId },
      }),
      db.shareAccount.findUnique({
        where: { accountNumber: acct.accountNumber },
      }),
    ]);

    if (!existingByMemberType) {
      gaps.push({
        accountId: acct.id,
        accountNumber: acct.accountNumber,
        memberId: acct.memberId!,
        accountTypeId: acct.accountTypeId,
        accountTypeName: acct.accountType.name,
        balance: Number(acct.balance),
        sharesCount: Number((acct as any).sharesCount || 0),
        branchId: acct.branchId ?? null,
        sharePrice: Number(acct.accountType.sharePrice || 10000),
        // True when another ShareAccount already owns this accountNumber
        accountNumberTaken: !!existingByNumber,
      });
    }
  }

  if (gaps.length === 0) {
    return NextResponse.json({
      message: "No gaps found – all share Account records have a matching ShareAccount.",
      dryRun,
      checked: shareAccounts.length,
      repaired: 0,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      message: `${gaps.length} share Account(s) are missing a ShareAccount record. Re-run with ?dryRun=false to repair.`,
      dryRun: true,
      checked: shareAccounts.length,
      gaps: gaps.map((g) => ({
        accountNumber: g.accountNumber,
        accountTypeName: g.accountTypeName,
        balance: g.balance,
        sharesCount: g.sharesCount,
        accountNumberTaken: g.accountNumberTaken,
        note: g.accountNumberTaken
          ? `accountNumber "${g.accountNumber}" is already used in ShareAccount — a unique suffix will be generated during repair`
          : undefined,
      })),
    });
  }

  // Repair: create missing ShareAccount records
  let repairedCount = 0;
  const repairLog: Array<{ accountNumber: string; usedNumber?: string; error?: string; stack?: string }> = [];

  for (const gap of gaps) {
    try {
      const computedShares =
        gap.sharesCount > 0
          ? gap.sharesCount
          : gap.balance > 0
            ? Math.max(1, Math.round(gap.balance / gap.sharePrice))
            : 0;

      // If the original accountNumber is taken, generate a collision-free number
      const safeAccountNumber = gap.accountNumberTaken
        ? `SA-REPAIR-${Date.now()}-${gap.accountNumber.slice(-6)}`
        : gap.accountNumber;

      let created = false;

      await db.$transaction(async (tx) => {
        // Double-check inside transaction to avoid races
        const alreadyExists = await tx.shareAccount.findFirst({
          where: { memberId: gap.memberId, accountTypeId: gap.accountTypeId },
        });
        if (alreadyExists) return; // another request already created it

        // Also guard against the number being taken since our gap scan
        const numberTaken = await tx.shareAccount.findUnique({
          where: { accountNumber: safeAccountNumber },
        });
        const finalNumber = numberTaken
          ? `SA-REPAIR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          : safeAccountNumber;

        const shareAcct = await tx.shareAccount.create({
          data: {
            accountNumber: finalNumber,
            memberId: gap.memberId,
            accountTypeId: gap.accountTypeId,
            branchId: gap.branchId ?? undefined,
            shareValue: gap.sharePrice,
            totalValue: gap.balance,
            numberOfShares: computedShares,
            lastTransactionDate: gap.balance > 0 ? new Date() : undefined,
          },
        });

        if (computedShares > 0 && gap.balance > 0) {
          await tx.shareTransaction.create({
            data: {
              accountId: shareAcct.id,
              transactionType: "PURCHASE",
              shares: computedShares,
              shareValue: gap.sharePrice,
              amount: gap.balance,
              sharesBefore: 0,
              sharesAfter: computedShares,
              reference: `SHR-REPAIR-${gap.accountNumber}`,
              description: "[Repaired] Share account backfill",
            },
          });

          // Create Transaction record so the purchase shows in transaction history listings
          await tx.transaction.create({
            data: {
              transactionRef: `SHR-REPAIR-${gap.accountNumber}`,
              type: TransactionType.SHARES_PURCHASE,
              amount: gap.balance,
              status: TransactionStatus.COMPLETED,
              description: `[Repaired] Share purchase — ${computedShares} share(s) @ ${gap.sharePrice} each`,
              transactionDate: new Date(),
              accountId: gap.accountId,
              memberId: gap.memberId,
              branchId: gap.branchId ?? undefined,
              channel: "CASH",
            },
          });
        }

        created = true;
        repairLog.push({ accountNumber: gap.accountNumber, usedNumber: finalNumber });
      });

      if (created) repairedCount++;
    } catch (err: any) {
      repairLog.push({
        accountNumber: gap.accountNumber,
        error: err?.message ?? "Unknown error",
        stack: err?.stack ?? undefined,
      });
    }
  }

  return NextResponse.json({
    message: `Repaired ${repairedCount} of ${gaps.length} missing ShareAccount records.`,
    dryRun: false,
    checked: shareAccounts.length,
    repaired: repairedCount,
    failed: gaps.length - repairedCount,
    log: repairLog,
  });
}
