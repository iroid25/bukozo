import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

// GET /api/v1/accounts/assets/loans-items?branchId=
//
// Drill-down for the Assets dashboard's "Loans" (LOAN_ASSET_BUCKET, backed by
// Loan.outstandingBalance) and "Cash at Hand" (modeled from
// LoanRepayment.principalPaid) nodes. Both buckets are underpinned by the
// same LoanRepayment ledger, so the page reuses this one endpoint for both
// drill-downs rather than standing up a second, identical query.
//
// Relocated out of the shared chart-of-accounts/[id]/items route's
// isLoanAssetAccount / isCashAtHandAccount branches (left in place there,
// untouched, since the admin COA browser may still expand those same
// account ids generically).
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const requestedBranchId = request.nextUrl.searchParams.get("branchId");
    const branchId = resolveBranchScope(
      session.user as { role: string; branchId?: string | null },
      requestedBranchId,
    );

    const repayments = await db.loanRepayment.findMany({
      where: branchId
        ? {
            loan: {
              branchId,
            },
          }
        : undefined,
      include: {
        member: {
          select: {
            memberNumber: true,
            surname: true,
            otherNames: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        loan: {
          select: {
            id: true,
            loanApplication: {
              select: {
                loanProduct: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        handler: {
          select: {
            name: true,
          },
        },
      },
      take: 200,
      orderBy: {
        repaymentDate: "desc",
      },
    });

    const items = repayments.map((repayment) => {
      const memberName =
        repayment.member?.user?.name?.trim() ||
        [repayment.member?.surname, repayment.member?.otherNames]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        "Unknown Member";
      const loanProductName =
        repayment.loan?.loanApplication?.loanProduct?.name || "Loan Repayment";
      const principalAmount = Number(repayment.principalPaid || 0);
      const interestAmount = Number(repayment.interestPaid || 0);
      const penaltyAmount = Number(repayment.penaltyPaid || 0);

      return {
        id: repayment.id,
        name: memberName,
        code: repayment.transactionId || repayment.loanId.slice(0, 8),
        date: repayment.repaymentDate,
        amount: principalAmount,
        status: "COMPLETED",
        details: [
          `Loan: ${loanProductName}`,
          `Principal: ${principalAmount.toLocaleString("en-UG")}`,
          `Interest posted to income: ${interestAmount.toLocaleString("en-UG")}`,
          `Penalty posted to income: ${penaltyAmount.toLocaleString("en-UG")}`,
          `Channel: ${repayment.channel || "-"}`,
          `Collected by: ${repayment.handler?.name || "-"}`,
        ].join(" | "),
        principalAmount,
        interestAmount,
        penaltyAmount,
      };
    });

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error) {
    console.error("Error fetching loan asset items:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch loan asset items",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
