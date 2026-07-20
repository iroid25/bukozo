import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// GET /api/v1/reports/financial/trends?months=12 - Monthly trends
// GET /api/v1/reports/financial/trends?months=12 - Monthly trends
export async function GET(request: NextRequest) {
  return generateTrends(request, 'GET');
}

// POST /api/v1/reports/financial/trends
export async function POST(request: NextRequest) {
  return generateTrends(request, 'POST');
}

async function generateTrends(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;

    let months = 12;
    let body: any = {};

    if (method === 'GET') {
      const { searchParams } = new URL(request.url);
      months = parseInt(searchParams.get("months") || "12");
    } else {
      body = await request.json();
      months = parseInt(body.months || "12");
    }

    const requestedBranchId = method === 'GET'
      ? new URL(request.url).searchParams.get("branchId")
      : body.branchId;
    const branchId = resolveBranchScope(user, requestedBranchId);

    if (!branchId && user.role !== "ADMIN") {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get journal entries for the past N months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const journalEntries = await db.journalEntry.findMany({
      where: {
        entryDate: {
          gte: startDate,
        },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        account: {
          select: {
            ledgerType: true,
            accountName: true,
          },
        },
      },
      orderBy: {
        entryDate: "asc",
      },
    });

    // Group by month
    const monthlyData: Record<string, { income: number; expenses: number; netProfit: number }> = {};

    journalEntries.forEach((entry) => {
      const monthKey = entry.entryDate.toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0, netProfit: 0 };
      }

      // Credit amount on income account = income
      if (entry.account?.ledgerType === "INCOME" && entry.creditAmount > 0) {
        monthlyData[monthKey].income += entry.creditAmount;
      }
      // Debit amount on expense account = expense
      if (entry.account?.ledgerType === "EXPENDITURES" && entry.debitAmount > 0) {
        monthlyData[monthKey].expenses += entry.debitAmount;
      }
    });

    // Calculate net profit for each month
    Object.keys(monthlyData).forEach((month) => {
      monthlyData[month].netProfit = monthlyData[month].income - monthlyData[month].expenses;
    });

    // Convert to array format
    const trends = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error("Error generating monthly trends:", error);
    return NextResponse.json(
      { error: "Failed to generate monthly trends" },
      { status: 500 }
    );
  }
}
