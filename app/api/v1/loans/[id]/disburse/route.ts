
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanService } from "@/services/loan.service";
import { db } from "@/prisma/db";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Loans Officers, Admins, and Managers can disburse
    if (!["LOANOFFICER", "TELLER", "ADMIN", "Manager", "BRANCHMANAGER"].includes(session.user.role)) {
         return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const params = await props.params;
    const body = await request.json();
    const { accountId, processingFeePercentage, periodMonths, repaymentStartDate } = body;

    // 1. Try Individual Loan
    const loan = await db.loan.findUnique({
      where: { id: params.id },
      select: { id: true, loanApplicationId: true }
    });

    if (loan) {
      const result = await LoanService.disburse(
        loan.loanApplicationId,
        session.user.id,
        {
          memberAccountId: accountId,
          processingFeePercentage,
          periodMonths,
          repaymentStartDate,
        }
      );

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json(result.data);
    }

    // 2. Try Institution Loan
    const instLoan = await db.institutionLoan.findUnique({
      where: { id: params.id },
      select: { id: true, applicationId: true }
    });

    if (instLoan) {
      const result = await LoanService.disburseInstitution(
        instLoan.applicationId,
        session.user.id,
        { institutionAccountId: accountId, processingFeePercentage, periodMonths, repaymentStartDate }
      );

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json(result.data);
    }

    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  } catch (error) {
    console.error("Error processing disbursement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
