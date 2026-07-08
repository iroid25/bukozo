import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { z } from "zod";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

const FLOAT_REQUIRED_ROLES = new Set<UserRole>([
  UserRole.TELLER,
  UserRole.AGENT,
]);

const sharePurchaseSchema = z.object({
  shareAccountId: z.string().optional(),
  targetMemberId: z.string().optional(),
  shareAccountTypeId: z.string().optional(),
  numberOfShares: z.number().int().positive("Number of shares must be greater than 0"),
  sourceAccountId: z.string().optional(), // savings account to debit; null = cash payment
  notes: z.string().optional(),
});

async function generateUniqueAccountNumber(prefix = "ACC"): Promise<string> {
  let attempt = 0;
  while (attempt < 12) {
    const candidate = `${prefix}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    const existing = await db.account.findUnique({ where: { accountNumber: candidate } });
    if (!existing) return candidate;
    attempt += 1;
  }
  throw new Error("Unable to generate a unique account number");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;
    const body = await request.json();

    const validation = sharePurchaseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const {
      shareAccountId,
      targetMemberId,
      shareAccountTypeId,
      numberOfShares,
      sourceAccountId,
      notes,
    } = validation.data;

    if (!shareAccountId && (!targetMemberId || !shareAccountTypeId)) {
      return NextResponse.json(
        {
          error:
            "Either an existing shareAccountId or a targetMemberId plus shareAccountTypeId must be provided",
        },
        { status: 400 },
      );
    }

    const sourceAccount = sourceAccountId
      ? await db.account.findUnique({
          where: { id: sourceAccountId },
          select: { id: true, accountNumber: true, balance: true, memberId: true, status: true, branchId: true },
        })
      : null;

    if (sourceAccountId && !sourceAccount) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    if (sourceAccount && sourceAccount.status !== "ACTIVE") {
      return NextResponse.json({ error: "Source account is not active" }, { status: 400 });
    }

    if (sourceAccount && targetMemberId && sourceAccount.memberId !== targetMemberId) {
      return NextResponse.json(
        { error: "Source savings account must belong to the same member as the target share account" },
        { status: 400 },
      );
    }

    let shareAccount = shareAccountId
      ? await db.shareAccount.findUnique({
          where: { id: shareAccountId },
          include: {
            member: { include: { user: true } },
            accountType: true,
          },
        })
      : null;

    let targetMember: any = null;
    let targetAccountType: any = null;
    if (!shareAccount) {
      targetMember = await db.member.findUnique({
        where: { id: targetMemberId! },
        include: {
          user: { select: { id: true, branchId: true, name: true } },
          shareAccounts: {
            include: { accountType: true },
          },
        },
      });

      if (!targetMember) {
        return NextResponse.json({ error: "Target member not found" }, { status: 404 });
      }

      targetAccountType = await db.accountType.findUnique({
        where: { id: shareAccountTypeId! },
      });

      if (!targetAccountType || !targetAccountType.isShareAccount) {
        return NextResponse.json(
          { error: "Selected account type is not a share account type" },
          { status: 400 },
        );
      }

      const matchingShareAccounts = targetMember.shareAccounts.filter(
        (account: any) => account.accountTypeId === targetAccountType.id,
      );
      shareAccount = matchingShareAccounts.find((account: any) => account.status === "ACTIVE") as any;

      if (!shareAccount && matchingShareAccounts.length > 0) {
        return NextResponse.json(
          {
            error:
              "Member already has a share account of this type. Please use the existing account instead of creating a duplicate.",
          },
          { status: 409 },
        );
      }
    }

    if (!shareAccount) {
      if (!targetMember || !targetAccountType) {
        return NextResponse.json({ error: "Unable to resolve share account destination" }, { status: 400 });
      }

      const accountNumber = await generateUniqueAccountNumber("SHR");
      const branchId = sourceAccount?.branchId || targetMember.user?.branchId || null;
      if (!branchId) {
        return NextResponse.json(
          { error: "Unable to determine the branch for the new share account" },
          { status: 400 },
        );
      }

      shareAccount = await db.shareAccount.create({
        data: {
          accountNumber,
          memberId: targetMember.id,
          accountTypeId: targetAccountType.id,
          branchId,
          numberOfShares: 0,
          shareValue: Number(targetAccountType.sharePrice || 0),
          totalValue: 0,
          status: "ACTIVE",
        },
        include: {
          member: { include: { user: true } },
          accountType: true,
        },
      });

      await db.account.create({
        data: {
          accountNumber,
          memberId: targetMember.id,
          accountTypeId: targetAccountType.id,
          branchId,
          balance: 0,
          status: "ACTIVE",
        },
      });
    }

    if (!shareAccount) {
      return NextResponse.json({ error: "Share account not found" }, { status: 404 });
    }

    if (shareAccount.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Share account is ${shareAccount.status.toLowerCase()} and cannot receive purchases` },
        { status: 400 },
      );
    }

    if (sourceAccount && sourceAccount.memberId !== shareAccount.memberId) {
      return NextResponse.json(
        { error: "Source savings account must belong to the same member as the share account" },
        { status: 400 },
      );
    }

    await assertMemberCanTransact(shareAccount.memberId);

    const isStaff = ["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "TELLER"].includes(
      (user as any).role ?? "",
    );
    if (!isStaff && shareAccount.member.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to purchase shares for this account" }, { status: 403 });
    }

    const shareValue = shareAccount.shareValue;
    const purchaseAmount = numberOfShares * shareValue;

    if (sourceAccount && Number(sourceAccount.balance) < purchaseAmount) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Required: ${purchaseAmount}, Available: ${Number(sourceAccount.balance)}`,
        },
        { status: 400 },
      );
    }

    // Float check for cash share purchases
    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true },
    });
    const needsFloat = userRecord && FLOAT_REQUIRED_ROLES.has(userRecord.role as UserRole);
    let userFloat: { id: string; balance: number } | null = null;
    if (needsFloat && !sourceAccount) {
      const uf = await db.userFloat.findUnique({
        where: { userId: user.id },
        select: { id: true, balance: true, isActiveForDay: true },
      });
      if (!uf) return NextResponse.json({ error: "No float account found. Please contact administrator." }, { status: 400 });
      if (!uf.isActiveForDay) return NextResponse.json({ error: "Your teller session is not active for today." }, { status: 400 });
      userFloat = uf;
    }

    const reference = `SHR-PUR-${Date.now()}`;

    const result = await db.$transaction(async (tx) => {
      // Update share account
      const updatedShareAccount = await tx.shareAccount.update({
        where: { id: shareAccount.id },
        data: {
          numberOfShares: { increment: numberOfShares },
          totalValue: { increment: purchaseAmount },
          lastTransactionDate: new Date(),
        },
      });

      // Record the share transaction
      await tx.shareTransaction.create({
        data: {
          accountId: shareAccount.id,
          transactionType: "PURCHASE",
          shares: numberOfShares,
          shareValue,
          amount: purchaseAmount,
          sharesBefore: shareAccount.numberOfShares,
          sharesAfter: updatedShareAccount.numberOfShares,
          description: notes || `Purchase of ${numberOfShares} share(s)`,
          reference,
          tellerId: user.id,
        },
      });

      // Transaction.accountId must reference the generic Account table (not ShareAccount).
      // Look up the Account row that corresponds to this ShareAccount by account number.
      let genericAccount = await tx.account.findFirst({
        where: {
          OR: [
            { accountNumber: shareAccount.accountNumber },
            { memberId: shareAccount.memberId, accountTypeId: shareAccount.accountTypeId },
          ],
        },
        select: { id: true },
      });

      if (!genericAccount) {
        const accountBranchId = shareAccount.branchId || sourceAccount?.branchId || targetMember?.user?.branchId;
        if (!accountBranchId) {
          throw new Error("Unable to determine the branch for the linked account record");
        }
        genericAccount = await tx.account.create({
          data: {
            accountNumber: shareAccount.accountNumber,
            memberId: shareAccount.memberId,
            accountTypeId: shareAccount.accountTypeId,
            branchId: accountBranchId,
            balance: 0,
            status: "ACTIVE",
          },
          select: { id: true },
        });
      }

      // Always create a Transaction record so it shows in "All Transactions"
      const transaction = await tx.transaction.create({
        data: {
          transactionRef: reference,
          type: TransactionType.SHARES_PURCHASE,
          amount: purchaseAmount,
          status: TransactionStatus.COMPLETED,
          description: `Share purchase — ${numberOfShares} share(s) @ ${shareValue} each`,
          transactionDate: new Date(),
          accountId: genericAccount.id,
          memberId: shareAccount.memberId,
          processedByUserId: user.id,
          branchId: shareAccount.branchId,
          channel: sourceAccount ? "INTERNAL_TRANSFER" : "CASH",
        },
      });

      // If funded from a savings account, debit it
      if (sourceAccount) {
        await tx.account.update({
          where: { id: sourceAccount.id },
          data: { balance: { decrement: purchaseAmount } },
        });
      }

      await tx.account.update({
        where: { id: genericAccount.id },
        data: { balance: { increment: purchaseAmount } },
      });

      // Update teller/agent float for cash payments
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

      // ── Double-entry GL for share purchase ──
      // Both ensureEquityStructure and ensureAssetStructure use the regular db
      // client (not tx), so their upserts run outside the transaction lock and
      // won't deadlock even though the call site is inside the tx callback.
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

        const debitCode = sourceAccount
          ? (await tx.accountType.findUnique({
              where: { id: (await tx.account.findUnique({ where: { id: sourceAccount.id }, select: { accountTypeId: true } }))?.accountTypeId },
              include: { ledgerAccount: true },
            }))?.ledgerAccount?.accountCode || CASH_AT_HAND_CODE
          : CASH_AT_HAND_CODE;

        const debitAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: debitCode, isActive: true },
        });

        if (!debitAccount) {
          throw new Error(
            `Cash/bank account (${debitCode}) is missing or inactive in the chart of accounts. ` +
            "Set up the asset structure before recording share purchases.",
          );
        }

        const entryNumber = `JE-SHARE-${Date.now()}`;
        const branchId = shareAccount.branchId;
        const entryDate = new Date();

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: debitAccount.id,
            debitAmount: purchaseAmount,
            creditAmount: 0,
            entryDate,
            branchId,
            description: `Share purchase - ${reference}`,
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
            description: `Share purchase - ${reference}`,
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

      // In-app notification
      if (shareAccount.member.user?.id) {
        await tx.notification.create({
          data: {
            userId: shareAccount.member.user.id,
            type: "IN_APP",
            subject: "Share Purchase Successful",
            message: `You have successfully purchased ${numberOfShares} share(s) on account ${shareAccount.accountNumber}. Total paid: UGX ${purchaseAmount.toLocaleString()}. Reference: ${reference}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }

      return { shareAccount: updatedShareAccount, reference, transaction };
    });

    void bumpAccountingSyncState("Shares purchased");

    return NextResponse.json(
      {
        success: true,
        message: "Share purchase completed successfully",
        data: {
          reference: result.reference,
          shareAccountId: shareAccount.id,
          shareAccountNumber: shareAccount.accountNumber,
          numberOfSharesPurchased: numberOfShares,
          shareValue,
          totalPaid: purchaseAmount,
          newTotalShares: result.shareAccount.numberOfShares,
          newTotalValue: result.shareAccount.totalValue,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.message?.includes("not eligible")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Share purchase error:", error);
    return NextResponse.json({ error: "Failed to process share purchase" }, { status: 500 });
  }
}
