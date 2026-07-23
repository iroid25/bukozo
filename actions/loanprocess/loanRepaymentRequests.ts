// FILE: actions/incomeandexp/loanRepaymentRequests.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import crypto from "crypto";
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

export async function createRepaymentRequest(data: {
  loanId: string;
  accountId: string;
  amount: number;
  notes?: string;
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
      "TELLER",
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

    const { loanId, accountId, amount, notes } = data;

    if (!loanId || !accountId || !amount) {
      return {
        success: false,
        error: "Missing required fields",
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
      return {
        success: false,
        error: "Loan not found",
      };
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

    if (amount > loan.outstandingBalance) {
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

    const approvalToken = generateApprovalToken();
    const smsCode = generateSMSCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const repaymentRequest = await db.loanRepaymentRequest.create({
      data: {
        loanId,
        memberId: loan.memberId,
        accountId,
        amount,
        requestedByUserId: user.id,
        approvalToken,
        smsCode,
        expiresAt,
        notes: notes || null,
      },
    });

    try {
      const memberEmail = loan.member.user.email;
      if (memberEmail) {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: memberEmail,
          subject: "Loan Repayment Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Loan Repayment Verification</h2>
              <p>Dear ${loan.member.user.name},</p>
              <p>A loan repayment is being processed by ${user.name}.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Repayment Details:</h3>
                <table style="width: 100%;">
                  <tr>
                    <td><strong>Amount:</strong></td>
                    <td style="color: #dc2626; font-weight: bold;">${formatCurrency(amount)}</td>
                  </tr>
                  <tr>
                    <td><strong>Account:</strong></td>
                    <td>${account.accountNumber}</td>
                  </tr>
                  <tr>
                    <td><strong>Loan Product:</strong></td>
                    <td>${loan.loanApplication.loanProduct.name}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px;"><strong>Your Verification Code:</strong></p>
                <p style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 10px 0; letter-spacing: 5px;">${smsCode}</p>
                <p style="margin: 0; font-size: 12px; color: #92400e;">Share this code with the loan officer to complete the transaction</p>
              </div>
              
              <p style="color: #dc2626; font-size: 14px;">⚠️ This code expires in 30 minutes</p>
              <p style="color: #6b7280; font-size: 12px;">If you didn't request this, please contact us immediately.</p>
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
        message: `Verification code for loan repayment of ${formatCurrency(
          amount,
        )}: ${smsCode}. Share this with ${user.name} to complete the transaction.`,
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

    const result = await db.$transaction(async (tx) => {
      await tx.loanRepaymentRequest.update({
        where: { id: repaymentRequest.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      const repayment = await tx.loanRepayment.create({
        data: {
          loanId: repaymentRequest.loanId as string,
          memberId: repaymentRequest.memberId as string,
          amount: repaymentRequest.amount,
          repaymentDate: new Date(),
          handlerUserId: user.id,
          channel: "AUTOMATIC_DEDUCTION",
          mobileMoneyRef: `REQ-${repaymentRequest.id.slice(0, 8)}`,
        },
      });

      const newOutstanding =
        (repaymentRequest.loan as any).outstandingBalance -
        repaymentRequest.amount;
      const newPaid =
        (repaymentRequest.loan as any).amountPaid + repaymentRequest.amount;

      await tx.loan.update({
        where: { id: repaymentRequest.loanId as string },
        data: {
          outstandingBalance: Math.max(0, newOutstanding),
          amountPaid: newPaid,
          status:
            newOutstanding <= 0
              ? "REPAID"
              : (repaymentRequest.loan as any).status,
        },
      });

      await tx.account.update({
        where: { id: repaymentRequest.accountId as string },
        data: {
          balance: { decrement: repaymentRequest.amount },
        },
      });

      await tx.transaction.create({
        data: {
          transactionRef: `LR-AUTO-${repayment.id}`,
          memberId: repaymentRequest.memberId as string,
          accountId: repaymentRequest.accountId as string,
          type: "LOAN_REPAYMENT",
          amount: repaymentRequest.amount,
          status: "COMPLETED",
          description: `Automatic loan repayment - ${(repaymentRequest.loan as any).loanApplication.loanProduct.name}`,
          transactionDate: new Date(),
          processedByUserId: user.id,
          channel: "AUTOMATIC_DEDUCTION",
          loanId: repaymentRequest.loanId as string,
        },
      });

      return { repayment, newOutstanding };
    });

    await db.notification.create({
      data: {
        userId: (repaymentRequest.loan as any).member.user.id,
        type: "IN_APP",
        subject: "Loan Repayment Processed",
        message: `Your loan repayment of ${formatCurrency(
          repaymentRequest.amount,
        )} has been processed successfully. New outstanding balance: ${formatCurrency(
          Math.max(0, result.newOutstanding),
        )}`,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    revalidatePath("/dashboard/loan-repayments");
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
