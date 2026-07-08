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
