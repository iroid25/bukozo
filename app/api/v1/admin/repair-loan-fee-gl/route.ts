/**
 * POST /api/v1/admin/repair-loan-fee-gl
 *
 * Finds loan applications that had a processing fee collected but are missing
 * a double-entry JournalEntry pair, then creates the missing entries.
 * Also seeds the income + asset COA structure so future fees are recorded correctly.
 *
 * Strategy (in order):
 *  1. Find LoanApplication rows where applyLoanProcessingFee=true (the source of truth)
 *  2. Check whether a JournalEntry credit exists on the fee account (401002) with
 *     the matching reference LPF-APP-{shortId}
 *  3. Also scan IncomeRecord rows by budget category code as a secondary source
 *
 * Query params:
 *   dryRun=true  – report gaps only (default)
 *   dryRun=false – create missing GL entries
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
import { ensureIncomeStructure, LOAN_PROCESSING_FEES_CODE } from "@/lib/services/income-structure";

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

  // Resolve actual DB user by email to avoid stale JWT id
  const dbUser = await db.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Could not resolve current user in database." }, { status: 400 });
  }

  // Always seed COA structure so future fees have accounts to post to
  await Promise.all([ensureIncomeStructure(), ensureAssetStructure()]);

  const feeAccount = await db.chartOfAccount.findFirst({
    where: { accountCode: LOAN_PROCESSING_FEES_CODE, isActive: true },
  });
  const cashAccount = await db.chartOfAccount.findFirst({
    where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
  });

  if (!feeAccount || !cashAccount) {
    return NextResponse.json(
      { error: "COA accounts still missing after ensureIncomeStructure/ensureAssetStructure. Check DB." },
      { status: 500 },
    );
  }

  // ── Strategy 1: Loan applications with a processing fee ──
  const loanAppsWithFee = await db.loanApplication.findMany({
    where: {
      applyLoanProcessingFee: true,
      loanProcessingFeePercentage: { gt: 0 },
    },
    select: {
      id: true,
      amountApplied: true,
      loanProcessingFeePercentage: true,
      applicationDate: true,
      member: { select: { user: { select: { name: true, branchId: true } } } },
    },
    orderBy: { applicationDate: "asc" },
  });

  // ── Strategy 2: IncomeRecord rows linked to the fee budget category ──
  const incomeRecords = await db.incomeRecord.findMany({
    where: {
      budgetCategory: { code: LOAN_PROCESSING_FEES_CODE },
    },
    select: {
      id: true,
      amount: true,
      referenceNumber: true,
      recordDate: true,
      branchId: true,
      description: true,
    },
    orderBy: { recordDate: "asc" },
  });

  // All JournalEntry credits already on the fee account (to detect already-covered gaps)
  const coveredRefs = new Set(
    (
      await db.journalEntry.findMany({
        where: {
          accountId: feeAccount.id,
          creditAmount: { gt: 0 },
        },
        select: { reference: true },
      })
    ).map((je) => je.reference),
  );

  // Build gap list from loan applications
  type Gap = {
    reference: string;
    amount: number;
    date: Date;
    branchId: string | null;
    description: string;
    source: "loan_application" | "income_record";
  };

  const gaps: Gap[] = [];

  for (const app of loanAppsWithFee) {
    const shortId = app.id.slice(0, 8);
    const ref = `LPF-APP-${shortId}`;
    const feeAmount = (Number(app.amountApplied) * Number(app.loanProcessingFeePercentage || 1)) / 100;
    if (!coveredRefs.has(ref) && feeAmount > 0) {
      gaps.push({
        reference: ref,
        amount: feeAmount,
        date: app.applicationDate,
        branchId: app.member?.user?.branchId ?? null,
        description: `Loan processing fee - ${app.member?.user?.name || shortId}`,
        source: "loan_application",
      });
    }
  }

  // Add any IncomeRecord gaps not already captured from loan applications
  const gapRefs = new Set(gaps.map((g) => g.reference));
  for (const rec of incomeRecords) {
    if (!rec.referenceNumber) continue;
    if (coveredRefs.has(rec.referenceNumber)) continue;
    if (gapRefs.has(rec.referenceNumber)) continue; // already added from loan apps
    gaps.push({
      reference: rec.referenceNumber,
      amount: Number(rec.amount),
      date: rec.recordDate,
      branchId: rec.branchId,
      description: rec.description || "Loan processing fee",
      source: "income_record",
    });
  }

  if (gaps.length === 0) {
    return NextResponse.json({
      message: "No gaps — all loan fee GL entries are already in place.",
      dryRun,
      loanApplicationsWithFeeChecked: loanAppsWithFee.length,
      incomeRecordsChecked: incomeRecords.length,
      coveredRefsCount: coveredRefs.size,
      repaired: 0,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      message: `${gaps.length} loan fee record(s) are missing GL entries. Re-run with ?dryRun=false to repair.`,
      dryRun: true,
      loanApplicationsWithFeeChecked: loanAppsWithFee.length,
      incomeRecordsChecked: incomeRecords.length,
      gaps: gaps.map((g) => ({
        reference: g.reference,
        amount: g.amount,
        date: g.date,
        description: g.description,
        source: g.source,
      })),
    });
  }

  let repairedCount = 0;
  const repairLog: Array<{ reference: string; amount: number; error?: string }> = [];

  for (const gap of gaps) {
    try {
      await db.$transaction(async (tx) => {
        const debitAcc = await tx.chartOfAccount.findFirst({
          where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
        });
        const creditAcc = await tx.chartOfAccount.findFirst({
          where: { accountCode: LOAN_PROCESSING_FEES_CODE, isActive: true },
        });

        if (!debitAcc || !creditAcc) throw new Error("COA accounts disappeared during repair");

        const amount = Number(gap.amount);
        const entryNumber = `JE-LPF-REPAIR-${gap.reference}`;

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: debitAcc.id,
            debitAmount: amount,
            creditAmount: 0,
            entryDate: gap.date,
            branchId: gap.branchId ?? null,
            description: `[Repaired] ${gap.description}`,
            reference: gap.reference,
            createdByUserId: dbUser.id,
          },
        });
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: creditAcc.id,
            debitAmount: 0,
            creditAmount: amount,
            entryDate: gap.date,
            branchId: gap.branchId ?? null,
            description: `[Repaired] ${gap.description}`,
            reference: gap.reference,
            createdByUserId: dbUser.id,
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
      repairLog.push({ reference: gap.reference, amount: Number(gap.amount) });
    } catch (err: any) {
      repairLog.push({
        reference: gap.reference,
        amount: Number(gap.amount),
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: `Repaired ${repairedCount} of ${gaps.length} missing loan fee GL entries.`,
    dryRun: false,
    loanApplicationsWithFeeChecked: loanAppsWithFee.length,
    incomeRecordsChecked: incomeRecords.length,
    repaired: repairedCount,
    failed: gaps.length - repairedCount,
    log: repairLog,
  });
}
