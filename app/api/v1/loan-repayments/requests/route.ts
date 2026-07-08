// app/api/v1/loan-repayments/requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanRepaymentRequestService } from "@/services/loan-repayment-request.service";
import { Resend } from "resend";
import crypto from "crypto";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";

const resend = new Resend(process.env.RESEND_API_KEY!);

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const allowedRoles = [
      "LOANOFFICER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
    ];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const data = await request.json();
    const {
      loanId,
      accountId,
      amount,
      notes,
      interestAmount = 0,
      penaltyAmount = 0,
      principalAmount = 0,
      isInstitution = false,
    } = data;

    if (!loanId || !accountId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate breakdown
    if (
      Math.abs(amount - (interestAmount + penaltyAmount + principalAmount)) > 1
    ) {
      return NextResponse.json(
        { success: false, error: "Total mismatch in breakdown" },
        { status: 400 },
      );
    }

    let loan;
    let memberId;
    let institutionId;

    if (isInstitution) {
      loan = await db.institutionLoan.findUnique({
        where: { id: loanId },
        include: {
          institution: {
            include: {
              user: true,
              accounts: {
                where: { id: accountId, status: "ACTIVE" },
              },
            },
          },
          application: { include: { loanProduct: true } },
        },
      });

      if (!loan)
        return NextResponse.json(
          { success: false, error: "Institution loan not found" },
          { status: 404 },
        );
      if (loan.institution.accounts.length === 0)
        return NextResponse.json(
          { success: false, error: "Institution account not found" },
          { status: 404 },
        );

      institutionId = loan.institutionId;
      // For institutions, we use the userId linked to the institution as memberId/user if needed,
      // but the schema now has institutionId field.
    } else {
      loan = await db.loan.findUnique({
        where: { id: loanId },
        include: {
          member: {
            include: {
              user: true,
              accounts: {
                where: { id: accountId, status: "ACTIVE" },
              },
            },
          },
          loanApplication: { include: { loanProduct: true } },
        },
      });

      if (!loan)
        return NextResponse.json(
          { success: false, error: "Loan not found" },
          { status: 404 },
        );
      if (loan.member.accounts.length === 0)
        return NextResponse.json(
          { success: false, error: "Member account not found" },
          { status: 404 },
        );

      memberId = loan.memberId;

      try {
        await assertMemberCanTransact(memberId);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Member is not eligible to transact yet",
          },
          { status: 400 },
        );
      }
    }

    const account = isInstitution
      ? (loan as any).institution.accounts[0]
      : (loan as any).member.accounts[0];
    const user = isInstitution
      ? (loan as any).institution.user
      : (loan as any).member.user;

    if (amount > Number(((loan as any).outstandingBalance + 0.1).toFixed(2))) {
      return NextResponse.json(
        { success: false, error: "Amount exceeds outstanding balance" },
        { status: 400 },
      );
    }
    if (amount > account.balance) {
      return NextResponse.json(
        { success: false, error: "Insufficient account balance" },
        { status: 400 },
      );
    }

    const canBypassVerification = [
      "LOANOFFICER",
      "ADMIN",
      "BRANCHMANAGER",
      "ACCOUNTANT",
    ].includes(session.user.role);
    const approvalToken = generateApprovalToken();
    const smsCode = canBypassVerification ? null : generateSMSCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const repaymentRequestData: any = {
      accountId,
      amount,
      interestPaid: interestAmount,
      penaltyPaid: penaltyAmount,
      principalPaid: principalAmount,
      requestedByUserId: session.user.id,
      approvalToken,
      smsCode,
      expiresAt,
      notes: notes || null,
      status: canBypassVerification ? "APPROVED" : "PENDING",
    };

    if (isInstitution) {
      repaymentRequestData.institutionLoanId = loanId;
      repaymentRequestData.institutionId = institutionId;
    } else {
      repaymentRequestData.loanId = loanId;
      repaymentRequestData.memberId = memberId;
    }

    const repaymentRequest = await db.loanRepaymentRequest.create({
      data: repaymentRequestData,
    });

    if (canBypassVerification) {
      // Process Immediately
      await db.loanRepaymentRequest.update({
        where: { id: repaymentRequest.id },
        data: { status: "PENDING" },
      });

      const result =
        await LoanRepaymentRequestService.processRepaymentTransaction(
          repaymentRequest.id,
          session.user.id,
          isInstitution ? undefined : loanId,
          isInstitution ? undefined : memberId,
          accountId,
          amount,
          loan as any,
          true,
          { interestAmount, penaltyAmount, principalAmount },
          isInstitution ? loanId : undefined,
          isInstitution ? institutionId : undefined,
        );

      return NextResponse.json({
        success: true,
        message: "Repayment processed successfully (Auto-approved)",
        processedImmediately: true,
        repayment: result.repayment,
        newOutstandingBalance: Math.max(0, result.newOutstanding),
      });
    }

    // Normal flow: Send code
    const memberEmail = user?.email;
    if (memberEmail && smsCode) {
      try {
        await resend.emails.send({
          from: "BukonzoTeachersSacco <info@maripatechagency.com>",
          to: memberEmail,
          subject: "Loan Repayment Verification Code",
          html: `<p>Verification code: <strong>${smsCode}</strong></p><p>Total: ${formatCurrency(amount)}</p>`,
        });
        await db.loanRepaymentRequest.update({
          where: { id: repaymentRequest.id },
          data: { emailSent: true },
        });
      } catch (err) {
        console.error("Email send failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to member",
      requestId: repaymentRequest.id,
      memberName: isInstitution
        ? (loan as any).institution.institutionName
        : (loan as any).member.user.name,
      memberEmail: user?.email,
      memberPhone: user?.phone,
    });
  } catch (error: any) {
    console.error("API Repayment Request Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
