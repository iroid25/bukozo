import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(amount);

// GET /api/v1/loan-write-offs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();
    const user = session.user as any;

    let whereCondition: any = {};
    if (user.role === "LOANOFFICER") {
      whereCondition.requestedByUserId = user.id;
    } else if (!["BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "AUDITOR"].includes(user.role)) {
      return ApiErrors.forbidden();
    }

    const writeOffs = await db.loanWriteOff.findMany({
      where: whereCondition,
      include: {
        loan: {
          include: {
            member: { include: { user: true, accounts: true } },
            loanApplication: { include: { loanProduct: true } },
          },
        },
        requestedBy: true,
        approvedBy: true,
      },
      orderBy: { requestedAt: "desc" },
    });

    return successResponse(writeOffs);
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}

// POST /api/v1/loan-write-offs
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();
    const user = session.user as any;

    if (!["LOANOFFICER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Only loan officers can create write-off requests" }, { status: 403 });
    }

    const { loanId, reason, minuteNumber, notes } = await request.json();

    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { include: { user: true, accounts: true } },
        loanApplication: { include: { loanProduct: true } },
        repayments: true,
      },
    });

    if (!loan) return NextResponse.json({ success: false, error: "Loan not found" }, { status: 404 });

    const existingWriteOff = await db.loanWriteOff.findFirst({
      where: { loanId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (existingWriteOff) {
      return NextResponse.json({ success: false, error: "This loan already has a pending or approved write-off request" }, { status: 400 });
    }

    const totalPaid = loan.amountPaid;
    const totalBalance = loan.outstandingBalance;
    const principalPortion = loan.amountGranted;
    const paymentRatio = totalPaid / loan.totalAmountDue;
    const principalPaid = principalPortion * paymentRatio;
    const interestPaid = totalPaid - principalPaid;
    const principalBalance = loan.amountGranted - principalPaid;
    const interestBalance = totalBalance - principalBalance;

    const writeOff = await db.loanWriteOff.create({
      data: {
        loanId, amountDisbursed: loan.amountGranted, principalPaid, interestPaid,
        penaltyPaid: 0, totalPaid, principalBalance, interestBalance, penaltyBalance: 0,
        totalBalance, reason, minuteNumber: minuteNumber || null, notes: notes || null,
        requestedByUserId: user.id, status: "PENDING",
      },
      include: {
        loan: { include: { member: { include: { user: true } }, loanApplication: { include: { loanProduct: true } } } },
        requestedBy: true,
      },
    });

    const managers = await db.user.findMany({ where: { role: { in: ["BRANCHMANAGER", "ADMIN"] }, isActive: true } });
    for (const manager of managers) {
      await db.notification.create({
        data: {
          userId: manager.id, type: "IN_APP", subject: "New Loan Write-Off Request",
          message: `${user.name} has requested to write off a loan for ${loan.member.user.name}. Amount: ${formatCurrency(totalBalance)}`,
          targetAddress: `/dashboard/loan-write-offs`, sentAt: new Date(), isRead: false, status: "SENT",
        },
      });
    }

    return NextResponse.json({ success: true, message: "Write-off request created successfully", data: writeOff });
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}
