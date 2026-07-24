import { db } from "@/prisma/db";

export async function fetchIncomeSummary(branchId?: string) {
  const incomeCategories = await db.budgetCategory.findMany({
    where: {
      kind: "INCOME",
      isActive: true,
    },
    include: {
      parent: true,
      children: true,
      _count: {
        select: {
          incomeRecords: true,
          expenditureRecords: true,
          children: true,
        },
      },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });

  const incomeRecordsWhere = branchId
    ? {
        branchId,
        budgetCategory: {
          kind: "INCOME" as const,
          name: {
            notIn: ["loan insurance fees", "loan share capital"],
            mode: "insensitive" as const,
          },
        },
      }
    : {
        budgetCategory: {
          kind: "INCOME" as const,
          name: {
            notIn: ["loan insurance fees", "loan share capital"],
            mode: "insensitive" as const,
          },
        },
      };

  const incomeAgg = await db.incomeRecord.aggregate({
    where: incomeRecordsWhere,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const recordCount = Number(incomeAgg._count._all || 0);

  return {
    categories: incomeCategories,
    totalIncome,
    recordCount,
    debits: 0,
    credits: totalIncome,
  };
}
