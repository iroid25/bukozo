import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Tellers and managers can record repayments
    const canRecord =
      user.role === UserRole.TELLER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.ACCOUNTANT ||
      user.role === UserRole.BRANCHMANAGER;

    if (!canRecord) {
      return NextResponse.json(
        { error: "You do not have permission to record repayments." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const amount = Number(body.amount || 0);
    const notes = String(body.notes || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Repayment amount must be greater than zero." },
        { status: 400 },
      );
    }

    const rows = await db.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
    );
    const advance = rows[0];

    if (!advance) {
      return NextResponse.json({ error: "Advance not found." }, { status: 404 });
    }
    if (advance.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Repayments can only be recorded for active advances." },
        { status: 409 },
      );
    }

    // Branch scoping for non-admin
    if (
      user.role !== UserRole.ADMIN &&
      user.branchId &&
      advance.branchId &&
      advance.branchId !== user.branchId
    ) {
      return NextResponse.json(
        { error: "You can only record repayments for advances in your branch." },
        { status: 403 },
      );
    }

    const currentOutstanding = Number(advance.outstandingBalance);
    if (amount > currentOutstanding) {
      return NextResponse.json(
        {
          error: `Repayment exceeds outstanding balance. Outstanding: ${currentOutstanding.toLocaleString()}, Entered: ${amount.toLocaleString()}.`,
        },
        { status: 400 },
      );
    }

    const newOutstanding = Number((currentOutstanding - amount).toFixed(2));
    const isFullyRepaid = newOutstanding <= 0;

    await db.$transaction(async (tx) => {
      // GL: Dr 102001-Cash at Hand (cash comes in), Cr 102005-Advances (receivable decreases)
      const [cashAccount, advancesAccount] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { accountCode: "102001", isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { accountCode: "102005", isActive: true } }),
      ]);

      if (cashAccount && advancesAccount) {
        const entryNumber = `JE-ADV-REPAY-${Date.now()}`;
        const description = `Advance Repayment: ${advance.staffName} [${advance.requestCode}]`;
        const reference = advance.requestCode;
        const jeBranchId = advance.branchId || null;

        // Dr: 102001-Cash at Hand (increases)
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: cashAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description,
            entryDate: new Date(),
            reference,
            branchId: jeBranchId,
            createdByUserId: user.id,
          },
        });

        // Cr: 102005-Advances (decreases)
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: advancesAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description,
            entryDate: new Date(),
            reference,
            branchId: jeBranchId,
            createdByUserId: user.id,
          },
        });

        await tx.chartOfAccount.update({
          where: { id: cashAccount.id },
          data: buildAccountBalanceUpdate(cashAccount, { debitAmount: amount }),
        });

        await tx.chartOfAccount.update({
          where: { id: advancesAccount.id },
          data: buildAccountBalanceUpdate(advancesAccount, { creditAmount: amount }),
        });
      }

      // Create repayment record
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "StaffAdvanceRepayment" (
          "id", "advanceId", "amount", "notes",
          "recordedByUserId", "paidAt", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}, ${id}, ${amount},
          ${notes || null}, ${user.id}, NOW(), NOW()
        )
      `);

      // Update the advance's outstanding balance and status
      await tx.$executeRaw(Prisma.sql`
        UPDATE "StaffAdvanceRequest"
        SET "outstandingBalance" = ${newOutstanding},
            "status" = ${isFullyRepaid ? "COMPLETED" : "ACTIVE"},
            "updatedAt" = NOW()
        WHERE "id" = ${id}
      `);

      // If fully repaid, zero out the current asset's value
      if (isFullyRepaid && advance.assetId) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "FixedAsset"
          SET "currentValue" = 0,
              "status" = 'DISPOSED',
              "updatedAt" = NOW()
          WHERE "id" = ${advance.assetId}
        `);
      } else if (advance.assetId) {
        // Reduce the asset's current value by repayment
        await tx.$executeRaw(Prisma.sql`
          UPDATE "FixedAsset"
          SET "currentValue" = GREATEST(0, "currentValue" - ${amount}),
              "updatedAt" = NOW()
          WHERE "id" = ${advance.assetId}
        `);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        newOutstandingBalance: newOutstanding,
        isFullyRepaid,
        message: isFullyRepaid
          ? "Advance fully repaid and marked as completed."
          : `Payment recorded. Outstanding balance: ${newOutstanding.toLocaleString()}.`,
      },
    });
  } catch (error: any) {
    console.error("Error recording advance repayment:", error);
    return NextResponse.json(
      { error: "Failed to record repayment", details: error.message },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const repayments = await db.$queryRaw<any[]>(
      Prisma.sql`
        SELECT * FROM "StaffAdvanceRepayment"
        WHERE "advanceId" = ${id}
        ORDER BY "paidAt" ASC
      `,
    );

    const recorderIds = Array.from(
      new Set(repayments.map((r: any) => r.recordedByUserId).filter(Boolean)),
    );
    const recorders =
      recorderIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: recorderIds } },
            select: { id: true, name: true },
          })
        : [];
    const recorderMap = new Map(recorders.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      data: repayments.map((r: any) => ({
        ...r,
        recordedBy: recorderMap.get(r.recordedByUserId) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch repayments", details: error.message },
      { status: 500 },
    );
  }
}
