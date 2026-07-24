import { db } from "@/prisma/db";

export async function fetchExpenditureSummary(branchId?: string) {
  const expenditureCategories = await db.budgetCategory.findMany({
    where: {
      kind: "EXPENSE",
      isActive: true,
    },
    include: {
      parent: true,
      children: true,
      _count: {
        select: {
          expenditureRecords: true,
          incomeRecords: true,
          children: true,
        },
      },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });

  const expenditureRecordsWhere = branchId
    ? { branchId }
    : {};

  const expenditureAgg = await db.expenditureRecord.aggregate({
    where: expenditureRecordsWhere,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const totalExpenditure = Number(expenditureAgg._sum.amount || 0);
  const recordCount = Number(expenditureAgg._count._all || 0);

  return {
    categories: expenditureCategories,
    totalExpenditure,
    recordCount,
    debits: totalExpenditure,
    credits: 0,
  };
}
