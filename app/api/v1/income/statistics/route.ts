import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { IncomeService } from "@/services/income.service";

// GET /api/v1/income/statistics - Get income statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;

    const requestedBranchId = searchParams.get("branchId");
    const branchId = resolveBranchScope(user, requestedBranchId);
    const incomeRecords = await IncomeService.getUnifiedIncomeRecords({
      user,
      branchId,
      startDate,
      endDate,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; parentName?: string; count: number; amount: number }
    >();
    const branchMap = new Map<
      string | null,
      { branchId: string | null; branchName: string; count: number; amount: number }
    >();
    const paymentMap = new Map<
      string,
      { method: any; count: number; amount: number }
    >();

    let totalIncome = 0;
    let todayIncome = 0;
    let thisMonthIncome = 0;

    for (const record of incomeRecords) {
      const amount = Number(record.amount || 0);
      const recordDate = new Date(record.recordDate);
      totalIncome += amount;
      if (recordDate.getTime() === today.getTime()) {
        todayIncome += amount;
      }
      if (recordDate >= monthStart) {
        thisMonthIncome += amount;
      }

      const categoryId = record.budgetCategory?.id || record.budgetCategoryId || "";
      const categoryName = record.budgetCategory?.name || "Unknown";
      const parentName = record.budgetCategory?.parent?.name;
      const branchIdValue = record.branchId || null;
      const branchName = record.branch?.name || "No Branch";
      const method = String(record.paymentMethod || "UNKNOWN");

      const currentCategory = categoryMap.get(categoryId) || {
        categoryId,
        categoryName,
        parentName,
        count: 0,
        amount: 0,
      };
      currentCategory.count += 1;
      currentCategory.amount += amount;
      categoryMap.set(categoryId, currentCategory);

      const currentBranch = branchMap.get(branchIdValue) || {
        branchId: branchIdValue,
        branchName,
        count: 0,
        amount: 0,
      };
      currentBranch.count += 1;
      currentBranch.amount += amount;
      branchMap.set(branchIdValue, currentBranch);

      const currentMethod = paymentMap.get(method) || {
        method: record.paymentMethod,
        count: 0,
        amount: 0,
      };
      currentMethod.count += 1;
      currentMethod.amount += amount;
      paymentMap.set(method, currentMethod);
    }

    const statistics = {
      totalIncome,
      totalRecords: incomeRecords.length,
      todayIncome,
      todayRecords: incomeRecords.filter((record) => {
        const recordDate = new Date(record.recordDate);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === today.getTime();
      }).length,
      thisMonthIncome,
      averageIncome:
        incomeRecords.length > 0 ? totalIncome / incomeRecords.length : 0,
      categoryBreakdown: Array.from(categoryMap.values()).sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName),
      ),
      branchBreakdown: Array.from(branchMap.values()).sort((a, b) =>
        a.branchName.localeCompare(b.branchName),
      ),
      paymentMethodBreakdown: Array.from(paymentMap.values()).sort((a, b) =>
        String(a.method).localeCompare(String(b.method)),
      ),
    };

    return NextResponse.json({ data: statistics });
  } catch (error) {
    console.error("Error fetching income statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
