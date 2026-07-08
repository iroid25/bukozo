import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors, getPaginationParams, createPaginationMeta } from "@/lib/api-utils";

// GET /api/v1/accounts/{accountId}/transactions - Get account transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const { accountId } = await params;
    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(searchParams);
    
    const type = searchParams.get("type") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { accountId };

    if (type) {
      where.type = type;
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

    // Fetch transactions with pagination
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          transactionRef: true,
          type: true,
          amount: true,
          status: true,
          description: true,
          transactionDate: true,
          channel: true,
        },
        orderBy: {
          transactionDate: "desc",
        },
      }),
      db.transaction.count({ where }),
    ]);

    return successResponse({
      data: transactions,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error: any) {
    console.error("Error fetching account transactions:", error);
    return ApiErrors.internalError(error.message);
  }
}
