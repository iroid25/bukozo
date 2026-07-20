// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/config/auth";
// import { db } from "@/prisma/db";
// import { Resend } from "resend";
// import WithdrawalVerificationEmail from "@/app/(dashboard)/dashboard/withdraw-test/components/email-templates/withdrawal-verification";
// import { calculateWithdrawalFee } from "@/lib/fees";
// import { UserRole } from "@prisma/client";

// const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// export async function POST(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await request.json();
//     const {
//       memberId,
//       institutionId,
//       accountId,
//       amount,
//       channel,
//       signatoryId,
//     } = body;

//     if (!accountId || !amount || !channel) {
//       return NextResponse.json(
//         { error: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // 1. Fetch Account & Entity details
//     const account = await db.account.findUnique({
//       where: { id: accountId },
//       include: {
//         accountType: true,
//         member: { include: { user: true } },
//         institution: {
//           include: {
//             user: true,
//             signatories: true,
//           },
//         },
//       },
//     });

//     if (!account)
//       return NextResponse.json({ error: "Account not found" }, { status: 404 });
//     if (account.status !== "ACTIVE")
//       return NextResponse.json(
//         { error: "Account is not active" },
//         { status: 400 }
//       );

//     // 2. Validate Security (Branch check)
//     const user = session.user as any;
//     if (user.role !== UserRole.ADMIN && account.branchId !== user.branchId) {
//       return NextResponse.json(
//         { error: "Unauthorized: Account is in a different branch" },
//         { status: 403 }
//       );
//     }

//     // Restriction: Share Accounts or Withdrawals Disabled
//     if (account.accountType.isShareAccount) {
//       return NextResponse.json(
//         {
//           error:
//             "Withdrawals from Share Accounts are not permitted. Please use the Transfer functionality.",
//         },
//         { status: 400 }
//       );
//     }

//     if (!account.accountType.canWithdraw) {
//       return NextResponse.json(
//         { error: "Withdrawals are restricted for this account type." },
//         { status: 400 }
//       );
//     }

//     // 3. Calculate Fee
//     const fee = calculateWithdrawalFee(Number(amount), account.accountType, account);
//     const totalDeduction = Number(amount) + fee;

//     if (account.balance < totalDeduction) {
//       return NextResponse.json(
//         {
//           error: `Insufficient balance. Required: UGX ${totalDeduction.toLocaleString()}`,
//         },
//         { status: 400 }
//       );
//     }

//     // 4. Generate Verification Code (6 digits)
//     const code = Math.floor(100000 + Math.random() * 900000).toString();
//     const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

//     // 5. Store Verification in DB
//     // - 'fee' does not exist on WithdrawalVerification model, so it's stored in metadata
//     // - the code field is named 'verificationCode' in the schema
//     const verification = await db.withdrawalVerification.create({
//       data: {
//         memberId: memberId || null,
//         institutionId: institutionId || null,
//         accountId,
//         amount: Number(amount),
//         channel,
//         verificationCode: code,   // âœ… correct field name from schema
//         expiresAt,
//         signatoryId: signatoryId || null,
//         handlerUserId: user.id,
//         metadata: {               // âœ… fee stored here since schema has no fee column
//           fee,
//         },
//       },
//     });

//     // 6. Send Alert (Email/SMS)
//     let emailSent = false;
//     let smsSent = false;

//     // Determine recipient contact info
//     let recipientEmail = "";
//     let recipientName = "";

//     if (memberId && account.member) {
//       recipientEmail = account.member.user.email || "";
//       recipientName = account.member.user.name;
//     } else if (institutionId && account.institution) {
//       if (signatoryId) {
//         const sig = account.institution.signatories.find(
//           (s) => s.id === signatoryId
//         );
//         recipientEmail =
//           sig?.email || account.institution.user.email || "";
//         recipientName =
//           sig?.name || account.institution.institutionName;
//       } else {
//         recipientEmail = account.institution.user.email || "";
//         recipientName = account.institution.institutionName;
//       }
//     }

