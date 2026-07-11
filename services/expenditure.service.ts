import { db } from "@/prisma/db";
import { 
  Prisma, 
  UserRole, 
  PaymentMethod, 
  TransactionStatus, 
  TransactionType, 
} from "@prisma/client";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

export class ExpenditureService {
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

  /** Fetch expenditure record by ID */
  static async getExpenditureRecordById(id: string, branchFilter: any = {}) {
    return db.expenditureRecord.findFirst({
      where: { id, ...branchFilter },
      include: {
        category: true,
        budgetCategory: true,
        branch: true,
        submittedBy: { select: { id: true, name: true, role: true, email: true } },
        approvedBy: { select: { id: true, name: true, role: true, email: true } },
        period: true,
      },
    });
  }

  /** Create Expenditure Record */
  static async createExpenditureRecord(data: any, user: any) {
     // Get current active period
     const currentPeriod = await db.financialPeriod.findFirst({
        where: {
          isClosed: false,
          startDate: { lte: new Date(data.recordDate) },
          endDate: { gte: new Date(data.recordDate) },
        },
      });

    return db.expenditureRecord.create({
      data: {
        budgetCategoryId: data.categoryId,
        amount: data.amount,
        recordDate: new Date(data.recordDate),
        description: data.description?.trim(),
        payee: data.payee?.trim(),
        paymentMethod: data.paymentMethod || PaymentMethod.CASH,
        branchId: (user.role === "ADMIN" || user.role === "ACCOUNTANT") 
          ? (data.branchId || user.branchId || undefined) 
          : (user.branchId || undefined),
        voucherNo: data.voucherNo?.trim(),
        externalRef: data.externalRef?.trim(),
        submittedByUserId: user.id,
        periodId: currentPeriod?.id,
        status: TransactionStatus.PENDING,
        recognitionBasis: "CASH",
      },
      include: { budgetCategory: true, branch: true },
    });
  }

  /** Approve/Reject Expenditure */
  static async approveExpenditure(id: string, data: { status: "COMPLETED" | "FAILED"; rejectionReason?: string }, user: any) {
    return db.$transaction(async (tx) => {
      const existingRecord = await tx.expenditureRecord.findUnique({
        where: { id },
        include: { budgetCategory: true },
      });

      if (!existingRecord || existingRecord.status !== TransactionStatus.PENDING) {
        throw new Error("Invalid record or already processed");
      }

      const updateData: any = {
        status: data.status,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      };

      if (data.status === "FAILED" && data.rejectionReason) {
        updateData.rejectionReason = data.rejectionReason;
      }

      const updatedRecord = await tx.expenditureRecord.update({
        where: { id },
        data: updateData,
        include: { budgetCategory: true, branch: true },
      });

      // Deduction logic
      if (data.status === "COMPLETED") {
        const float = await tx.userFloat.findUnique({ where: { userId: updatedRecord.submittedByUserId } });
        if (float) {
          if (float.balance < updatedRecord.amount) {
            throw new Error(`Insufficient Float balance: ${float.balance}`);
          }
          await tx.userFloat.update({
            where: { id: float.id },
            data: { balance: { decrement: updatedRecord.amount } },
          });
          await tx.floatTransaction.create({
            data: {
              floatId: float.id,
              type: TransactionType.OTHER,
              amount: -updatedRecord.amount,
              description: `Expenditure: ${updatedRecord.description || updatedRecord.budgetCategory?.name}`,
              performedByUserId: user.id,
              relatedTransactionId: updatedRecord.id,
            },
          });
        }

        // ── Double-entry GL for expenditure ──
        const cat = updatedRecord.budgetCategory || (updatedRecord.budgetCategoryId ? await tx.budgetCategory.findUnique({ where: { id: updatedRecord.budgetCategoryId } }) : undefined);
        const catCode = cat?.code;
        if (catCode) {
          const expenseAccount = await tx.chartOfAccount.findFirst({
            where: { accountCode: catCode, isActive: true },
          });
          if (!expenseAccount) {
            console.warn(`[ExpenditureService] COA account not found for category code ${catCode} — journal entries skipped for expenditure ${updatedRecord.id}`);
          }
          if (expenseAccount) {
            const assetCode = updatedRecord.paymentMethod === PaymentMethod.CASH ? CASH_AT_HAND_CODE : "102001";
            const assetAccount = await tx.chartOfAccount.findFirst({
              where: { accountCode: assetCode, isActive: true },
            });
            if (!assetAccount) {
              console.warn(`[ExpenditureService] COA asset account not found for code ${assetCode} — journal entries skipped for expenditure ${updatedRecord.id}`);
            }
            if (assetAccount) {
              const entryNumber = `JE-EXP-${Date.now()}`;
              await tx.journalEntry.create({
                data: {
                  entryNumber,
                  accountId: expenseAccount.id,
                  debitAmount: updatedRecord.amount,
                  creditAmount: 0,
                  description: `Expenditure: ${updatedRecord.description || cat.name}`,
                  entryDate: new Date(),
                  reference: `EXP-${updatedRecord.id.slice(0, 8)}`,
                  branchId: updatedRecord.branchId || undefined,
                  transactionId: updatedRecord.id,
                  createdByUserId: user.id,
                },
              });
              await tx.journalEntry.create({
                data: {
                  entryNumber,
                  accountId: assetAccount.id,
                  debitAmount: 0,
                  creditAmount: updatedRecord.amount,
                  description: `Expenditure: ${updatedRecord.description || cat.name}`,
                  entryDate: new Date(),
                  reference: `EXP-${updatedRecord.id.slice(0, 8)}`,
                  branchId: updatedRecord.branchId || undefined,
                  transactionId: updatedRecord.id,
                  createdByUserId: user.id,
                },
              });
              await tx.chartOfAccount.update({
                where: { id: expenseAccount.id },
                data: buildAccountBalanceUpdate(expenseAccount, { debitAmount: updatedRecord.amount }),
              });
              await tx.chartOfAccount.update({
                where: { id: assetAccount.id },
                data: buildAccountBalanceUpdate(assetAccount, { creditAmount: updatedRecord.amount }),
              });
            }
          }
        } else {
          console.warn(`[ExpenditureService] No category code found for expenditure ${updatedRecord.id} — journal entries skipped`);
        }
      }
      return updatedRecord;
    });
  }
}
