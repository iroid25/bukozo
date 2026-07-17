import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { z } from "zod";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

const FLOAT_REQUIRED_ROLES = new Set<UserRole>([
  UserRole.TELLER,
  UserRole.AGENT,
]);

const institutionSharePurchaseSchema = z.object({
  institutionId: z.string().min(1, "Institution ID is required"),
  accountTypeId: z.string().optional(),
  accountId: z.string().optional(),
  numberOfShares: z.number().int().positive("Number of shares must be greater than 0"),
  sourceAccountId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = session;
    const body = await request.json();

    const validation = institutionSharePurchaseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { institutionId, accountTypeId, accountId, numberOfShares, sourceAccountId, notes } = validation.data;

    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, institutionName: true },
    });
    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    let shareAccount = accountId
      ? await db.account.findUnique({
          where: { id: accountId },
          include: { accountType: { include: { ledgerAccount: true } } },
        })
      : null;

    if (shareAccount && shareAccount.institutionId !== institutionId) {
      return NextResponse.json(
        { error: "Account does not belong to this institution" },
        { status: 400 },
      );
    }

    if (shareAccount && !shareAccount.accountType?.isShareAccount) {
      return NextResponse.json(
        { error: "Selected account is not a share account" },
        { status: 400 },
      );
    }

    if (!shareAccount && accountTypeId) {
      shareAccount = await db.account.findFirst({
        where: {
          institutionId,
          accountTypeId,
          status: "ACTIVE",
        },
        include: { accountType: { include: { ledgerAccount: true } } },
      });
    }

    if (!shareAccount) {
      shareAccount = await db.account.findFirst({
        where: {
          institutionId,
          status: "ACTIVE",
          accountType: { isShareAccount: true },
        },
        include: { accountType: { include: { ledgerAccount: true } } },
      });
    }

    if (!shareAccount) {
      return NextResponse.json(
        { error: "No active share account found for this institution. Please create a share account first." },
        { status: 404 },
      );
    }

    if (shareAccount.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Share account is ${shareAccount.status.toLowerCase()} and cannot receive purchases` },
        { status: 400 },
      );
    }

    const shareValue = Number(shareAccount.accountType?.sharePrice || 0);
    if (shareValue <= 0) {
      return NextResponse.json(
        { error: "Share price is not configured for this account type" },
        { status: 400 },
      );
    }

    const purchaseAmount = numberOfShares * shareValue;

    let sourceAccount = sourceAccountId
      ? await db.account.findUnique({
          where: { id: sourceAccountId },
          select: { id: true, accountNumber: true, balance: true, status: true, branchId: true, institutionId: true },
        })
      : null;

    if (sourceAccountId && !sourceAccount) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }
    if (sourceAccount && sourceAccount.status !== "ACTIVE") {
      return NextResponse.json({ error: "Source account is not active" }, { status: 400 });
    }
    if (sourceAccount && sourceAccount.institutionId !== institutionId) {
      return NextResponse.json(
        { error: "Source account must belong to the same institution" },
        { status: 400 },
      );
    }
    if (sourceAccount && Number(sourceAccount.balance) < purchaseAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. Required: ${purchaseAmount}, Available: ${Number(sourceAccount.balance)}` },
        { status: 400 },
      );
    }

    const isStaff = ["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(
      (user as any).role ?? "",
    );

    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true },
    });
    const needsFloat = userRecord && FLOAT_REQUIRED_ROLES.has(userRecord.role as UserRole);
    let userFloat: { id: string; balance: number } | null = null;
    if (needsFloat && !sourceAccountId) {
      const uf = await db.userFloat.findUnique({
        where: { userId: user.id },
        select: { id: true, balance: true, isActiveForDay: true },
      });
      if (!uf) return NextResponse.json({ error: "No float account found. Please contact administrator." }, { status: 400 });
      if (!uf.isActiveForDay) return NextResponse.json({ error: "Your teller session is not active for today." }, { status: 400 });
      userFloat = uf;
    }

    const reference = `SHR-PUR-INST-${Date.now()}`;
    const branchId = shareAccount.branchId;

    const result = await db.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          transactionRef: reference,
          type: TransactionType.SHARES_PURCHASE,
          amount: purchaseAmount,
          status: TransactionStatus.COMPLETED,
          description: `Share purchase — ${numberOfShares} share(s) @ ${shareValue} each — ${institution.institutionName}`,
          transactionDate: new Date(),
          accountId: shareAccount!.id,
          institutionId,
          processedByUserId: user.id,
          branchId,
          channel: sourceAccountId ? "INTERNAL_TRANSFER" : "CASH",
        },
      });

      await tx.account.update({
        where: { id: shareAccount!.id },
        data: { balance: { increment: purchaseAmount } },
      });

      if (sourceAccount) {
        await tx.account.update({
          where: { id: sourceAccount.id },
          data: { balance: { decrement: purchaseAmount } },
        });
        await tx.transaction.create({
          data: {
            transactionRef: `TRF-SHARE-${Date.now()}`,
            type: TransactionType.TRANSFER,
            amount: purchaseAmount,
            status: TransactionStatus.COMPLETED,
            description: `Transfer from ${sourceAccount.accountNumber} to ${shareAccount!.accountNumber} for share purchase`,
            transactionDate: new Date(),
            accountId: sourceAccount.id,
            institutionId,
            processedByUserId: user.id,
            branchId,
            channel: "INTERNAL_TRANSFER",
          },
        });
      }

      if (userFloat) {
        await tx.userFloat.update({
          where: { id: userFloat.id },
          data: { balance: { increment: purchaseAmount } },
        });
        await tx.floatTransaction.create({
          data: {
            floatId: userFloat.id,
            type: TransactionType.SHARES_PURCHASE,
            amount: purchaseAmount,
            description: `Share purchase cash received - ${reference}`,
            performedByUserId: user.id,
            relatedTransactionId: transaction.id,
          },
        });
      }

      {
        const { ensureEquityStructure } = await import("@/lib/services/equity-structure");
        const { ensureAssetStructure } = await import("@/lib/services/asset-structure");
        await Promise.all([ensureEquityStructure(), ensureAssetStructure()]);

        const shareCapitalAccount = await tx.chartOfAccount.findUnique({
          where: { accountCode: "304000" },
        });
        if (!shareCapitalAccount) {
          throw new Error(
            "Share capital account (304000) is missing from the chart of accounts. " +
            "Ask your accountant to set up the equity structure before recording share purchases.",
          );
        }

        const debitAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
        });
        if (!debitAccount) {
          throw new Error(
            `Cash/bank account (${CASH_AT_HAND_CODE}) is missing or inactive in the chart of accounts.`,
          );
        }

        const entryNumber = `JE-SHARE-INST-${Date.now()}`;
        const entryDate = new Date();

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: debitAccount.id,
            debitAmount: purchaseAmount,
            creditAmount: 0,
            entryDate,
            branchId,
            description: `Share purchase - ${reference} (${institution.institutionName})`,
            reference,
            transactionId: transaction.id,
            createdByUserId: user.id,
          },
        });
        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: shareCapitalAccount.id,
            debitAmount: 0,
            creditAmount: purchaseAmount,
            entryDate,
            branchId,
            description: `Share purchase - ${reference} (${institution.institutionName})`,
            reference,
            transactionId: transaction.id,
            createdByUserId: user.id,
          },
        });
        await tx.chartOfAccount.update({
          where: { id: debitAccount.id },
          data: buildAccountBalanceUpdate(debitAccount, { debitAmount: purchaseAmount }),
        });
        await tx.chartOfAccount.update({
          where: { id: shareCapitalAccount.id },
          data: buildAccountBalanceUpdate(shareCapitalAccount, { creditAmount: purchaseAmount }),
        });
      }

      return { reference, transaction };
    });

    void bumpAccountingSyncState("Institution share purchase");

    return NextResponse.json(
      {
        success: true,
        message: "Institution share purchase completed successfully",
        data: {
          reference: result.reference,
          shareAccountId: shareAccount.id,
          shareAccountNumber: shareAccount.accountNumber,
          institutionName: institution.institutionName,
          numberOfSharesPurchased: numberOfShares,
          shareValue,
          totalPaid: purchaseAmount,
          newBalance: Number(shareAccount.balance) + purchaseAmount,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Institution share purchase error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process institution share purchase" },
      { status: 500 },
    );
  }
}
