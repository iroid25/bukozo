// app/api/v1/transactions/withdrawals/my-withdrawals/route.ts
import { NextResponse } from "next/server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function GET(request: Request) {
  try {
    // Check authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Member must have MEMBER role
    if (user.role !== "MEMBER") {
      return NextResponse.json(
        { success: false, error: "Access denied. Member role required." },
        { status: 403 }
      );
    }

    // Find member
    const member = await db.member.findUnique({
      where: { userId: user.id },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member profile not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const accountId = searchParams.get("accountId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // Get all member's accounts
    const accounts = await db.account.findMany({
      where: { memberId: member.id },
      select: { id: true },
    });

    const accountIds = accounts.map((acc) => acc.id);

    if (accountIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          withdrawals: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
          summary: {
            totalWithdrawals: 0,
            withdrawalCount: 0,
            averageWithdrawal: 0,
          },
        },
      });
    }

    // Build where clause for filtering
    const whereClause: any = {
      accountId: accountId ? accountId : { in: accountIds },
      type: "WITHDRAWAL",
    };

    // Add date filters if provided
    if (startDate || endDate) {
      whereClause.transactionDate = {};
      if (startDate) {
        whereClause.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.transactionDate.lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const totalCount = await db.transaction.count({
      where: whereClause,
    });

    // Fetch withdrawal transactions
    const withdrawals = await db.transaction.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: {
        transactionDate: "desc",
      },
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
          },
        },
        withdrawal: {
          select: {
            channel: true,
            mobileMoneyRef: true,
          },
        },
      },
    });

    // Calculate summary statistics
    const allWithdrawals = await db.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        type: "WITHDRAWAL",
      },
      select: {
        amount: true,
      },
    });

    const totalWithdrawals = allWithdrawals.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );
    const withdrawalCount = allWithdrawals.length;
    const averageWithdrawal =
      withdrawalCount > 0 ? totalWithdrawals / withdrawalCount : 0;

    // Map transactions to response format
    const mappedWithdrawals = withdrawals.map((txn) => ({
      id: txn.id,
      transactionRef: txn.transactionRef,
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      transactionDate: txn.transactionDate.toISOString(),
      account: {
        accountNumber: txn.account.accountNumber,
        accountType: {
          name: txn.account.accountType.name,
        },
      },
      status: txn.status,
      channel: txn.withdrawal?.channel || txn.channel,
      mobileMoneyRef: txn.withdrawal?.mobileMoneyRef || null,
      processedBy: txn.processedByUser?.name || null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        withdrawals: mappedWithdrawals,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
        summary: {
          totalWithdrawals,
          withdrawalCount,
          averageWithdrawal,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching member withdrawals:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
