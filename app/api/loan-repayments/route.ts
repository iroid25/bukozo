// app/api/loan-repayments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanService } from "@/services/loan.service";

// GET - Fetch all loan repayments with role-based filtering
export async function GET(request: NextRequest) {
  try {

    // Get session using NextAuth
    const session = await getServerSession(authOptions);

    // Check authentication
    if (!session?.user) {
      console.error("âŒ No session found");
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    console.log(
      `✅ User ${session.user.email} (${session.user.role}) fetching repayments`,
    );

    // âœ… Define roles that can see repayments
    const allowedRoles = [
      "ADMIN",
      "BRANCHMANAGER",
      "TELLER", // âœ… ADDED TELLER
      "LOANOFFICER",
      "ACCOUNTANT",
      "AUDITOR",
      "AGENT",
    ];

    // Check if user has permission
    if (
      !allowedRoles.includes(session.user.role) &&
      session.user.role !== "MEMBER"
    ) {
      console.error(`âŒ User role ${session.user.role} not authorized`);
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to view loan repayments",
        },
        { status: 403 }
      );
    }

    // Build where condition based on role
    let whereCondition: any = {};

    // âœ… AGENT role: Only see repayments they processed
    if (session.user.role === "AGENT") {
      whereCondition.handlerUserId = session.user.id;
    }
    // âœ… BRANCHMANAGER or TELLER: Filter by branch
    else if (
      ["BRANCHMANAGER", "TELLER"].includes(session.user.role) &&
      session.user.branchId
    ) {
        whereCondition.loan = {
          branchId: session.user.branchId,
        };
        console.log(
          `🔍 ${session.user.role} - Filtering by branchId: ${session.user.branchId}`,
        );
    }
    // âœ… MEMBER role: Only see their own repayments
    else if (session.user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: session.user.id },
      });

      if (!member) {
        return NextResponse.json(
          { success: false, error: "Member record not found" },
          { status: 404 }
        );
      }

      whereCondition.memberId = member.id;
    }
    // âœ… ADMIN, ACCOUNTANT, AUDITOR, LOANOFFICER: See all repayments
    else if (allowedRoles.includes(session.user.role)) {
    }

    // Fetch loan repayments with all necessary relations
    const repayments = await db.loanRepayment.findMany({
      where: whereCondition,
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    image: true,
                  },
                },
              },
            },
            loanApplication: {
              include: {
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                    interestRate: true,
                  },
                },
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        repaymentDate: "desc",
      },
      take: 500, // Limit for performance
    });


    // Log some details for debugging
    if (repayments.length > 0) {
      console.log(
        `📊 Sample repayment: ${repayments[0].loan.member.user.name} - ${repayments[0].amount}`,
      );
    }

    return NextResponse.json({
      success: true,
      repayments: repayments,
      count: repayments.length,
      userRole: session.user.role,
    });
  } catch (error) {
    console.error("âŒ Error fetching loan repayments:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch loan repayments",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

// POST - Create a new loan repayment
export async function POST(request: NextRequest) {
  try {

    // Get session using NextAuth
    const session = await getServerSession(authOptions);

    // Check authentication
    if (!session?.user) {
      console.error("âŒ No session found");
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }


    // Check if user has permission to create repayments
    const allowedRoles = [
      "ADMIN",
      "BRANCHMANAGER",
      "TELLER",
      "AGENT",
    ];

    if (!allowedRoles.includes(session.user.role)) {
      console.error(`âŒ User role ${session.user.role} not authorized`);
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to process loan repayments",
        },
        { status: 403 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("âŒ Failed to parse JSON:", error);
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const {
      loanId,
      memberId,
      amount,
      handlerUserId,
      paymentMethod,
      transactionReference,
      accountId, // âœ… New field for Account Transfer
    } = body;

    // Validate required fields
    if (!loanId || !memberId || !amount || !handlerUserId || !paymentMethod) {
      console.error("âŒ Missing required fields");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Validate Account Transfer requirements
    if (paymentMethod === "Account Transfer" && !accountId) {
      return NextResponse.json(
        { success: false, error: "Account ID is required for Account Transfer" },
        { status: 400 }
      );
    }


    // Fetch loan with all required relations
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          include: {
            user: true,
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
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 }
      );
    }

    if (loan.outstandingBalance <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "This loan has no outstanding balance",
        },
        { status: 400 }
      );
    }

    if (parsedAmount > loan.outstandingBalance) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment amount exceeds outstanding balance",
          details: {
            paymentAmount: parsedAmount,
            outstandingBalance: loan.outstandingBalance,
          },
        },
        { status: 400 }
      );
    }

    // Create repayment using centralized LoanService
    const result = await LoanService.repay({
      loanId,
      amount: parsedAmount,
      handlerId: handlerUserId,
      handlerRole: session.user.role,
      channel: paymentMethod,
      sourceAccountId: accountId,
      reference: transactionReference,
      notes: body.notes,
      interestAmount: body.interestAmount ? parseFloat(body.interestAmount) : undefined,
      penaltyAmount: body.penaltyAmount ? parseFloat(body.penaltyAmount) : undefined,
      principalAmount: body.principalAmount ? parseFloat(body.principalAmount) : undefined,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }


    return NextResponse.json(
      {
        success: true,
        message: "Payment recorded successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ðŸ’¥ Unexpected error in POST /api/loan-repayments:", error);
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