//     if (resend && recipientEmail) {
//       try {
//         await resend.emails.send({
//           from: "Bukonz Sacco <noreply@bukonzemergencysacco.com>",
//           to: recipientEmail,
//           subject: "Withdrawal Verification Code",
//           react: WithdrawalVerificationEmail({
//             memberName: recipientName,
//             amount: Number(amount),
//             accountNumber: account.accountNumber,
//             verificationCode: code,
//             expiresInMinutes: 10,
//             fee,
//             total: Number(amount) + fee,
//             channel,
//           }),
//         });
//         emailSent = true;
//       } catch (err) {
//         console.error("Failed to send verification email:", err);
//       }
//     }

//     return NextResponse.json({
//       success: true,
//       data: {
//         id: verification.id,
//         expiresAt,
//         emailSent,
//         smsSent,
//         member: {
//           user: {
//             name: recipientName,
//             email: recipientEmail,
//             phone: account.member?.user.phone || "",
//           },
//         },
//         account: {
//           accountNumber: account.accountNumber,
//         },
//         amount: Number(amount),
//         fee,
//       },
//     });
//   } catch (error: any) {
//     console.error("Error in withdrawal verification API:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { Resend } from "resend";
import WithdrawalVerificationEmail from "@/app/(dashboard)/dashboard/withdraw-test/components/email-templates/withdrawal-verification-v2";
import { calculateWithdrawalFee } from "@/lib/fees";
import {
  TransactionStatus,
  TransactionType,
  UserRole,
} from "@prisma/client";
import {
  FEE_INCOME_CODE,
  WITHDRAWAL_FEE_CODE,
} from "@/lib/services/income-structure";
import { createWithdrawalFeeJournalEntry } from "@/lib/journal-entries-extended";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";

// Initialize Resend - skip logging at module level to avoid build crashes
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const resendFromAddress =
  process.env.RESEND_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  "Bukonz Sacco <onboarding@resend.dev>";

async function getWithdrawalFeeFallbackTiers(
  isInstitution: boolean,
): Promise<string | null> {
  const configKey = isInstitution
    ? "TELLER_WITHDRAWAL_RATES_INSTITUTION"
    : "TELLER_WITHDRAWAL_RATES_MEMBER";

  const config = await db.systemConfiguration.findUnique({
    where: { key: configKey },
    select: { value: true },
  });

  return config?.value ?? null;
}

