import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { sendTransactionAlertEmail } from "@/lib/email";
import {
  FEE_INCOME_CODE,
  WITHDRAWAL_FEE_CODE,
} from "@/lib/services/income-structure";
import { createWithdrawalFeeJournalEntry, createWithdrawalPrincipalJournalEntry } from "@/lib/journal-entries-extended";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { verificationId, verificationCode } = body;

    if (!verificationId || !verificationCode) {
      return NextResponse.json(
        { error: "Missing verification details" },
        { status: 400 }
      );
    }

    // 1. Fetch Verification
    const verification = await db.withdrawalVerification.findUnique({
      where: { id: verificationId },
      include: {
        account: { include: { accountType: true } },
        member: { include: { user: true } },
        institution: { include: { user: true } },
      },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Verification session not found" },
        { status: 404 }
      );
    }

    if (verification.isUsed) {
      return NextResponse.json(
        { error: "This verification code has already been used" },
        { status: 400 }
      );
    }

    if (new Date() > verification.expiresAt) {
      return NextResponse.json(
        { error: "Verification code has expired" },
        { status: 400 }
      );
    }

    if (verification.verificationCode !== verificationCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // 2. Final security and balance checks
    const user = session.user as any;
    if (
      user.role !== UserRole.ADMIN &&
      verification.account.branchId !== user.branchId
    ) {
      return NextResponse.json(
        { error: "Unauthorized: Branch mismatch" },
        { status: 403 }
      );
    }

    const verificationData = verification as any;
    const feeFromMetadata = Number(verificationData.metadata?.fee ?? 0);
    const fee: number = Number(
      verificationData.fee ??
        verificationData.feeAmount ??
        feeFromMetadata ??
        0
    );

    if (verification.memberId) {
      try {
        await assertMemberCanTransact(verification.memberId);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Member is not eligible to transact yet",
          },
          { status: 400 },
        );
      }
    }

    // Re-check balance just in case
    const currentAccount = await db.account.findUnique({
      where: { id: verification.accountId },
    });
    if (
      !currentAccount ||
      currentAccount.balance < verification.amount + fee
    ) {
      return NextResponse.json(
        { error: "Insufficient balance for transaction" },
        { status: 400 }
      );
    }

    // 3. Process Transaction (Atomic)
    const result = await db.$transaction(async (tx) => {
      // Mark verification as used
      await tx.withdrawalVerification.update({
        where: { id: verificationId },
        data: { isUsed: true },
      });

      // Generate Ref
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      const transactionRef = `WTH${timestamp}${random}`;

      // Create Main Transaction
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          accountId: verification.accountId,
          memberId: verification.memberId,
          institutionId: verification.institutionId,
          type: TransactionType.WITHDRAWAL,
          amount: verification.amount,
          fee,
          status: TransactionStatus.COMPLETED,
          description:
            verificationData.description ||
            `Withdrawal via ${verification.channel}`,
          channel: verification.channel,
          processedByUserId: user.id,
          branchId: user.branchId,
          notes: `Verification ID: ${verificationId}`,
        },
      });

      // Create Withdrawal record
      const withdrawal = await tx.withdrawal.create({
        data: {
          transactionId: transaction.id,
          accountId: verification.accountId,
          memberId: verification.memberId,
          institutionId: verification.institutionId,
          amount: verification.amount,
          fee,
          channel: verification.channel,
          handlerUserId: user.id,
          withdrawalDate: new Date(),
        },
      });

      // Update Account Balance
      await tx.account.update({
        where: { id: verification.accountId },
        data: {
          balance: {
            decrement: verification.amount + fee,
          },
        },
      });

      // Deduct teller/agent float for cash withdrawals so cashier reports reflect this withdrawal.
      // TELLER: float decrements (cash leaves drawer). AGENT: float increments (SACCO owes agent more).
      // Fee is included because member pays amount + fee out of the float.
      if (
        verification.channel?.toLowerCase() === "cash" &&
        ["TELLER", "AGENT"].includes(user.role)
      ) {
        const userFloat = await tx.userFloat.findUnique({
          where: { userId: user.id },
        });

        if (userFloat) {
          const totalCash = verification.amount + fee;
          const isAgent = user.role === "AGENT";

          await tx.userFloat.update({
            where: { id: userFloat.id },
            data: { balance: { [isAgent ? "increment" : "decrement"]: totalCash } },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.WITHDRAWAL,
              amount: isAgent ? totalCash : -totalCash,
              description: `Withdrawal: ${transactionRef}${fee > 0 ? ` (incl. fee ${fee})` : ""}`,
              performedByUserId: user.id,
              relatedTransactionId: transaction.id,
            },
          });
        }
      }

      if (fee > 0) {
        const parentCategory = await tx.budgetCategory.upsert({
          where: { code: FEE_INCOME_CODE },
          update: {
            name: "Fee income",
            kind: "INCOME",
            isActive: true,
          },
          create: {
            name: "Fee income",
            code: FEE_INCOME_CODE,
            kind: "INCOME",
            description: "Income from service and transaction fees",
            isActive: true,
          },
        });

        const parentAccount = await tx.chartOfAccount.upsert({
          where: { accountCode: FEE_INCOME_CODE },
          update: {
            accountName: "Fee income",
            fullCode: FEE_INCOME_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 1,
            category: "INCOME",
            description: "Income from service and transaction fees",
          },
          create: {
            accountName: "Fee income",
            accountCode: FEE_INCOME_CODE,
            fullCode: FEE_INCOME_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 1,
            category: "INCOME",
            description: "Income from service and transaction fees",
          },
        });

        const feeCategory = await tx.budgetCategory.upsert({
          where: { code: WITHDRAWAL_FEE_CODE },
          update: {
            name: "Withdrawal fee charged",
            kind: "INCOME",
            isActive: true,
            parentId: parentCategory.id,
          },
          create: {
            name: "Withdrawal fee charged",
            code: WITHDRAWAL_FEE_CODE,
            kind: "INCOME",
            description: "Fees charged when processing withdrawals",
            isActive: true,
            parentId: parentCategory.id,
          },
        });

        await tx.chartOfAccount.upsert({
          where: { accountCode: WITHDRAWAL_FEE_CODE },
          update: {
            accountName: "Withdrawal fee charged",
            fullCode: WITHDRAWAL_FEE_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            parentId: parentAccount.id,
            category: "INCOME",
            description: "Fees charged when processing withdrawals",
          },
          create: {
            accountName: "Withdrawal fee charged",
            accountCode: WITHDRAWAL_FEE_CODE,
            fullCode: WITHDRAWAL_FEE_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            parentId: parentAccount.id,
            category: "INCOME",
            description: "Fees charged when processing withdrawals",
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: feeCategory.id,
            amount: fee,
            date: new Date(),
            recordDate: new Date(),
            description: `Withdrawal Fee - ${transactionRef}`,
            receivedByUserId: user.id,
            branchId: verification.account.branchId || user.branchId,
            memberId: verification.memberId,
            accountId: verification.accountId,
            status: TransactionStatus.COMPLETED,
            paymentMethod:
              verification.channel?.toUpperCase() === "CASH" ? "CASH" : "BANK",
            referenceNumber: transactionRef,
            receiptNo: transactionRef,
            depositorName:
              verification.member?.user?.name ||
              verification.institution?.institutionName ||
              "Withdrawal customer",
            notes: `Auto-posted from withdrawal fee for transaction ${transactionRef}`,
          },
        });

        await createWithdrawalFeeJournalEntry(
          {
            amount: fee,
            description: `Withdrawal Fee - ${transactionRef}`,
            reference: transactionRef,
            transactionId: transaction.id,
            userId: user.id,
            entryDate: new Date(),
            branchId: verification.account.branchId || user.branchId,
            feeAccountCode: WITHDRAWAL_FEE_CODE,
            feeAccountName: "Withdrawal fee charged",
          },
          tx,
        );
      }

      // ── Principal journal entry (Dr Savings Liability, Cr Cash/Bank) ──
      {
        const cashCode = verification.channel?.toLowerCase() === "bank" ? "102002" : CASH_AT_HAND_CODE;
        await createWithdrawalPrincipalJournalEntry(
          {
            amount: verification.amount,
            description: `Withdrawal - ${transactionRef}`,
            reference: transactionRef,
            transactionId: transaction.id,
            userId: user.id,
            entryDate: new Date(),
            branchId: verification.account.branchId || user.branchId,
            cashAccountCode: cashCode,
          },
          tx,
        );
      }

      // Handle institution-specific withdrawal record if applicable
      if (verification.institutionId) {
        // InstitutionWithdrawal uses signatoryApprovals (Json) not signatoryId.
        // Store the signatoryId from the verification inside that Json field.
        const signatoryApprovals = verification.signatoryId
          ? [{ signatoryId: verification.signatoryId, approvedAt: new Date().toISOString() }]
          : [];

        await tx.institutionWithdrawal.create({
          data: {
            withdrawalId: withdrawal.id,
            institutionId: verification.institutionId,
            verifiedByUserId: user.id,
            recipientName:
              verificationData.metadata?.recipientName ||
              verification.institution?.institutionName ||
              "Unknown",
            recipientPhone: verificationData.metadata?.recipientPhone || "",
            recipientIdNumber:
              verificationData.metadata?.recipientIdNumber || "",
            signatoryApprovals,  // Json field — holds signatory reference
            mandateMet: true,
          },
        });
      }

      const updatedAccount = await tx.account.findUnique({
        where: { id: verification.accountId },
        select: {
          balance: true,
        },
      });

      return { transaction, withdrawal, newBalance: updatedAccount?.balance ?? 0 };
    });

    const ownerEmail =
      verification.member?.user?.email ||
      verification.institution?.institutionEmail ||
      verification.institution?.user?.email;
    const ownerName =
      verification.member?.user?.name ||
      verification.institution?.institutionName ||
      verification.institution?.user?.name ||
      "Member";

    if (ownerEmail) {
      void sendTransactionAlertEmail(
        ownerEmail,
        ownerName,
        "WITHDRAWAL",
        Number(verification.amount) + fee,
        result.newBalance,
      ).catch((error) => {
        console.error("Failed to send post-withdrawal alert email:", error);
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: "Withdrawal processed successfully",
    });
  } catch (error: any) {
    console.error("Error in withdrawal confirmation API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
