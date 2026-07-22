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
        institutionLoan: {
          include: {
            institution: { include: { user: true } },
            application: { include: { loanProduct: true } },
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

    const { loanId, institutionLoanId, reason, minuteNumber, notes } = await request.json();

    if (!loanId && !institutionLoanId) {
      return NextResponse.json({ success: false, error: "loanId or institutionLoanId is required" }, { status: 400 });
    }
    if (loanId && institutionLoanId) {
      return NextResponse.json({ success: false, error: "Provide only one of loanId or institutionLoanId" }, { status: 400 });
    }

    let loan: any = null;
    let institutionLoan: any = null;
    let ownerName = "";

    if (loanId) {
      loan = await db.loan.findUnique({
        where: { id: loanId },
        include: {
          member: { include: { user: true, accounts: true } },
          loanApplication: { include: { loanProduct: true } },
          repayments: true,
        },
      });
      if (!loan) return NextResponse.json({ success: false, error: "Loan not found" }, { status: 404 });
      ownerName = loan.member.user.name;
    } else {
      institutionLoan = await db.institutionLoan.findUnique({
        where: { id: institutionLoanId },
        include: {
          institution: { include: { user: true } },
          application: { include: { loanProduct: true } },
          repayments: true,
        },
      });
      if (!institutionLoan) return NextResponse.json({ success: false, error: "Institution loan not found" }, { status: 404 });
      ownerName = institutionLoan.institution.institutionName;
    }

    const existingWriteOff = await db.loanWriteOff.findFirst({
      where: loanId
        ? { loanId, status: { in: ["PENDING", "APPROVED"] } }
        : { institutionLoanId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (existingWriteOff) {
      return NextResponse.json({ success: false, error: "This loan already has a pending or approved write-off request" }, { status: 400 });
    }

    const source = loan || institutionLoan;
    const totalPaid = source.amountPaid;
    const totalBalance = source.outstandingBalance;
    const principalPortion = source.amountGranted;
    const paymentRatio = totalPaid / source.totalAmountDue;
    const principalPaid = principalPortion * paymentRatio;
    const interestPaid = totalPaid - principalPaid;
    const principalBalance = source.amountGranted - principalPaid;
    const interestBalance = totalBalance - principalBalance;

    const writeOff = await db.loanWriteOff.create({
      data: {
        loanId: loanId || null,
        institutionLoanId: institutionLoanId || null,
        amountDisbursed: source.amountGranted, principalPaid, interestPaid,
        penaltyPaid: 0, totalPaid, principalBalance, interestBalance, penaltyBalance: 0,
        totalBalance, reason, minuteNumber: minuteNumber || null, notes: notes || null,
        requestedByUserId: user.id, status: "PENDING",
      },
      include: {
        loan: { include: { member: { include: { user: true } }, loanApplication: { include: { loanProduct: true } } } },
        institutionLoan: { include: { institution: { include: { user: true } }, application: { include: { loanProduct: true } } } },
        requestedBy: true,
      },
    });

    const managers = await db.user.findMany({ where: { role: { in: ["BRANCHMANAGER", "ADMIN"] }, isActive: true } });
    for (const manager of managers) {
      await db.notification.create({
        data: {
          userId: manager.id, type: "IN_APP", subject: "New Loan Write-Off Request",
          message: `${user.name} has requested to write off a loan for ${ownerName}. Amount: ${formatCurrency(totalBalance)}`,
          targetAddress: `/dashboard/loan-write-offs`, sentAt: new Date(), isRead: false, status: "SENT",
        },
      });
    }

    return NextResponse.json({ success: true, message: "Write-off request created successfully", data: writeOff });
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}
