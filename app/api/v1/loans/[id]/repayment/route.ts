// app/api/v1/loans/[id]/repayment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

/**
 * POST /api/v1/loans/[id]/repayment
 * Process a loan repayment
 * Auth: Required (LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN)
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Authorization
    const allowedRoles = ["LOANOFFICER", "TELLER", "BRANCHMANAGER", "ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    // Await params (Next.js 15)
    const params = await props.params;
    const { id: loanId } = params;
    const body = await request.json();

    // Validate request body
    const {
      amount,
      channel = "CASH",
      mobileMoneyRef,
      sourceAccountId,
      notes,
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid repayment amount is required" },
        { status: 400 }
      );
    }

    // Process repayment using LoanService
    const result = await LoanService.repay({
      loanId: loanId,
      amount: Number(amount),
      handlerId: user.id,
      handlerRole: user.role,
      channel: channel,
      sourceAccountId: sourceAccountId,
      reference: mobileMoneyRef,
      notes: notes,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Repayment successful",
      data: result.data,
    });
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process repayment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/loans/[id]/repayment
 * Get all repayments for a specific loan
 * Auth: Required (LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN, ACCOUNTANT, AUDITOR)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Authorization
    const allowedRoles = [
      "LOANOFFICER",
      "TELLER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
      "AUDITOR",
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    // Await params (Next.js 15)
    const params = await props.params;
    const { id: loanId } = params;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Check if individual loan exists
    let loan = await db.loan.findUnique({
      where: { id: loanId },
      select: { id: true, branchId: true },
    });

    let isInstitution = false;
    let branchId: string | null = null;

    if (loan) {
        branchId = loan.branchId;
    } else {
        // Check for institutional loan
        const instLoan = await db.institutionLoan.findUnique({
            where: { id: loanId },
            include: { institution: { include: { user: true } } }
        });
        if (!instLoan) {
            return NextResponse.json({ success: false, error: "Loan not found" }, { status: 404 });
        }
        isInstitution = true;
        branchId = instLoan.institution.user?.branchId || null;
    }

    // Branch-level access control
    if (user.role === "BRANCHMANAGER" && user.branchId && branchId !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied - Different branch" },
        { status: 403 }
      );
    }

    let repayments: any[] = [];
    let totalCount = 0;

    if (!isInstitution) {
        // Fetch Individual Repayments
        [repayments, totalCount] = await Promise.all([
          db.loanRepayment.findMany({
            where: { loanId },
            include: {
              handler: { select: { id: true, name: true, email: true, role: true } },
              member: { include: { user: { select: { name: true, email: true, phone: true } } } },
            },
            orderBy: { repaymentDate: "desc" },
            take: limit,
            skip: offset,
          }),
          db.loanRepayment.count({ where: { loanId } }),
        ]);
    } else {
        // Fetch Institutional Repayments using fallback for stale client
        [repayments, totalCount] = await Promise.all([
          (db as any).institutionLoanRepayment.findMany({
            where: { loanId },
            orderBy: { repaymentDate: "desc" },
            take: limit,
            skip: offset,
          }),
          (db as any).institutionLoanRepayment.count({ where: { loanId } }),
        ]);
        // Map institutional repayments to match individual structure
        repayments = repayments.map(r => ({
            ...r,
            handler: { name: "System" }
        }));
    }

    // Calculate stats
    const totalRepaid = repayments.reduce((sum, r) => sum + r.amount, 0);
    const channelBreakdown = repayments.reduce(
      (acc, r) => {
        acc[r.channel] = (acc[r.channel] || 0) + r.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        repayments,
        stats: {
          totalRepayments: totalCount,
          totalRepaid,
          channelBreakdown,
        },
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + repayments.length < totalCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching loan repayments:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Failed to fetch repayments",
      },
      { status: 500 }
    );
  }
}