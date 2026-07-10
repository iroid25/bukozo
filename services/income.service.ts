import { db } from "@/prisma/db";
import { 
  Prisma, 
  UserRole, 
  PaymentMethod, 
  RecognitionBasis, 
  TransactionStatus, 
  TransactionType, 
  VaultTransactionType 
} from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

const LOAN_RELATED_INCOME_CODES = ["401001", "401002", "401005"] as const;
const LOAN_INCOME_NAME_TO_CODE: Record<string, string> = {
  "loan related income": "401000",
  "interest paid": "401001",
  "loan processing fees": "401002",
  "interest from savings": "401003",
  "loan penalty paid": "401005",
};

export class IncomeService {
  private static readonly BLOCKED_INCOME_CATEGORY_NAMES = [
    "loan insurance fees",
    "loan share capital",
  ];

  /** Get branch filter for a user */
  static async getBranchFilter(
    user: { role: string; branchId: string | null },
    requestedBranchId?: string | null,
  ) {
    if (user.role === UserRole.ADMIN) {
      return requestedBranchId ? { branchId: requestedBranchId } : {};
    }
    if (!user.branchId) return { branchId: "no-branch-assigned" };
    return { branchId: user.branchId };
  }

  /** Find or create an INCOME category */
  static async getOrCreateIncomeCategory(tx: Prisma.TransactionClient, code: string, name: string) {
    let cat = await tx.budgetCategory.findFirst({
      where: { 
        kind: "INCOME",
        OR: [
          { code },
          { name: { equals: name, mode: "insensitive" } }
        ]
      },
    });
    if (!cat) {
      cat = await tx.budgetCategory.create({
        data: { name, code, kind: "INCOME", isActive: true, parentId: null },
      });
    }
    return cat;
  }

  /** Fetch income record by ID */
  static async getIncomeRecordById(id: string, branchFilter: any = {}) {
    return db.incomeRecord.findFirst({
      where: {
        id,
        ...branchFilter,
        budgetCategory: {
          kind: "INCOME",
          name: {
            notIn: IncomeService.BLOCKED_INCOME_CATEGORY_NAMES,
            mode: "insensitive",
          },
        },
      },
      include: {
        budgetCategory: { include: { parent: true } },
        branch: true,
        member: { include: { user: true } },
        account: { include: { accountType: true } },
        receivedBy: { select: { id: true, name: true, role: true, email: true } },
        period: true,
      },
    });
  }

  private static normalizeIncomeCategoryName(name?: string | null) {
    return name?.trim().toLowerCase() || "";
  }

  private static resolveIncomeCodeFromName(name?: string | null) {
    const normalized = IncomeService.normalizeIncomeCategoryName(name);
    return LOAN_INCOME_NAME_TO_CODE[normalized] || null;
  }

  private static resolvePaymentMethod(value?: string | null): PaymentMethod {
    const normalized = value?.toUpperCase?.() || "";
    if (normalized === PaymentMethod.CASH) return PaymentMethod.CASH;
    if (normalized === PaymentMethod.BANK) return PaymentMethod.BANK;
    if (normalized === PaymentMethod.MOBILE_MONEY) return PaymentMethod.MOBILE_MONEY;
    return PaymentMethod.OTHER;
  }

