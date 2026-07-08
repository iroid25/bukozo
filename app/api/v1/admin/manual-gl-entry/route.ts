/**
 * POST /api/v1/admin/manual-gl-entry
 *
 * Creates a single double-entry GL pair (debit + credit) for an ad-hoc
 * income or expense adjustment.  Use this when a fee was collected in cash
 * but no JournalEntry was created by the normal workflow.
 *
 * Body (JSON):
 *   {
 *     debitAccountCode:  string,   // e.g. "101100" (Cash at Hand)
 *     creditAccountCode: string,   // e.g. "401002" (Loan Processing Fees)
 *     amount:            number,   // positive number in UGX
 *     reference:         string,   // unique reference for idempotency
 *     description:       string,   // human-readable narration
 *     entryDate:         string,   // ISO date "YYYY-MM-DD" (defaults to today)
 *     branchId?:         string    // optional branch scoping
 *   }
 *
 * ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const dbUser = await db.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Could not resolve current user in database." }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { debitAccountCode, creditAccountCode, amount, reference, description, entryDate, branchId } = body;

  if (!debitAccountCode || !creditAccountCode || !amount || !reference || !description) {
    return NextResponse.json(
      { error: "Required fields: debitAccountCode, creditAccountCode, amount, reference, description" },
      { status: 400 },
    );
  }

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  // Idempotency check — refuse if reference already has a GL entry
  const existing = await db.journalEntry.findFirst({
    where: { reference: String(reference) },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A JournalEntry with reference "${reference}" already exists. Use a different reference.` },
      { status: 409 },
    );
  }

  const debitAcc = await db.chartOfAccount.findFirst({
    where: { accountCode: String(debitAccountCode), isActive: true },
  });
  const creditAcc = await db.chartOfAccount.findFirst({
    where: { accountCode: String(creditAccountCode), isActive: true },
  });

  if (!debitAcc) {
    return NextResponse.json({ error: `Debit account "${debitAccountCode}" not found or inactive.` }, { status: 404 });
  }
  if (!creditAcc) {
    return NextResponse.json({ error: `Credit account "${creditAccountCode}" not found or inactive.` }, { status: 404 });
  }

  const jeDate = entryDate ? new Date(entryDate) : new Date();
  if (isNaN(jeDate.getTime())) {
    return NextResponse.json({ error: "Invalid entryDate — use ISO format YYYY-MM-DD" }, { status: 400 });
  }
  jeDate.setHours(12, 0, 0, 0); // noon to avoid timezone boundary issues

  const entryNumber = `JE-MANUAL-${String(reference).toUpperCase().replace(/\s+/g, "-")}`;

  await db.$transaction(async (tx) => {
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: debitAcc.id,
        debitAmount: parsedAmount,
        creditAmount: 0,
        entryDate: jeDate,
        branchId: branchId || null,
        description: String(description),
        reference: String(reference),
        createdByUserId: dbUser.id,
      },
    });
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: creditAcc.id,
        debitAmount: 0,
        creditAmount: parsedAmount,
        entryDate: jeDate,
        branchId: branchId || null,
        description: String(description),
        reference: String(reference),
        createdByUserId: dbUser.id,
      },
    });
    await tx.chartOfAccount.update({
      where: { id: debitAcc.id },
      data: buildAccountBalanceUpdate(debitAcc, { debitAmount: parsedAmount }),
    });
    await tx.chartOfAccount.update({
      where: { id: creditAcc.id },
      data: buildAccountBalanceUpdate(creditAcc, { creditAmount: parsedAmount }),
    });
  });

  return NextResponse.json({
    success: true,
    message: `GL entry created: DR ${debitAcc.accountName} (${debitAccountCode}) / CR ${creditAcc.accountName} (${creditAccountCode}) — ${parsedAmount} UGX`,
    entryNumber,
    reference: String(reference),
    amount: parsedAmount,
    entryDate: jeDate.toISOString().slice(0, 10),
    debit: { code: debitAccountCode, name: debitAcc.accountName },
    credit: { code: creditAccountCode, name: creditAcc.accountName },
  });
}
