import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

const TRANSFER_STATUS_PENDING = "PENDING_APPROVAL";
const TRANSFER_STATUS_POSTED = "POSTED";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT &&
      user.role !== UserRole.BRANCHMANAGER
    ) {
      return NextResponse.json(
        { error: "You do not have permission to approve transfers." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const transferRows = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "AssetTransfer"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    const transfer = transferRows[0];

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found." }, { status: 404 });
    }

    if (transfer.status !== TRANSFER_STATUS_PENDING) {
      return NextResponse.json(
        { error: "This transfer has already been processed." },
        { status: 409 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const [sourceAccount, targetAccount] = await Promise.all([
        tx.chartOfAccount.findUnique({ where: { id: transfer.sourceAssetId } }),
        tx.chartOfAccount.findUnique({ where: { id: transfer.targetAssetId } }),
      ]);

      if (!sourceAccount || !targetAccount) {
        throw new Error(
          "One or both selected asset classifications are no longer available.",
        );
      }

      if (
        !sourceAccount.accountCode.startsWith("102") ||
        !targetAccount.accountCode.startsWith("102")
      ) {
        throw new Error(
          "Transfers are only allowed between current asset accounts (102xxx).",
        );
      }

      if (!sourceAccount.isActive || !targetAccount.isActive) {
        throw new Error("Both asset classifications must be active.");
      }

      const amount = Number(transfer.amount || 0);
      const sourceBalance = Number(sourceAccount.balance || 0);

      if (sourceBalance < amount) {
        throw new Error(
          `Insufficient balance in "${sourceAccount.accountName}". Available: ${sourceBalance}, Required: ${amount}`,
        );
      }

      const entryNumber = `JE-CA-TRF-${Date.now()}`;
      const description = `Current Asset Transfer: ${sourceAccount.accountName} → ${targetAccount.accountName}`;
      const reference = transfer.transferCode || transfer.receiptNo || null;
      const jeBranchId = transfer.branchId || null;

      // Dr: Target account (current asset receiving — asset balance increases)
      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: targetAccount.id,
          debitAmount: amount,
          creditAmount: 0,
          description,
          entryDate: new Date(),
          reference,
          branchId: jeBranchId,
          createdByUserId: user.id,
        },
      });

      // Cr: Source account (current asset sending — asset balance decreases)
      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: sourceAccount.id,
          debitAmount: 0,
          creditAmount: amount,
          description,
          entryDate: new Date(),
          reference,
          branchId: jeBranchId,
          createdByUserId: user.id,
        },
      });

      // Update target account balance (debit side)
      await tx.chartOfAccount.update({
        where: { id: targetAccount.id },
        data: buildAccountBalanceUpdate(targetAccount, { debitAmount: amount }),
      });

      // Update source account balance (credit side)
      await tx.chartOfAccount.update({
        where: { id: sourceAccount.id },
        data: buildAccountBalanceUpdate(sourceAccount, { creditAmount: amount }),
      });

      // Mark transfer as posted
      await tx.$executeRaw(Prisma.sql`
        UPDATE "AssetTransfer"
        SET
          "status" = ${TRANSFER_STATUS_POSTED},
          "approvedByUserId" = ${user.id},
          "approvedAt" = NOW(),
          "rejectedByUserId" = NULL,
          "rejectedAt" = NULL,
          "rejectionReason" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${id}
      `);

      return tx.$queryRaw<any[]>(Prisma.sql`
        SELECT * FROM "AssetTransfer" WHERE "id" = ${id} LIMIT 1
      `);
    });

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("Error approving current asset transfer:", error);
    return NextResponse.json(
      {
        error: "Failed to approve current asset transfer",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