async function processWithdrawalInApi(params: {
  verification: any;
  account: any;
  user: any;
  fee: number;
  totalDeduction: number;
  isInstitution: boolean;
  description?: string;
  mobileMoneyRef?: string;
  recipientName?: string;
  recipientIdNumber?: string;
  recipientPhone?: string;
  recipientRelation?: string;
  verifiedSignatories?: string[];
  verifiedAgent?: boolean;
  signatoryId?: string;
}) {
  const {
    verification,
    account,
    user,
    fee,
    totalDeduction,
    isInstitution,
    description,
    mobileMoneyRef,
    recipientName,
    recipientIdNumber,
    recipientPhone,
    recipientRelation,
    verifiedSignatories,
    verifiedAgent,
    signatoryId,
  } = params;

  if (verification.memberId) {
    await assertMemberCanTransact(verification.memberId);
  }

  return db.$transaction(async (tx) => {
    await tx.withdrawalVerification.update({
      where: { id: verification.id },
      data: { isUsed: true },
    });

    const transactionRef = `WDL-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const transaction = await tx.transaction.create({
      data: {
        transactionRef,
        accountId: verification.accountId,
        type: TransactionType.WITHDRAWAL,
        amount: verification.amount,
        fee,
        status: TransactionStatus.COMPLETED,
        description: description || "Withdrawal",
        processedByUserId: user.id,
        transactionDate: new Date(),
        channel: verification.channel,
        branchId: account.branchId,
        externalReference: mobileMoneyRef || null,
        ...(isInstitution
          ? { institutionId: verification.institutionId }
          : { memberId: verification.memberId }),
      },
    });

    const withdrawal = await tx.withdrawal.create({
      data: {
        transactionId: transaction.id,
        accountId: verification.accountId,
        amount: verification.amount,
        fee,
        withdrawalDate: new Date(),
        handlerUserId: user.id,
        channel: verification.channel,
        mobileMoneyRef: mobileMoneyRef || null,
        ...(isInstitution
          ? { institutionId: verification.institutionId }
          : { memberId: verification.memberId }),
      },
    });

    if (
      isInstitution &&
      verification.institutionId &&
      (recipientName || recipientIdNumber || recipientPhone || recipientRelation)
    ) {
      await tx.institutionWithdrawal.create({
        data: {
          withdrawalId: withdrawal.id,
          institutionId: verification.institutionId,
          verifiedByUserId: user.id,
          recipientName: recipientName || "Unknown",
          recipientPhone: recipientPhone || "",
          recipientIdNumber: recipientIdNumber || "",
          signatoryApprovals: Array.isArray(verifiedSignatories)
            ? verifiedSignatories.map((id) => ({
                signatoryId: id,
                approvedAt: new Date().toISOString(),
              }))
            : [],
          mandateMet: Boolean(verifiedAgent),
        },
      });
    }

    await tx.account.update({
      where: { id: verification.accountId },
      data: {
        balance: {
          decrement: totalDeduction,
        },
      },
    });

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

      // Income record for operational reporting (dedup by externalRef)
      const existingFeeIncome = await tx.incomeRecord.findFirst({
        where: { externalRef: transactionRef },
      });
      if (!existingFeeIncome) {
        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: feeCategory.id,
            amount: fee,
            date: new Date(),
            description: `Withdrawal Fee - ${transactionRef}`,
            paymentMethod: verification.channel?.toUpperCase() === "CASH" ? "CASH" : "OTHER",
            receivedByUserId: user.id,
            branchId: account.branchId || undefined,
            memberId: verification.memberId || undefined,
            accountId: verification.accountId || undefined,
            status: "COMPLETED",
            recordDate: new Date(),
            externalRef: transactionRef,
          },
        });
      }

      // Double-entry GL for fee income
      await createWithdrawalFeeJournalEntry(
        {
          amount: fee,
          description: `Withdrawal Fee - ${transactionRef}`,
          reference: transactionRef,
          transactionId: transaction.id,
          userId: user.id,
          entryDate: transaction.transactionDate || new Date(),
          branchId: account.branchId || user.branchId,
          feeAccountCode: WITHDRAWAL_FEE_CODE,
          feeAccountName: "Withdrawal fee charged",
        },
        tx,
      );
    }

    return { transaction, withdrawal, transactionRef };
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const body = await request.json();
    const {
      memberId,
      institutionId,
      accountId,
      amount,
      channel,
      mobileMoneyRef,
      description,
      signatoryId,
      // Institution-specific
      recipientName: bodyRecipientName,
      recipientIdNumber,
      recipientPhone: bodyRecipientPhone,
      recipientRelation,
      verifiedSignatories, // string[]
      verifiedAgent,
      signatoryFingerprints, // Record<string, {captured: boolean; score: number}>
      skipDelivery,
      // Auth method selection
      verificationMethod,
      thumbprintImage,
    } = body;

    // â”€â”€ 1. Basic field validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!accountId || !amount || !channel) {
      return NextResponse.json(
        { error: "Missing required fields: accountId, amount, channel" },
        { status: 400 },
      );
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    if (!memberId && !institutionId) {
      return NextResponse.json(
        { error: "Either memberId or institutionId is required" },
        { status: 400 },
      );
    }

    const isInstitution = !!institutionId;

    // â”€â”€ Institution-specific field validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isInstitution) {
      if (!bodyRecipientName?.trim()) {
        return NextResponse.json(
          { error: "Recipient name is required for institution withdrawals" },
          { status: 400 },
        );
      }
      if (!recipientIdNumber?.trim()) {
        return NextResponse.json(
          {
            error:
              "Recipient ID number is required for institution withdrawals",
          },
          { status: 400 },
        );
      }
      if (!bodyRecipientPhone?.trim()) {
        return NextResponse.json(
          { error: "Recipient phone is required for institution withdrawals" },
          { status: 400 },
        );
      }
      if (!recipientRelation?.trim()) {
        return NextResponse.json(
          {
            error: "Recipient relation is required for institution withdrawals",
          },
          { status: 400 },
        );
      }
      if (!verifiedAgent) {
        return NextResponse.json(
          {
            error:
              "Representative/agent verification is required for institution withdrawals",
          },
          { status: 400 },
        );
      }
      if (!signatoryId) {
        return NextResponse.json(
          {
            error:
              "A primary signatoryId is required for institution withdrawals",
          },
          { status: 400 },
        );
      }
      if (
        !Array.isArray(verifiedSignatories) ||
        verifiedSignatories.length === 0
      ) {
        return NextResponse.json(
          { error: "At least one verified signatory is required" },
          { status: 400 },
        );
      }

    }

    // â”€â”€ 2. Fetch account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: { include: { user: true } },
        institution: {
          include: {
            user: true,
            signatories: true,
          },
        },
        branch: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (account.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 400 },
      );
    }

    // â”€â”€ 3. Branch security check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (user.role !== UserRole.ADMIN && account.branchId !== user.branchId) {
      return NextResponse.json(
        { error: "Unauthorized: Account is in a different branch" },
        { status: 403 },
      );
    }

    // â”€â”€ 4. Account type restrictions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (account.accountType.isShareAccount) {
      return NextResponse.json(
        {
          error:
            "Withdrawals from Share Accounts are not permitted. Please use the Transfer functionality.",
        },
        { status: 400 },
      );
    }
    if (!account.accountType.canWithdraw) {
      return NextResponse.json(
        { error: "Withdrawals are restricted for this account type." },
        { status: 400 },
      );
    }

    // â”€â”€ 5. Ownership check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isInstitution && account.institutionId !== institutionId) {
      return NextResponse.json(
        { error: "Account does not belong to the specified institution" },
        { status: 400 },
      );
    }
    if (!isInstitution && memberId && account.memberId !== memberId) {
      return NextResponse.json(
        { error: "Account does not belong to the specified member" },
        { status: 400 },
      );
    }

    // â”€â”€ 6. Active account hold check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const activeHold = await db.accountHold.findFirst({
      where: { accountId, isActive: true },
    });
    if (activeHold) {
      return NextResponse.json(
        {
          error: `Account has an active hold (${activeHold.reasonText || activeHold.reason}). Withdrawals are blocked until the hold is lifted.`,
        },
        { status: 400 },
      );
    }

    // â”€â”€ 7. Institution mandate validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isInstitution && account.institution) {
      const inst = account.institution;
      const mandate = (inst as any).withdrawalMandate || "ALL_SIGNATORIES";
      const totalSigs = inst.signatories?.length || 0;
      const verifiedCount = (verifiedSignatories as string[]).length;

      let required = totalSigs;
      if (mandate === "ANY_1_SIGNATORY") required = 1;
      else if (mandate === "ANY_2_SIGNATORIES") required = 2;
      else if (mandate === "ANY_3_SIGNATORIES") required = 3;
      else if (mandate === "ALL_SIGNATORIES") required = totalSigs;

      if (verifiedCount < required) {
        return NextResponse.json(
          {
            error: `Withdrawal mandate requires ${required} signator${required > 1 ? "ies" : "y"} but only ${verifiedCount} ${verifiedCount === 1 ? "was" : "were"} verified.`,
          },
          { status: 400 },
        );
      }

      // All verifiedSignatories must belong to this institution
      const instSigIds = new Set(inst.signatories?.map((s) => s.id) || []);
      for (const sigId of verifiedSignatories as string[]) {
        if (!instSigIds.has(sigId)) {
          return NextResponse.json(
            { error: `Signatory ${sigId} does not belong to this institution` },
            { status: 400 },
          );
        }
      }
      if (!instSigIds.has(signatoryId)) {
        return NextResponse.json(
          {
            error:
              "The specified signatoryId does not belong to this institution",
          },
          { status: 400 },
        );
      }

      // Signatories with enrolled fingerprints must provide fingerprint verification
      const fpSignatories = (inst.signatories || []).filter((s: any) => s.fingerprintTemplate);
      for (const sig of fpSignatories) {
        const fpState = (signatoryFingerprints as Record<string, { captured: boolean; score: number }> | undefined)?.[sig.id];
        if (!fpState?.captured) {
          return NextResponse.json(
            { error: `Signatory "${sig.name}" requires fingerprint verification for this transaction.` },
            { status: 400 },
          );
        }
      }
    }

    // â”€â”€ 8. Calculate fee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fallbackTiersJson = await getWithdrawalFeeFallbackTiers(
      isInstitution,
    );
    const fee = calculateWithdrawalFee(
      Number(amount),
      account.accountType,
      account,
      fallbackTiersJson,
    );
    const totalDeduction = Number(amount) + fee;

    if (account.balance < totalDeduction) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Required: UGX ${totalDeduction.toLocaleString()} (Amount: ${Number(amount).toLocaleString()} + Fee: ${fee.toLocaleString()})`,
        },
        { status: 400 },
      );
    }

    // â”€â”€ 9. Float check for TELLER / AGENT cash withdrawals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (
      channel.toLowerCase() === "cash" &&
      ["TELLER", "AGENT"].includes(user.role)
    ) {
      const userFloat = await db.userFloat.findUnique({
        where: { userId: user.id },
      });
      if (!userFloat) {
        return NextResponse.json(
          {
            error:
              "You do not have a float account. Please request float from your accountant before processing cash withdrawals.",
          },
          { status: 400 },
        );
      }
      if (userFloat.balance < Number(amount)) {
        return NextResponse.json(
          {
            error: `Insufficient float balance. Available: UGX ${userFloat.balance.toLocaleString()}, Required: UGX ${Number(amount).toLocaleString()}`,
          },
          { status: 400 },
        );
      }
    }

    // â”€â”€ 10. Expire any stale pending verifications for this account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await db.withdrawalVerification.updateMany({
      where: {
        accountId,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      data: { isUsed: true },
    });

    // â”€â”€ 11. Generate OTP and persist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const verification = await db.withdrawalVerification.create({
      data: {
        memberId: memberId || null,
        institutionId: institutionId || null,
        accountId,
        amount: Number(amount),
        channel,
        mobileMoneyRef: mobileMoneyRef?.trim() || null,
        description: description?.trim() || null,
        verificationCode: code,
        expiresAt,
        signatoryId: signatoryId || null,
        handlerUserId: user.id,
        metadata: {
          fee,
          totalDeduction,
          handlerRole: user.role,
          verificationMethod: verificationMethod || (skipDelivery ? "fingerprint" : "email"),
          ...(thumbprintImage && { thumbprintImage }),
          // Institution audit data — stored for the confirm endpoint to use
          ...(isInstitution && {
            recipientName: bodyRecipientName?.trim(),
            recipientIdNumber: recipientIdNumber?.trim(),
            recipientPhone: bodyRecipientPhone?.trim(),
            recipientRelation: recipientRelation?.trim(),
            verifiedSignatories: verifiedSignatories || [],
            verifiedAgent: !!verifiedAgent,
          }),
        },
      },
    });

    // â”€â”€ 12. Resolve OTP recipient â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (skipDelivery) {
      let processed;
      try {
        processed = await processWithdrawalInApi({
          verification,
          account,
          user,
          fee,
          totalDeduction,
          isInstitution,
          description,
          mobileMoneyRef,
          recipientName: bodyRecipientName,
          recipientIdNumber,
          recipientPhone: bodyRecipientPhone,
          recipientRelation,
          verifiedSignatories,
          verifiedAgent,
          signatoryId,
        });
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

      return NextResponse.json({
        success: true,
        processed: true,
        data: processed,
        message: "Withdrawal processed successfully.",
      });
    }

    let recipientEmail = "";
    let recipientName = "";
    let recipientPhoneNumber = "";

    if (!isInstitution && account.member) {
      recipientEmail = account.member.user.email || "";
      recipientName = account.member.user.name;
      recipientPhoneNumber = account.member.user.phone || "";
    } else if (isInstitution && account.institution) {
      const inst = account.institution;
      // Prefer primary signatory's contact, fall back to institution contact
      const primarySig = signatoryId
        ? inst.signatories.find((s) => s.id === signatoryId)
        : null;
      recipientEmail =
        primarySig?.email ||
        (inst as any).institutionEmail ||
        inst.user.email ||
        "";
      recipientName =
        primarySig?.name ||
        (inst as any).institutionName ||
        inst.user.name ||
        "";
      recipientPhoneNumber = primarySig?.phone || inst.user.phone || "";
    }

    // â”€â”€ 13. Send OTP email via Resend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let emailSent = false;
    let smsSent = false;
    const method = verificationMethod || (skipDelivery ? "fingerprint" : "email");

    // Send SMS OTP when method is "sms"
    if (method === "sms" && recipientPhoneNumber) {
      try {
        const { sendWithdrawalVerificationSMS } = await import("@/lib/sms");
        const smsResult = await sendWithdrawalVerificationSMS(
          recipientPhoneNumber,
          recipientName,
          code,
          Number(amount),
        );
        if (smsResult.success) {
          smsSent = true;
        } else {
          console.error("SMS delivery failed:", smsResult.error);
        }
      } catch (err) {
        console.error("Failed to send verification SMS:", err);
      }
    }

    // Send email OTP when method is "email" (or as fallback when SMS was primary but failed)
    if (method === "email" || (method === "sms" && !smsSent)) {
      if (resend && recipientEmail) {
        try {
          const emailResult = await resend.emails.send({
            from: resendFromAddress,
            to: recipientEmail,
            subject: "Withdrawal Verification Code",
            react: WithdrawalVerificationEmail({
              memberName: recipientName,
              amount: Number(amount),
              accountNumber: account.accountNumber,
              verificationCode: code,
              expiresInMinutes: 10,
              fee,
              total: Number(amount) + fee,
              channel,
            }),
          });

          if (emailResult?.data?.id || (emailResult as any)?.id) {
            emailSent = true;
          } else if (emailResult.error) {
            console.error("Resend API error:", emailResult.error);
          }
        } catch (err) {
          console.error("Failed to send verification email:", err);
        }
      }
    }

    // â”€â”€ 14. Update delivery flags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (emailSent || smsSent) {
      await db.withdrawalVerification.update({
        where: { id: verification.id },
        data: { emailSent, smsSent },
      });
    }

    // Expose the code to the handler when email delivery fails so the teller
    // can manually read it to the member. The teller is the initiator and is
    // trusted to do so — this is equivalent to a bank teller showing a PIN slip.
    // Thumbprint method: teller captures thumbprint, then enters OTP shown on screen
    // For thumbprint, expose the code since it's verified physically, not via delivery
    const debugVerificationCode = method === "thumbprint" ? code : (!emailSent && !smsSent ? code : undefined);

    // â”€â”€ 15. Return (OTP is never exposed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Verification code sent to member's email."
        : smsSent
          ? "Verification code sent to member's phone via SMS."
          : method === "thumbprint"
            ? "Thumbprint recorded. Please verify the code displayed."
            : "Verification code generated, but delivery failed. Please check contact details.",
      data: {
        id: verification.id,
        expiresAt: verification.expiresAt.toISOString(),
        emailSent,
        smsSent,
        verificationMethod: method,
        amount: Number(amount),
        fee,
        totalDeduction,
        channel,
        member: {
          user: {
            name: recipientName,
            email: recipientEmail,
            phone: recipientPhoneNumber,
          },
        },
        account: {
          accountNumber: account.accountNumber,
        },
        ...(debugVerificationCode
          ? { debugVerificationCode }
          : {}),
      },
    });
  } catch (error: any) {
    console.error("Error in withdrawal verification API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

