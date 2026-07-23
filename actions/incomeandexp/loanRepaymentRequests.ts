// FILE: actions/loanRepaymentRequests.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import crypto from "crypto";
import { createNativeLoanRepaymentLedgerEntries } from "@/lib/services/loan-ledger";
import { EMAIL_FROM } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);

// Helper to process the repayment transaction
async function processRepaymentTransaction(
  requestId: string,
  userId: string,
  loanId: string,
  memberId: string,
  accountId: string,
  amount: number,
  loan: any,
  isAutoApproval: boolean = false,
  breakdown?: {
    interestAmount?: number;
    penaltyAmount?: number;
    principalAmount?: number;
  },
) {
  return await db.$transaction(async (tx) => {
    // 1. Update Request Status
    await tx.loanRepaymentRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    // Use breakdown from arguments if provided, otherwise default to full amount as principal (old behavior)
    const interestAmount = breakdown?.interestAmount || 0;
    const penaltyAmount = breakdown?.penaltyAmount || 0;
    const principalAmount =
      breakdown?.principalAmount || amount - interestAmount - penaltyAmount;

    // 2. Create Repayment Record
    const repayment = await tx.loanRepayment.create({
      data: {
        loanId,
        memberId,
        amount,
        repaymentDate: new Date(),
        handlerUserId: userId,
        channel: "AUTOMATIC_DEDUCTION",
        mobileMoneyRef: `REQ-${requestId.slice(0, 8)}`,
        interestPaid: interestAmount,
        penaltyPaid: penaltyAmount,
        principalPaid: principalAmount,
      },
    });

    // 3. Update Loan Balance
    const newOutstanding = loan.outstandingBalance - amount;
    const newPaid = loan.amountPaid + amount;

    await tx.loan.update({
      where: { id: loanId },
      data: {
        outstandingBalance: Math.max(0, newOutstanding),
        amountPaid: newPaid,
        interestPaid: { increment: interestAmount },
        penaltyPaid: { increment: penaltyAmount },
        principalPaid: { increment: principalAmount },
        status: newOutstanding <= 0 ? "REPAID" : loan.status,
      },
    });

    // 4. Deduct from Account
    await tx.account.update({
      where: { id: accountId },
      data: {
        balance: { decrement: amount },
      },
    });

    // 5. Create Transaction Record
    await tx.transaction.create({
      data: {
        transactionRef: `LR-AUTO-${repayment.id}`,
        memberId,
        accountId,
        type: "LOAN_REPAYMENT",
        amount,
        status: "COMPLETED",
        description: `Automatic loan repayment - ${loan.loanApplication.loanProduct.name} (P: ${formatCurrency(principalAmount)}, I: ${formatCurrency(interestAmount)}, Pen: ${formatCurrency(penaltyAmount)})`,
        transactionDate: new Date(),
        processedByUserId: userId,
        channel: "AUTOMATIC_DEDUCTION",
        loanId,
      },
    });

    // 6. Create native loan ledger entries for repayment and penalty movements
    await createNativeLoanRepaymentLedgerEntries(tx, {
      loanId,
      transactionDate: repayment.repaymentDate,
      voucherNo: repayment.id.substring(0, 8).toUpperCase(),
      principalAmount,
      interestAmount,
      penaltyAmount,
      initialPrincipalBalance: loan.amountGranted,
      initialInterestBalance: loan.interestAmount || 0,
    });

    // 7. Create Split Journal Entry
    try {
      const { createSplitLoanRepaymentJournalEntry } =
        await import("@/lib/journal-entries-extended");
      await createSplitLoanRepaymentJournalEntry(
        {
          principalAmount: principalAmount,
          interestAmount: interestAmount,
          penaltyAmount: penaltyAmount,
          description: `Loan Repayment (Internal) - ${loan.member.user.name} - ${loanId.slice(0, 8)}`,
          reference: repayment.id.substring(0, 8).toUpperCase(),
          transactionId: loanId,
          userId: userId,
          entryDate: repayment.repaymentDate,
          branchId: loan.branchId,
          debitAccountCode: "201001", // Member Savings Control Account
          ledgerAccountId:
            loan.loanApplication.loanProduct.ledgerAccountId || undefined,
          interestAccountId:
            loan.loanApplication.loanProduct.interestAccountId || undefined,
          penaltyAccountId:
            loan.loanApplication.loanProduct.penaltyAccountId || undefined,
        },
        tx,
      );
    } catch (ledgerErr) {
      console.error(
        "Ledger split entry failed in processRepaymentTransaction:",
        ledgerErr,
      );
    }

    // 8. Notification
    const message = isAutoApproval
      ? `Money has been transferred from your savings account to your loan account.`
      : `Your loan repayment of ${formatCurrency(amount)} has been processed successfully.`;

    await tx.notification.create({
      data: {
        userId: loan.member.user.id,
        type: "IN_APP",
        subject: isAutoApproval
          ? "Loan Repayment Transfer"
          : "Loan Repayment Processed",
        message,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    return { repayment, newOutstanding };
  });
}

export async function createRepaymentRequest(data: {
  loanId: string;
  accountId: string;
  amount: number;
  notes?: string;
  interestAmount?: number;
  penaltyAmount?: number;
  principalAmount?: number;
}) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const allowedRoles = [
      "LOANOFFICER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
    ];

    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "You don't have permission to create repayment requests",
      };
    }

    const {
      loanId,
      accountId,
      amount,
      notes,
      interestAmount = 0,
      penaltyAmount = 0,
      principalAmount = 0,
    } = data;

    if (!loanId || !accountId || !amount) {
      return {
        success: false,
        error: "Missing required fields",
      };
    }

    // Validate breakdown
    if (
      Math.abs(amount - (interestAmount + penaltyAmount + principalAmount)) > 1
    ) {
      return {
        success: false,
        error:
          "The sum of interest, penalty, and principal must equal the total repayment amount",
      };
    }

    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              where: {
                id: accountId,
                status: "ACTIVE",
              },
            },
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
      },
    });

    if (!loan) {
      return { success: false, error: "Loan not found" };
    }

    if (loan.member.accounts.length === 0) {
      return {
        success: false,
        error: "Account not found or doesn't belong to this member",
      };
    }

    const account = loan.member.accounts[0];

    if (amount <= 0) {
      return {
        success: false,
        error: "Amount must be greater than zero",
      };
    }

    if (amount > Number((loan.outstandingBalance + 0.1).toFixed(2))) {
      return {
        success: false,
        error: `Amount cannot exceed outstanding balance of ${formatCurrency(
          loan.outstandingBalance,
        )}`,
      };
    }

    if (amount > account.balance) {
      return {
        success: false,
        error: `Insufficient account balance. Available: ${formatCurrency(
          account.balance,
        )}`,
      };
    }

    // CHECK FOR IMMEDIATE PROCESSING (Bypass)
    const canBypassVerification = [
      "LOANOFFICER",
      "ADMIN",
      "BRANCHMANAGER",
      "ACCOUNTANT",
    ].includes(user.role);

    const approvalToken = generateApprovalToken();
    const smsCode = canBypassVerification ? null : generateSMSCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const repaymentRequest = await db.loanRepaymentRequest.create({
      data: {
        loanId,
        memberId: loan.memberId,
        accountId,
        amount,
        interestPaid: interestAmount,
        penaltyPaid: penaltyAmount,
        principalPaid: principalAmount,
        requestedByUserId: user.id,
        approvalToken,
        smsCode,
        expiresAt,
        notes: notes || null,
        status: canBypassVerification ? "APPROVED" : "PENDING",
      },
    });

    // IF BYPASS: Process Immediately
    if (canBypassVerification) {
      await db.loanRepaymentRequest.update({
        where: { id: repaymentRequest.id },
        data: { status: "PENDING" },
      });

      const result = await processRepaymentTransaction(
        repaymentRequest.id,
        user.id,
        loanId,
        loan.memberId,
        accountId,
        amount,
        loan,
        true, // isAutoApproval
        { interestAmount, penaltyAmount, principalAmount },
      );

      revalidatePath("/dashboard/loan-repayments/initiate");
      revalidatePath("/dashboard/my-loans");

      return {
        success: true,
        message: "Repayment processed successfully (Auto-approved)",
        processedImmediately: true,
        repayment: result.repayment,
        newOutstandingBalance: Math.max(0, result.newOutstanding),
      };
    }

    // NORMAL FLOW: Send Verification Code
    try {
      const memberEmail = loan.member.user.email;
      if (memberEmail && smsCode) {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: memberEmail,
          subject: "Loan Repayment Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Loan Repayment Verification</h2>
              <p>Dear ${loan.member.user.name},</p>
              <p>A loan repayment is being processed by ${user.name}.</p>
              <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px;"><strong>Your Verification Code:</strong></p>
                <p style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 10px 0; letter-spacing: 5px;">${smsCode}</p>
              </div>
              <p><strong>Repayment Breakdown:</strong></p>
              <ul style="list-style: none; padding: 0;">
                <li>Principal: ${formatCurrency(principalAmount)}</li>
                <li>Interest: ${formatCurrency(interestAmount)}</li>
                <li>Penalty: ${formatCurrency(penaltyAmount)}</li>
                <li style="border-top: 1px solid #ddd; margin-top: 5px; padding-top: 5px;"><strong>Total: ${formatCurrency(amount)}</strong></li>
              </ul>
              <p style="color: #dc2626;">⚠️ This code expires in 30 minutes</p>
            </div>
          `,
        });

        await db.loanRepaymentRequest.update({
          where: { id: repaymentRequest.id },
          data: { emailSent: true },
        });
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    await db.notification.create({
      data: {
        userId: loan.member.user.id,
        type: "IN_APP",
        subject: "Loan Repayment Verification Code",
        message: `Verification code: ${smsCode}. Total: ${formatCurrency(amount)}`,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    revalidatePath("/dashboard/loan-repayments/initiate");

    return {
      success: true,
      message: "Verification code sent to member",
      requestId: repaymentRequest.id,
      memberName: loan.member.user.name,
      memberEmail: loan.member.user.email,
      memberPhone: loan.member.user.phone,
    };
  } catch (error) {
    console.error("Error creating repayment request:", error);
    return {
      success: false,
      error: "Failed to create repayment request",
    };
  }
}

export async function verifyRepaymentCode(
  requestId: string,
  verificationCode: string,
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const repaymentRequest = await db.loanRepaymentRequest.findUnique({
      where: { id: requestId },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
        account: true,
      },
    });

    if (!repaymentRequest || !repaymentRequest.loan) {
      return { success: false, error: "Request or associated loan not found" };
    }

    if (repaymentRequest.status !== "PENDING") {
      return {
        success: false,
        error: `This request has already been ${repaymentRequest.status.toLowerCase()}`,
      };
    }

    if (new Date() > repaymentRequest.expiresAt) {
      await db.loanRepaymentRequest.update({
        where: { id: repaymentRequest.id },
        data: { status: "EXPIRED" },
      });
      return { success: false, error: "Verification code has expired" };
    }

    if (repaymentRequest.smsCode !== verificationCode) {
      return { success: false, error: "Invalid verification code" };
    }

    const currentAccount = await db.account.findUnique({
      where: { id: repaymentRequest.accountId as string },
    });

    if (!currentAccount || currentAccount.balance < repaymentRequest.amount) {
      return { success: false, error: "Insufficient account balance" };
    }

    const result = await processRepaymentTransaction(
      repaymentRequest.id,
      user.id,
      repaymentRequest.loanId as string,
      repaymentRequest.memberId as string,
      repaymentRequest.accountId as string,
      repaymentRequest.amount,
      repaymentRequest.loan,
      false, // isAutoApproval = false (Verified by code)
      {
        interestAmount: repaymentRequest.interestPaid,
        penaltyAmount: repaymentRequest.penaltyPaid,
        principalAmount: repaymentRequest.principalPaid,
      },
    );

    revalidatePath("/dashboard/loan-repayments/initiate");
    revalidatePath("/dashboard/my-loans");

    return {
      success: true,
      message: "Loan repayment processed successfully",
      repayment: result.repayment,
      newOutstandingBalance: Math.max(0, result.newOutstanding),
    };
  } catch (error) {
    console.error("Error verifying repayment:", error);
    return {
      success: false,
      error: "Failed to process repayment",
    };
  }
}
