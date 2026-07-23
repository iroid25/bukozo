// FILE: app/api/v1/loanRepaymentRequests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { Resend } from "resend";
import crypto from "crypto";
import { EMAIL_FROM } from "@/lib/email";

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

// POST - Create new repayment request and send code
export async function POST(request: NextRequest) {

  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 },
      );
    }

    const allowedRoles = [
      "LOANOFFICER",
      "TELLER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
    ];

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to create repayment requests" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const { loanId, accountId, amount, notes } = body;

    // Validate input
    if (!loanId || !accountId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }


    // Get loan details
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
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }


    if (loan.member.accounts.length === 0) {
      return NextResponse.json(
        { error: "Account not found or doesn't belong to this member" },
        { status: 400 },
      );
    }

    const account = loan.member.accounts[0];

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 },
      );
    }

    if (amount > loan.outstandingBalance) {
      return NextResponse.json(
        {
          error: `Amount cannot exceed outstanding balance of ${formatCurrency(
            loan.outstandingBalance,
          )}`,
        },
        { status: 400 },
      );
    }

    if (amount > account.balance) {
      return NextResponse.json(
        {
          error: `Insufficient account balance. Available: ${formatCurrency(
            account.balance,
          )}`,
        },
        { status: 400 },
      );
    }

    // Generate tokens
    const approvalToken = generateApprovalToken();
    const smsCode = generateSMSCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes


    // Create request
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
                    <td style="color: #dc2626; font-weight: bold;">${formatCurrency(
                      amount,
                    )}</td>
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
              
              <p style="color: #dc2626; font-size: 14px;">âš ï¸ This code expires in 30 minutes</p>
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
      console.error("âŒ Error sending email:", emailError);
      // Continue even if email fails
    }

    // Create notification
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


    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent to member",
        requestId: repaymentRequest.id,
        memberName: loan.member.user.name,
        memberEmail: loan.member.user.email,
        memberPhone: loan.member.user.phone,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("âŒ Error creating repayment request:", error);
    return NextResponse.json(
      {
        error: "Failed to create repayment request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