  static async getUnifiedIncomeRecords(params: {
    user: { role: string; branchId: string | null };
    branchId?: string | null;
    branchIds?: string[];
    startDate?: Date;
    endDate?: Date;
  }) {
    const requestedBranchIds = params.branchIds?.filter(Boolean) || [];
    const branchFilter =
      params.user.role === UserRole.ADMIN
        ? requestedBranchIds.length > 0
          ? { branchId: { in: requestedBranchIds } }
          : params.branchId
            ? { branchId: params.branchId }
            : {}
        : params.user.branchId
          ? { branchId: params.user.branchId }
          : { branchId: "no-branch-assigned" };
    const dateFilter =
      params.startDate && params.endDate
        ? {
            recordDate: {
              gte: params.startDate,
              lte: params.endDate,
            },
          }
        : {};

    const baseWhere: any = {
      ...branchFilter,
      ...dateFilter,
      OR: [
        {
          budgetCategory: {
            kind: "INCOME",
            name: {
              notIn: IncomeService.BLOCKED_INCOME_CATEGORY_NAMES,
              mode: "insensitive",
            },
          },
        },
        {
          category: {
            kind: "INCOME",
            name: {
              notIn: IncomeService.BLOCKED_INCOME_CATEGORY_NAMES,
              mode: "insensitive",
            },
          },
        },
      ],
    };

    const directRecords = await db.incomeRecord.findMany({
      where: baseWhere,
      include: {
        budgetCategory: { include: { parent: true } },
        category: true,
        branch: true,
        member: { include: { user: true } },
        account: { include: { accountType: true } },
        receivedBy: { select: { id: true, name: true, role: true } },
        period: true,
      },
      orderBy: { recordDate: "desc" },
    });

    const directRows = directRecords.map((record) => {
      const resolvedBudgetCategory = record.budgetCategory || null;
      return {
        ...record,
        budgetCategory: resolvedBudgetCategory
          ? resolvedBudgetCategory
          : null,
        budgetCategoryId: record.budgetCategoryId || record.categoryId || null,
        paymentMethod: record.paymentMethod || PaymentMethod.CASH,
      };
    });

    const legacyCategoryRows = directRows.filter(
      (record) => !record.budgetCategory && record.category,
    );
    const legacyCategoryNames = Array.from(
      new Set(
        legacyCategoryRows
          .map((record) => record.category?.name?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    );
    const legacyCategoryCodes = legacyCategoryNames
      .map((name) => IncomeService.resolveIncomeCodeFromName(name))
      .filter((code): code is string => Boolean(code));

    const legacyBudgetCategories = legacyCategoryNames.length
      ? await db.budgetCategory.findMany({
          where: {
            kind: "INCOME",
            OR: [
              { name: { in: legacyCategoryNames } },
              { code: { in: legacyCategoryCodes } },
            ],
          },
          include: { parent: true },
        })
      : [];
    const legacyBudgetCategoryByName = new Map(
      legacyBudgetCategories.map((category) => [
        IncomeService.normalizeIncomeCategoryName(category.name),
        category,
      ]),
    );
    const legacyBudgetCategoryByCode = new Map(
      legacyBudgetCategories
        .filter((category) => Boolean(category.code))
        .map((category) => [category.code as string, category]),
    );

    const normalizedDirectRows = directRows.map((record) => {
      if (record.budgetCategory || !record.category) {
        return record;
      }

      const categoryName = IncomeService.normalizeIncomeCategoryName(record.category.name);
      const mappedCode =
        IncomeService.resolveIncomeCodeFromName(record.category.name) || undefined;
      const mappedBudgetCategory =
        (mappedCode ? legacyBudgetCategoryByCode.get(mappedCode) : null) ||
        legacyBudgetCategoryByName.get(categoryName) ||
        null;

      if (!mappedBudgetCategory) {
        return {
          ...record,
          budgetCategory: {
            id: record.category.id,
            name: record.category.name,
            code: mappedCode || null,
            parent: null,
          },
          budgetCategoryId: record.categoryId || null,
        };
      }

      return {
        ...record,
        budgetCategory: mappedBudgetCategory,
        budgetCategoryId: mappedBudgetCategory.id,
      };
    });

    const directCodes = new Set(
      normalizedDirectRows
        .map((record) => record.budgetCategory?.code)
        .filter((code): code is string => Boolean(code)),
    );
    const missingLoanCodes = LOAN_RELATED_INCOME_CODES.filter(
      (code) => !directCodes.has(code),
    );

    if (missingLoanCodes.length === 0) {
      return normalizedDirectRows;
    }

    const loanCategories = await db.budgetCategory.findMany({
      where: {
        kind: "INCOME",
        code: { in: missingLoanCodes },
      },
      include: { parent: true },
    });

    const loanCategoryMap = new Map(
      loanCategories.map((category) => [category.code || category.id, category]),
    );

    const fallbackEntries = await db.journalEntry.findMany({
      where: {
        ...branchFilter,
        ...(params.startDate && params.endDate
          ? {
              entryDate: {
                gte: params.startDate,
                lte: params.endDate,
              },
            }
          : {}),
        creditAmount: { gt: 0 },
        account: {
          accountCode: { in: missingLoanCodes },
        },
      },
      include: {
        account: true,
        transaction: {
          include: {
            account: { include: { accountType: true } },
            member: { include: { user: true } },
            processedByUser: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { entryDate: "desc" },
    });

    const branchIds = Array.from(
      new Set(
        fallbackEntries
          .map((entry) => entry.branchId || entry.transaction?.branchId || null)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const branches = branchIds.length
      ? await db.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, location: true },
        })
      : [];
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));

    const fallbackRows = fallbackEntries.map((entry) => {
      const code = entry.account?.accountCode || null;
      const category = code ? loanCategoryMap.get(code) || null : null;
      const transaction = entry.transaction;
      const branchId = entry.branchId || transaction?.branchId || null;

      return {
        id: `journal-${entry.id}`,
        categoryId: null,
        budgetCategoryId: category?.id || null,
        budgetCategory: category
          ? {
              ...category,
              parent: category.parent || null,
            }
          : null,
        amount: entry.creditAmount || 0,
        date: entry.entryDate,
        recordDate: entry.entryDate,
        description: entry.description,
        paymentMethod: IncomeService.resolvePaymentMethod(transaction?.paymentMethod),
        recognitionBasis: "CASH",
        receivedByUserId: transaction?.processedByUserId || "system",
        branchId,
        branch: branchId ? branchMap.get(branchId) || null : null,
        memberId: transaction?.memberId || null,
        member: transaction?.member
          ? {
              id: transaction.member.id,
              memberNumber: transaction.member.memberNumber,
              user: {
                name: transaction.member.user?.name || "Member",
                email: transaction.member.user?.email ?? null,
                phone: transaction.member.user?.phone ?? null,
              },
            }
          : null,
        accountId: transaction?.accountId || null,
        account: transaction?.account
          ? {
              id: transaction.account.id,
              accountNumber: transaction.account.accountNumber,
              accountType: {
                name: transaction.account.accountType?.name || "Account",
              },
            }
          : null,
        receivedBy: transaction?.processedByUser || null,
        periodId: null,
        period: null,
        status: transaction?.status || TransactionStatus.COMPLETED,
        receiptNo: transaction?.transactionRef || entry.reference || null,
        receiptNumber: transaction?.transactionRef || entry.reference || null,
        referenceNumber: entry.reference || transaction?.transactionRef || null,
        externalRef: transaction?.externalReference || null,
        depositorName: null,
        depositorContact: null,
        notes: entry.description,
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt,
      };
    });

    return [...normalizedDirectRows, ...fallbackRows].sort(
      (left, right) =>
        new Date(right.recordDate).getTime() - new Date(left.recordDate).getTime(),
    );
  }

  /** Helper: Ensure vault exists */
  private static async ensureVault(tx: Prisma.TransactionClient, userId: string) {
    const suffix = userId.slice(0, 6);
    let vault = await tx.vault.findFirst({
      where: { custodianUserId: userId, isActive: true },
    });

    if (!vault) {
      vault = await tx.vault.create({
        data: {
          name: `Accountant Vault — ${suffix}`,
          custodianUserId: userId,
          balance: 0,
          physicalCash: 0,
          isActive: true,
        },
      });
    }
    return vault;
  }

  /** Create Income Record */
  static async createIncomeRecord(data: any, user: any) {
    // Current period
    const currentPeriod = await db.financialPeriod.findFirst({
      where: { isClosed: false, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
    });

    const receiptNo = data.receiptNo?.trim() || `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    return db.$transaction(async (tx) => {
      const incomeRecord = await tx.incomeRecord.create({
        data: {
          budgetCategoryId: data.categoryId,
          amount: data.amount,
          date: new Date(data.recordDate),
          recordDate: new Date(data.recordDate),
          description: data.description?.trim(),
          paymentMethod: data.paymentMethod || PaymentMethod.CASH,
          recognitionBasis: data.recognitionBasis || RecognitionBasis.CASH,
          branchId: (user.role === "ADMIN" || user.role === "ACCOUNTANT") 
            ? (data.branchId || user.branchId || undefined) 
            : (user.branchId || undefined),
          memberId: data.memberId || undefined,
          accountId: data.accountId || undefined,
          receiptNo,
          receiptNumber: receiptNo,
          externalRef: data.externalRef?.trim(),
          depositorName: data.depositorName?.trim(),
          depositorContact: data.depositorContact?.trim(),
          notes: data.notes?.trim(),
          receivedByUserId: data.receivedByUserId || user.id,
          periodId: currentPeriod?.id,
          status: TransactionStatus.COMPLETED,
        },
        include: { budgetCategory: true, branch: true },
      });

      if (incomeRecord.paymentMethod === PaymentMethod.CASH) {
        const receiverId = incomeRecord.receivedByUserId;
        const float = await tx.userFloat.findUnique({ where: { userId: receiverId } });

        if (float) {
          await tx.userFloat.update({
            where: { id: float.id },
            data: { balance: { increment: incomeRecord.amount } },
          });
          await tx.floatTransaction.create({
            data: {
              floatId: float.id,
              type: TransactionType.DEPOSIT,
              amount: incomeRecord.amount,
              description: `Income: ${incomeRecord.description || receiptNo}`,
              performedByUserId: user.id,
              relatedTransactionId: incomeRecord.id,
            },
          });
        } else {
          const vault = await this.ensureVault(tx, receiverId);
          const before = vault.balance;
          const after = before + incomeRecord.amount;
          await tx.vault.update({ where: { id: vault.id }, data: { balance: after } });
          await tx.vaultTransaction.create({
            data: {
              vaultId: vault.id,
              type: VaultTransactionType.OVERAGE_RECEIVED,
              amount: incomeRecord.amount,
              balanceBefore: before,
              balanceAfter: after,
              description: `Income: ${incomeRecord.description || receiptNo}`,
              performedByUserId: user.id,
            },
          });
        }
      }

      // ── Double-entry GL for manual income ──
      const category = incomeRecord.budgetCategory || (incomeRecord.budgetCategoryId ? await tx.budgetCategory.findUnique({ where: { id: incomeRecord.budgetCategoryId } }) : undefined);
      const categoryCode = category?.code;
      if (categoryCode) {
        const incomeAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: categoryCode, isActive: true },
        });
        if (incomeAccount) {
          const assetCode = incomeRecord.paymentMethod === PaymentMethod.CASH ? CASH_AT_HAND_CODE : "102001";
          const assetAccount = await tx.chartOfAccount.findFirst({
            where: { accountCode: assetCode, isActive: true },
          });
          if (assetAccount) {
            const entryNumber = `JE-INC-${Date.now()}`;
            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: assetAccount.id,
                debitAmount: incomeRecord.amount,
                creditAmount: 0,
                description: `Income: ${incomeRecord.description || receiptNo}`,
                entryDate: new Date(),
                reference: `INC-${incomeRecord.id.slice(0, 8)}`,
                branchId: incomeRecord.branchId || undefined,
                transactionId: incomeRecord.id,
                createdByUserId: user.id,
              },
            });
            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: incomeAccount.id,
                debitAmount: 0,
                creditAmount: incomeRecord.amount,
                description: `Income: ${incomeRecord.description || receiptNo}`,
                entryDate: new Date(),
                reference: `INC-${incomeRecord.id.slice(0, 8)}`,
                branchId: incomeRecord.branchId || undefined,
                transactionId: incomeRecord.id,
                createdByUserId: user.id,
              },
            });
            await tx.chartOfAccount.update({
              where: { id: assetAccount.id },
              data: buildAccountBalanceUpdate(assetAccount, { debitAmount: incomeRecord.amount }),
            });
            await tx.chartOfAccount.update({
              where: { id: incomeAccount.id },
              data: buildAccountBalanceUpdate(incomeAccount, { creditAmount: incomeRecord.amount }),
            });
          }
        }
      }

      return incomeRecord;
    });
  }
}
