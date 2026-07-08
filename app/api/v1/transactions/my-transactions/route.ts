// app/api/v1/transactions/my-transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/**
 * GET /api/v1/transactions/my-transactions
 * Get member's transactions with pagination and filters
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

    // Get member
    const member = await db.member.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type"); // DEPOSIT, WITHDRAWAL, TRANSFER
    const accountId = searchParams.get("accountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {
      memberId: member.id,
    };

    if (type) {
      where.type = type;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    // Fetch transactions
    const [transactions, totalCount] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              accountNumber: true,
              accountType: {
                select: {
                  name: true,
                },
              },
            },
          },
          processedByUser: {
            select: {
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          transactionDate: "desc",
        },
        take: limit,
        skip: offset,
      }),
      db.transaction.count({ where }),
    ]);

    // Enrich transactions with calculated balance (approximate)
    const enrichedTransactions = transactions.map((txn) => ({
      id: txn.id,
      transactionRef: txn.transactionRef,
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      date: txn.transactionDate,
      accountNumber: txn.account.accountNumber,
      accountType: txn.account.accountType.name,
      status: txn.status,
      channel: txn.channel,
      processedBy: txn.processedByUser?.name,
      paymentMethod: txn.paymentMethod,
      paymentReference: txn.paymentReference,
      notes: txn.notes,
    }));

    return NextResponse.json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + transactions.length < totalCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
