import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/v1/loans/my-loans
 * Get loans that belong to the logged-in MEMBER
 * Auth: Required (MEMBER only)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Login required" },
        { status: 401 }
      );
    }

    // Only Members can access this endpoint
    if (user.role !== "MEMBER") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden - Only members can view their loans",
        },
        { status: 403 }
      );
    }

    // Get the member record
    const member = await db.member.findUnique({
      where: { userId: user.id },
    });

    if (!member) {
      return NextResponse.json({
        success: true,
        data: {
          loans: [],
          stats: {
            totalLoans: 0,
            activeLoans: 0,
            overdueLoans: 0,
            repaidLoans: 0,
            totalDisbursed: 0,
            totalOutstanding: 0,
            totalRepaid: 0,
          },
          pagination: {
            total: 0,
            limit: 50,
            offset: 0,
            hasMore: false,
          },
        },
      });
    }

    // Pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Optional filters
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build where clause
    const whereClause: any = {
      memberId: member.id,
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        {
          loanApplication: {
            purpose: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    // Fetch loans + relations
    const [loans, total] = await Promise.all([
      db.loan.findMany({
        where: whereClause,
        include: {
          loanApplication: {
            include: {
              loanProduct: true,
              allocatedTeller: {
                select: { id: true, name: true },
              },
              loanOfficer: {
                select: { id: true, name: true },
              },
            },
          },
          branch: true,
          repayments: {
            orderBy: { repaymentDate: "desc" },
            take: 5,
            include: {
              handler: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: { repayments: true },
          },
        },
        orderBy: { disbursementDate: "desc" },
        skip: offset,
        take: limit,
      }),

      db.loan.count({
        where: whereClause,
      }),
    ]);

    // Auto-mark overdue (same logic as main loans endpoint)
    const now = new Date();
    const overdueLoans = loans.filter(
      (loan) =>
        now > loan.dueDate &&
        loan.outstandingBalance > 0 &&
        loan.status !== "OVERDUE" &&
        loan.status !== "REPAID"
    );

    if (overdueLoans.length > 0) {
      await db.loan.updateMany({
        where: { id: { in: overdueLoans.map((l) => l.id) } },
        data: { status: "OVERDUE" },
      });

      overdueLoans.forEach((loan) => {
        loan.status = "OVERDUE";
      });
    }

    // Stats for member dashboard
    const stats = {
      totalLoans: total,
      activeLoans: loans.filter((l) =>
        ["APPROVED", "DISBURSED"].includes(l.status)
      ).length,
      overdueLoans: loans.filter((l) => l.status === "OVERDUE").length,
      repaidLoans: loans.filter((l) => l.status === "REPAID").length,
      totalDisbursed: loans.reduce((sum, l) => sum + l.amountGranted, 0),
      totalOutstanding: loans.reduce((sum, l) => sum + l.outstandingBalance, 0),
      totalRepaid: loans.reduce((sum, l) => sum + l.amountPaid, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        loans,
        stats,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + loans.length < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching member loans:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Failed to fetch loans",
      },
      { status: 500 }
    );
  }
}
