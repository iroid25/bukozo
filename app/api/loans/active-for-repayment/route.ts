// app/api/loans/active-for-repayment/route.ts
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { LoanService } from "@/services/loan.service";

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    const {
      loanId,
      memberId,
      amount,
      handlerUserId,
      paymentMethod,
      transactionReference,
    } = body;

    // Validation
    if (!loanId || !memberId || !amount || !handlerUserId || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Check if user has permission
    if (user.role === "MEMBER") {
      const memberRecord = await db.member.findUnique({
        where: { userId: user.id },
      });

      if (!memberRecord || memberRecord.id !== memberId) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only make payments for your own loans",
          },
          { status: 403 }
        );
      }
    } else if (
      ![
        "ADMIN",
        "BRANCHMANAGER",
        "TELLER",
        "LOANOFFICER",
        "ACCOUNTANT",
      ].includes(user.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to record payments",
        },
        { status: 403 }
      );
    }

    // Delegate to LoanService.repay() for full accounting (ledger, income, journal entries)
    const result = await LoanService.repay({
      loanId,
      amount: Number(amount),
      handlerId: handlerUserId,
      channel: paymentMethod,
      reference: transactionReference,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: (result as any).error || "Repayment failed" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Payment recorded successfully",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("API: Error recording repayment:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to record payment",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {

    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please log in.",
          loans: [],
          count: 0,
        },
        { status: 401 }
      );
    }


    // Build where clause based on user role
    const whereClause: any = {
      status: {
        in: ["DISBURSED", "OVERDUE"],
      },
      outstandingBalance: {
        gt: 0,
      },
    };

    // If user is a MEMBER, only show their loans
    if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });

      if (!member) {
        return NextResponse.json(
          {
            success: false,
            error: "Member record not found",
            loans: [],
            count: 0,
          },
          { status: 404 }
        );
      }

      whereClause.memberId = member.id;
    } else if (
      [
        "ADMIN",
        "BRANCHMANAGER",
        "TELLER",
        "LOANOFFICER",
        "ACCOUNTANT",
      ].includes(user.role)
    ) {
      // Staff can see all active loans
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to view loans",
          loans: [],
          count: 0,
        },
        { status: 403 }
      );
    }

    // Fetch active loans with outstanding balance
    const loans = await db.loan.findMany({
      where: whereClause,
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
              },
            },
          },
        },
        loanApplication: {
          include: {
            loanProduct: {
              select: {
                name: true,
                interestRate: true,
              },
            },
          },
        },
        repayments: {
          select: {
            id: true,
            amount: true,
            repaymentDate: true,
          },
          orderBy: {
            repaymentDate: "desc",
          },
          take: 1, // Only get the last repayment
        },
      },
      orderBy: [
        { status: "asc" }, // DISBURSED before OVERDUE
        { dueDate: "asc" }, // Earlier due dates first
      ],
      take: 100, // Limit to prevent huge responses
    });


    return NextResponse.json(
      {
        success: true,
        loans,
        count: loans.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("ðŸ’¥ API: Error fetching active loans:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch active loans",
        loans: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
