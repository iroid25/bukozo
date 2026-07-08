// @ts-nocheck
// app/api/v1/branch-manager/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchManagerContext } from "@/lib/branch-manager-context";
import { TransactionType, TransactionStatus, UserRole } from "@prisma/client";

const transactionInclude = {
  member: {
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
        },
      },
    },
  },
  institution: {
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      institutionEmail: true,
      institutionPhone: true,
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  },
  account: {
    include: {
      accountType: {
        select: {
          id: true,
          name: true,
          interestRate: true,
          minBalance: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
    },
  },
  processedByUser: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      email: true,
    },
  },
  deposit: {
    include: {
      handler: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  },
  withdrawal: {
    include: {
      handler: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user, branchId } = await resolveBranchManagerContext(
      {
        id: session.user.id,
        email: session.user.email,
        branchId: (session.user as { branchId?: string | null }).branchId ?? null,
      },
      true
    );

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "User not assigned to a branch" },
        { status: 400 }
      );
    }

    // Verify user has Branch Manager permissions
    if (user?.role !== UserRole.BRANCHMANAGER && user?.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const type = searchParams.get("type") as TransactionType | null;
    const status = searchParams.get("status") as TransactionStatus | null;
    const memberId = searchParams.get("memberId");
    const institutionId = searchParams.get("institutionId");
    const accountId = searchParams.get("accountId");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search"); // Search by ref/description

    // Build where clause - ALWAYS filter by branch
    const where: any = {
      account: {
        branchId, // CRITICAL: Only show branch transactions
      },
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (memberId) {
      where.memberId = memberId;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (userId) {
      where.processedByUserId = userId;
    }

    // Search functionality
    if (search) {
      where.OR = [
        { transactionRef: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { externalReference: { contains: search, mode: "insensitive" } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.transactionDate.lte = end;
      }
    }

    // Fetch transactions with pagination
    const [transactions, totalCount, summary] = await Promise.all([
      db.transaction.findMany({
        where,
        include: transactionInclude,
        orderBy: { transactionDate: "desc" },
        take: limit,
        skip: offset,
      }),
      db.transaction.count({ where }),
      // Summary statistics
      db.transaction.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Calculate summary by type
    const deposits = transactions.filter(
      (t) => t.type === TransactionType.DEPOSIT
    );
    const withdrawals = transactions.filter(
      (t) => t.type === TransactionType.WITHDRAWAL
    );

    const depositSum = deposits.reduce((sum, t) => sum + Number(t.amount), 0);
    const withdrawalSum = withdrawals.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalAmount: Number(summary._sum.amount || 0),
        totalTransactions: summary._count.id,
        deposits: {
          count: deposits.length,
          amount: depositSum,
        },
        withdrawals: {
          count: withdrawals.length,
          amount: withdrawalSum,
        },
        netCashFlow: depositSum - withdrawalSum,
      },
    });
  } catch (error) {
    console.error("Error fetching branch transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
