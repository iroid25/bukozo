import { PrismaClient, TransactionStatus } from "@prisma/client";
import { db } from "@/prisma/db";

/**
 * Loan income codes that may exist only as JournalEntry rows (no matching
 * IncomeRecord).  Must stay in sync with services/income.service.ts
 * LOAN_RELATED_INCOME_CODES.
 *
 * Instead of querying COA for account IDs, we query BudgetCategory by code
 * and check for IncomeRecord coverage.  Any remaining gap is queried
 * directly from the source table (InsuranceContribution for insurance income).
 */
const LOAN_INCOME_CODES = ["401001", "401002", "401005", "401007", "401008", "401009"] as const;

/**
 * Shared retained-earnings computation — the single source of truth for the
 * net-surplus figure used by both the equity page and the income/expenditure
 * statistics pages.
 *
 * Accounting identity:  Retained Earnings = Σ Income − Σ Expenditure
 *
 * Income includes both direct IncomeRecord rows (COMPLETED / APPROVED) AND
 * source-table entries for loan income codes (401001 interest, 401002
 * processing fees, 401005 penalties) that lack a corresponding IncomeRecord.
 *
 * When a periodId is supplied, the computation is scoped to that
 * FinancialPeriod; otherwise it covers all time.
 */
export async function getRetainedEarnings(
  params: {
    periodId?: string | null;
    db?: PrismaClient;
    branchId?: string | null;
  } = {},
): Promise<{
  totalIncome: number;
  totalExpenditure: number;
  retainedEarnings: number;
}> {
  const client = params.db ?? db;

  // --- Expenditure: straightforward aggregate, status-filtered ---
  const expenditureWhere: any = {
    status: {
      in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED],
    },
  };
  if (params.periodId) {
    expenditureWhere.periodId = params.periodId;
  }
  if (params.branchId) {
    expenditureWhere.branchId = params.branchId;
  }

  const expenditureAgg = await client.expenditureRecord.aggregate({
    where: expenditureWhere,
    _sum: { amount: true },
  });

  const totalExpenditure = Number(expenditureAgg._sum.amount || 0);

  // --- Income: direct IncomeRecord + InsuranceContribution fallback ---
  const incomeWhere: any = {
    status: {
      in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED],
    },
  };
  if (params.periodId) {
    incomeWhere.periodId = params.periodId;
  }
  if (params.branchId) {
    incomeWhere.branchId = params.branchId;
  }

  const directRecords = await client.incomeRecord.findMany({
    where: incomeWhere,
    select: {
      amount: true,
      budgetCategoryId: true,
    },
  });

  // Resolve which budget category codes are already covered by direct records
  const directCodes = new Set<string>();
  for (const record of directRecords) {
    if (!record.budgetCategoryId) continue;
    const cat = await client.budgetCategory.findUnique({
      where: { id: record.budgetCategoryId },
      select: { code: true },
    });
    if (cat?.code) directCodes.add(cat.code);
  }

  const directIncome = directRecords.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  // For loan income codes not yet covered by direct IncomeRecords,
  // check InsuranceContribution for insurance income (401960)
  const missingLoanCodes = LOAN_INCOME_CODES.filter(
    (code) => !directCodes.has(code),
  );

  let sourceFallbackIncome = 0;
  if (missingLoanCodes.length > 0) {
    // Find BudgetCategories for the missing codes
    const missingCategories = await client.budgetCategory.findMany({
      where: { code: { in: missingLoanCodes }, isActive: true },
      select: { id: true, code: true },
    });

    for (const cat of missingCategories) {
      // Check if any IncomeRecord exists for this category
      const catIncome = await client.incomeRecord.aggregate({
        where: {
          budgetCategoryId: cat.id,
          status: { in: [TransactionStatus.COMPLETED, TransactionStatus.APPROVED] },
        },
        _sum: { amount: true },
      });
      const catAmount = Number(catIncome._sum.amount || 0);
      if (catAmount > 0) {
        directCodes.add(cat.code || "");
      }
    }
  }

  // Insurance contribution (401960) as fallback if not already covered
  if (!directCodes.has("401960")) {
    const insuranceAgg = await client.insuranceContribution.aggregate({
      where: {
        type: "CONTRIBUTION",
        ...(params.periodId ? {} : {}),
      },
      _sum: { amount: true },
    });
    sourceFallbackIncome += Number(insuranceAgg._sum.amount || 0);
  }

  const totalIncome = directIncome + sourceFallbackIncome;

  return {
    totalIncome,
    totalExpenditure,
    retainedEarnings: totalIncome - totalExpenditure,
  };
}
