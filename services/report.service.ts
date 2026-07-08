import { db } from "@/prisma/db";
import { getInstitutionStatementSummaries } from "@/lib/services/statements";

type StatementAccessUser = {
  id: string;
  role: string;
  branchId?: string | null;
};

function buildStatementAccessWhere(user: StatementAccessUser) {
  if (["ADMIN", "ACCOUNTANT"].includes(user.role)) {
    return {};
  }

  if (user.role === "MEMBER") {
    return {
      member: {
        userId: user.id,
      },
    };
  }

  if (!user.branchId) {
    return {
      id: "__no_branch_access__",
    };
  }

  return {
    member: {
      OR: [
        { branchId: user.branchId },
        { user: { branchId: user.branchId } },
      ],
    },
  };
}

export class ReportService {
  /**
   * Get Member Statement Data
   */
  static async getMemberStatement(memberId: string, from?: Date, to?: Date) {
    try {
      // 1. Fetch member details
      const member = await db.member.findUnique({
        where: { id: memberId },
        include: { user: { select: { name: true, phone: true } } },
      });

      if (!member) return { ok: false, error: "Member not found" };

      // 2. Fetch member accounts
      const accounts = await db.account.findMany({
        where: { memberId },
        include: { accountType: true },
      });

      const accountIds = accounts.map((a) => a.id);

      // 3. Fetch opening balance (sum of all transactions before the 'from' date)
      let openingBalance = 0;
      if (from) {
        const previousTransactions = await db.transaction.findMany({
          where: {
            accountId: { in: accountIds },
            transactionDate: { lt: from },
            status: "COMPLETED",
          },
          select: { amount: true, type: true },
        });

        openingBalance = previousTransactions.reduce((acc, t) => {
          const type = t.type as string;
          // Money coming IN to the account increases balance
          return (type === "DEPOSIT" || type === "TRANSFER_IN" || type === "LOAN_REPAYMENT") 
            ? acc + t.amount 
            : acc - t.amount;
        }, 0);
      }

      // 4. Fetch transactions for the period
      const transactions = await db.transaction.findMany({
        where: {
          accountId: { in: accountIds },
          status: "COMPLETED",
          transactionDate: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        },
        include: {
          deposit: true,
          withdrawal: true,
        },
        orderBy: { transactionDate: "asc" },
      });

      // 5. Calculate running balance
      const statementEntries: any[] = [];
      transactions.reduce((acc, t) => {
          const type = t.type as string;
          // Money coming IN increases balance
          const newBalance = (type === "DEPOSIT" || type === "TRANSFER_IN" || type === "LOAN_REPAYMENT")
            ? acc + t.amount
            : acc - t.amount;
          
          statementEntries.push({
            id: t.id,
            date: t.transactionDate.toISOString(),
            description: t.description || (type === "DEPOSIT" ? "Deposit" : "Transaction"),
            reference: t.transactionRef,
            debit: (type === "WITHDRAWAL" || type === "TRANSFER_OUT") ? t.amount : 0,
            credit: (type === "DEPOSIT" || type === "TRANSFER_IN" || type === "LOAN_REPAYMENT") ? t.amount : 0,
            balance: newBalance,
          });
          
          return newBalance;
        }, openingBalance);

      return {
        ok: true,
        data: {
          member: {
            name: member.user.name,
            memberNumber: member.memberNumber,
            phone: member.user.phone,
          },
          accounts: accounts.map(a => ({
            id: a.id,
            accountNumber: a.accountNumber,
            type: a.accountType.name,
            balance: a.balance,
          })),
          openingBalance,
          transactions: statementEntries,
        }
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get all generated statements
   */
  static async getAllStatements(user: StatementAccessUser) {
    try {
      const statements = await db.statement.findMany({
        where: buildStatementAccessWhere(user),
        include: {
          member: { include: { user: true, accounts: { include: { accountType: true, branch: true } } } },
          user: { select: { id: true, name: true, role: true } }
        },
        orderBy: { generatedAt: "desc" },
      });

      const memberStatements = statements.map((s) => ({
        ...s,
        subjectType: "MEMBER" as const,
        accountScope: "ALL_ACCOUNTS" as const,
        statementDate: s.generatedAt,
        periodStart: s.startDate,
        periodEnd: s.endDate || new Date(),
        fileUrl: s.pdfPath,
        generatedByUserId: s.userId,
        generatedByUser: s.user ? { id: s.user.id, name: s.user.name, role: s.user.role } : null
      }));

      const institutionStatements = await getInstitutionStatementSummaries(user);
      const data = [...memberStatements, ...institutionStatements].sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
      );

      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Statement Statistics
   */
  static async getStatementStatistics(user: StatementAccessUser) {
    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const accessWhere = buildStatementAccessWhere(user);

      const [today, thisMonth, total] = await Promise.all([
        db.statement.count({ where: { ...accessWhere, generatedAt: { gte: startOfDay } } }),
        db.statement.count({ where: { ...accessWhere, generatedAt: { gte: startOfMonth } } }),
        db.statement.count({ where: accessWhere }),
      ]);

      const institutionStatements = await getInstitutionStatementSummaries(user);
      const institutionToday = institutionStatements.filter(
        (statement) => statement && new Date(statement.generatedAt) >= startOfDay,
      ).length;
      const institutionThisMonth = institutionStatements.filter(
        (statement) => statement && new Date(statement.generatedAt) >= startOfMonth,
      ).length;

      return {
        ok: true,
        data: {
          today: today + institutionToday,
          thisMonth: thisMonth + institutionThisMonth,
          total: total + institutionStatements.length,
        }
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}

export async function getAccessibleStatementById(
  user: StatementAccessUser,
  statementId: string,
) {
  return db.statement.findFirst({
    where: {
      id: statementId,
      ...buildStatementAccessWhere(user),
    },
    include: {
      member: {
        include: {
          user: true,
          accounts: {
            include: {
              accountType: true,
              branch: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}

export { buildStatementAccessWhere };
