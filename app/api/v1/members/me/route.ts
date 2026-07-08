// app/api/v1/members/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/v1/members/me
 * Get current logged-in member's profile and summary
 * Auth: Required (MEMBER role)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is a member
    if (user.role !== "MEMBER") {
      return NextResponse.json(
        { success: false, error: "Access denied - Member role required" },
        { status: 403 }
      );
    }

    // Get member data
    const member = await db.member.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            image: true,
            address: true,
            dateOfBirth: true,
            nationalId: true,
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
        accounts: {
          where: {
            status: "ACTIVE",
          },
          include: {
            accountType: {
              select: {
                id: true,
                name: true,
                interestRate: true,
              },
            },
          },
        },
        loans: {
          where: {
            status: {
              in: ["DISBURSED", "OVERDUE"],
            },
          },
          select: {
            id: true,
            outstandingBalance: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 }
      );
    }

    // Calculate total balance across all accounts
    const totalBalance = member.accounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    // Calculate total outstanding loans
    const totalLoanOutstanding = member.loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    );

    // Get savings goal if exists (you can customize this logic)
    const savingsAccount = member.accounts.find(
      (acc) => acc.accountType.name === "Savings"
    );

    const savingsGoal = savingsAccount
      ? {
          target: 30000000, // Default target, can be customized per member
          current: savingsAccount.balance,
          percentage:
            Math.round((savingsAccount.balance / 30000000) * 100 * 10) / 10,
        }
      : null;

    // Build response
    const response = {
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.user.name,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
        phone: member.user.phone,
        image: member.user.image,
        address: member.user.address,
        dateOfBirth: member.user.dateOfBirth,
        nationalId: member.user.nationalId,
        joinDate: member.registrationDate,
        membershipStatus: member.isApproved ? "ACTIVE" : "PENDING",
        branch: member.user.branch
          ? {
              id: member.user.branch.id,
              name: member.user.branch.name,
              location: member.user.branch.location,
            }
          : null,
      },
      totalBalance,
      accountCount: member.accounts.length,
      activeLoansCount: member.loans.length,
      totalLoanOutstanding,
      savingsGoal,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching member profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch member profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
