import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import {
  calculateLoanSchedule,
  type ScheduleFrequency,
} from "@/lib/loan-calculations";

/**
 * GET /api/v1/loans/[id]/schedule
 * Get the repayment schedule for a loan
 * Auth: Required (LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN, MEMBER)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const allowedRoles = [
      "LOANOFFICER",
      "TELLER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
      "AUDITOR",
      "MEMBER",
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { id } = await props.params;

    let loan = await db.loan.findUnique({
      where: { id },
      include: {
        loanApplication: {
          select: {
            repaymentPeriodMonths: true,
            repaymentStartDate: true,
            modeOfRepayment: true,
            loanProduct: { select: { name: true, repaymentPeriodDays: true } },
          },
        },
        member: { select: { userId: true } },
        repayments: {
          select: {
            amount: true,
            repaymentDate: true,
            principalPaid: true,
            interestPaid: true,
            penaltyPaid: true,
          },
          orderBy: { repaymentDate: "asc" },
        },
      },
    });

    if (loan) {
      // Member access control
      if (user.role === "MEMBER" && loan.member.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }

      // Branch access control
      if (
        user.role === "BRANCHMANAGER" &&
        user.branchId &&
        loan.branchId !== user.branchId
      ) {
        return NextResponse.json(
          { success: false, error: "Forbidden - Different Branch" },
          { status: 403 },
        );
      }

      // Determine parameters
      const principal = loan.amountGranted;
      let rate = loan.interestRate;
      const gracePeriod = loan.gracePeriod || 0;
      const interestType = (loan.interestType || "FLAT_RATE") as
        | "FLAT_RATE"
        | "REDUCING_BALANCE";
      let interestPeriod = loan.interestPeriod;

      // Determine period
      let periodMonths = loan.loanApplication.repaymentPeriodMonths;
      if (!periodMonths) {
        periodMonths = Math.ceil(
          (loan.loanApplication.loanProduct.repaymentPeriodDays || 30) / 30,
        );
      }

      // Determine Start Date for schedule
      const startDate =
        loan.loanApplication.repaymentStartDate ||
        loan.disbursementDate ||
        new Date();
      const scheduleFrequency =
        (loan.loanApplication.modeOfRepayment as ScheduleFrequency) ||
        "MONTHLY";

      // Calculate schedule fresh using stored interest configuration
      // This ensures consistency - no product name overrides
      const scheduleResult = calculateLoanSchedule({
        amountGranted: principal,
        interestRate: rate,
        repaymentPeriodMonths: periodMonths,
        interestType,
        gracePeriod: 0,
        disbursementDate: new Date(startDate),
        interestPeriod: interestPeriod as "MONTHLY" | "ANNUAL",
        scheduleFrequency,
        payments: loan.repayments.map((r: any) => ({
          amount: r.amount,
          paymentDate: r.repaymentDate,
          principalPaid: r.principalPaid,
          interestPaid: r.interestPaid,
          penaltyPaid: r.penaltyPaid,
        })),
      });

      return NextResponse.json({
        success: true,
        data: {
          loanId: loan.id,
          principal,
          rate,
          periodMonths,
          gracePeriod,
          interestType,
          interestPeriod, // Add interest period to response
          ...scheduleResult,
        },
      });
    }

    // Try Institution Loan
    const instLoan = await db.institutionLoan.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            repaymentPeriodMonths: true,
            loanProduct: { select: { name: true } },
          },
        },
        institution: { select: { userId: true } },
      },
    });

    if (!instLoan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    // Fetch schedules separately to bypass stale client include error
    const instSchedules = await (
      db as any
    ).institutionLoanRepaymentSchedule.findMany({
      where: { loanId: id },
      orderBy: { period: "asc" },
    });

    // Access control for institution member user
    if (user.role === "MEMBER" && instLoan.institution.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        loanId: instLoan.id,
        principal: instLoan.amountGranted,
        rate: instLoan.interestRate,
        periodMonths: instLoan.application.repaymentPeriodMonths,
        schedule: instSchedules.map((s: any) => ({
          period: s.period,
          dueDate: s.dueDate,
          principalPayment: s.principalPayment,
          interestPayment: s.interestPayment,
          totalPayment: s.totalPayment,
          remainingBalance: s.remainingBalance,
          paidAmount: s.paidAmount,
          status: s.status,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching loan schedule:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
