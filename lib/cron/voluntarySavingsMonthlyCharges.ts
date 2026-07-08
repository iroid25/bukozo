import { AccountStatus, TransactionStatus, TransactionType, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { isVoluntarySavingsAccountTypeName } from "@/lib/accounting/account-type-rules";
import {
  FEE_INCOME_CODE,
  MONTHLY_FEE_CHARGED_CODE,
  MONTHLY_FEE_CHARGED_NAME,
} from "@/lib/services/income-structure";
import { createWithdrawalFeeJournalEntry } from "@/lib/journal-entries-extended";
import {
  generateDormancyReference,
  shouldMarkAccountDormant,
} from "@/lib/services/savings-dormancy";

export type MonthlyChargeRunInput = {
  year: number;
  month: number;
  dryRun?: boolean;
  processedByUserId: string;
};

export type MonthlyChargeRunResult = {
  dryRun: boolean;
  period: string;
  summary: {
    eligible: number;
    charged: number;
    skipped: number;
    totalCharged: number;
  };
  details: Array<{
    accountId: string;
    accountNumber?: string;
    memberName?: string;
    monthlyCharge: number;
    balanceBefore: number;
    balanceAfter?: number;
    status: "charged" | "dormant" | "skipped" | "already_charged" | "insufficient";
    reason?: string;
  }>;
};

export async function processVoluntarySavingsMonthlyCharges({
  year,
  month,
  dryRun = false,
  processedByUserId,
}: MonthlyChargeRunInput): Promise<MonthlyChargeRunResult> {
  const resolvedUser =
    (await db.user.findUnique({
      where: { id: processedByUserId },
      select: { id: true },
    })) ||
    (await db.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));

  if (!resolvedUser) {
    throw new Error(
      "No valid user found to post monthly voluntary savings charges",
    );
  }

  const postingUserId = resolvedUser.id;
  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  const accounts = await db.account.findMany({
    where: {
      status: AccountStatus.ACTIVE,
      balance: { gt: 0 },
      accountType: {
        monthlyCharge: { gt: 0 },
      },
    },
    include: {
      accountType: {
        include: {
          ledgerAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              ledgerType: true,
            },
          },
        },
      },
      member: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
  });

  const eligibleAccounts = accounts.filter((account) =>
    isVoluntarySavingsAccountTypeName(account.accountType.name),
  );

  const details: MonthlyChargeRunResult["details"] = [];
  let totalCharged = 0;
  let chargedCount = 0;
  let skippedCount = 0;

  for (const account of eligibleAccounts) {
    const charge = account.accountType.monthlyCharge ?? 0;
    const chargeAmount = Math.min(charge, account.balance);
    const balanceAfterCharge = Math.max(0, account.balance - chargeAmount);
    const dormantAfterCharge = shouldMarkAccountDormant(
      balanceAfterCharge,
      account.accountType.minBalance,
    );
    const descriptionKey = `Monthly Charge [${periodLabel}] - ${account.accountNumber}`;

    const existingCharge = await db.transaction.findFirst({
      where: {
        accountId: account.id,
        type: TransactionType.FEE,
        description: { contains: `Monthly Charge [${periodLabel}]` },
        status: TransactionStatus.COMPLETED,
      },
    });

    if (existingCharge) {
      details.push({
        accountId: account.id,
        accountNumber: account.accountNumber,
        memberName: account.member?.user?.name,
        monthlyCharge: charge,
        balanceBefore: account.balance,
        status: "already_charged",
        reason: "Already charged for this period",
      });
      skippedCount++;
      continue;
    }

    if (!dryRun) {
      const transactionRef = generateDormancyReference("FEE");

      await db.$transaction(async (tx) => {
        const debitLedger =
          account.accountType?.ledgerAccount ||
          (await tx.chartOfAccount.findFirst({
            where: {
              accountCode: "201003",
              ledgerType: "LIABILITIES",
              isActive: true,
            },
          })) ||
          (await tx.chartOfAccount.findFirst({
            where: {
              ledgerType: "LIABILITIES",
              accountName: {
                contains: "Voluntary savings",
                mode: "insensitive",
              },
              isActive: true,
            },
          }));

        if (!debitLedger) {
          throw new Error(
            `Unable to resolve a savings liability ledger account for ${account.accountNumber}`,
          );
        }

        const transaction = await tx.transaction.create({
          data: {
            transactionRef,
            type: TransactionType.FEE,
            amount: chargeAmount,
            status: TransactionStatus.COMPLETED,
            description: descriptionKey,
            currency: "UGX",
            branchId: account.branchId,
            memberId: account.memberId ?? null,
            accountId: account.id,
            processedByUserId: postingUserId,
            channel: "SYSTEM",
          },
        });

        const feeIncomeParent = await tx.budgetCategory.upsert({
          where: { code: FEE_INCOME_CODE },
          update: {
            name: "Fee income",
            kind: "INCOME",
            description: "Income from service and transaction fees",
            isActive: true,
          },
          create: {
            name: "Fee income",
            code: FEE_INCOME_CODE,
            kind: "INCOME",
            description: "Income from service and transaction fees",
            isActive: true,
          },
        });

        const monthlyFeeCategory = await tx.budgetCategory.upsert({
          where: { code: MONTHLY_FEE_CHARGED_CODE },
          update: {
            name: MONTHLY_FEE_CHARGED_NAME,
            kind: "INCOME",
            description: "Fees charged monthly on savings accounts",
            isActive: true,
            parentId: feeIncomeParent.id,
          },
          create: {
            name: MONTHLY_FEE_CHARGED_NAME,
            code: MONTHLY_FEE_CHARGED_CODE,
            kind: "INCOME",
            description: "Fees charged monthly on savings accounts",
            isActive: true,
            parentId: feeIncomeParent.id,
          },
        });

        await tx.chartOfAccount.upsert({
          where: { accountCode: MONTHLY_FEE_CHARGED_CODE },
          update: {
            accountName: MONTHLY_FEE_CHARGED_NAME,
            fullCode: MONTHLY_FEE_CHARGED_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            category: "INCOME",
            description: "Fees charged monthly on savings accounts",
          },
          create: {
            accountName: MONTHLY_FEE_CHARGED_NAME,
            accountCode: MONTHLY_FEE_CHARGED_CODE,
            fullCode: MONTHLY_FEE_CHARGED_CODE,
            ledgerType: "INCOME",
            debitCredit: "CR",
            isActive: true,
            level: 2,
            category: "INCOME",
            description: "Fees charged monthly on savings accounts",
          },
        });

        const journalResult = await createWithdrawalFeeJournalEntry(
          {
            amount: chargeAmount,
            description: descriptionKey,
            reference: transactionRef,
            transactionId: transaction.id,
            userId: postingUserId,
            entryDate: new Date(),
            branchId: account.branchId,
            feeAccountCode: MONTHLY_FEE_CHARGED_CODE,
            feeAccountName: MONTHLY_FEE_CHARGED_NAME,
            debitAccountCode: debitLedger.accountCode,
          },
          tx,
        );

        if (!journalResult) {
          throw new Error("Failed to create monthly fee journal entry");
        }

        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: balanceAfterCharge,
            status: dormantAfterCharge ? AccountStatus.DORMANT : AccountStatus.ACTIVE,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: monthlyFeeCategory.id,
            amount: chargeAmount,
            date: new Date(),
            recordDate: new Date(),
            description: `Monthly Fee Charged - ${periodLabel} - ${account.accountNumber}`,
            receivedByUserId: postingUserId,
            branchId: account.branchId,
            memberId: account.memberId ?? null,
            accountId: account.id,
            status: TransactionStatus.COMPLETED,
            receiptNumber: transactionRef,
            receiptNo: transactionRef,
            referenceNumber: transactionRef,
            depositorName: account.member?.user?.name || account.accountNumber,
            notes: `Auto-posted monthly fee charge for ${periodLabel}`,
            externalRef: transactionRef,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: postingUserId,
            action: "UPDATE",
            entityType: "Account",
            entityId: account.id,
            details: `Monthly charge UGX ${chargeAmount} deducted for period ${periodLabel}${dormantAfterCharge ? " and account marked dormant" : ""}`,
          },
        });

        return transaction;
      });
    }

    details.push({
      accountId: account.id,
      accountNumber: account.accountNumber,
      memberName: account.member?.user?.name,
      monthlyCharge: charge,
      balanceBefore: account.balance,
      balanceAfter: balanceAfterCharge,
      status: dormantAfterCharge ? "dormant" : "charged",
    });
    totalCharged += chargeAmount;
    chargedCount++;
  }

  if (!dryRun && eligibleAccounts.length > 0) {
    await db.systemConfiguration.upsert({
      where: { key: "LAST_MONTHLY_CHARGE_DATE" },
      create: {
        key: "LAST_MONTHLY_CHARGE_DATE",
        value: new Date().toISOString(),
        description: "Last time monthly charges were processed",
        category: "PERIODIC",
      },
      update: { value: new Date().toISOString() },
    });
  }

  return {
    dryRun,
    period: periodLabel,
    summary: {
      eligible: eligibleAccounts.length,
      charged: chargedCount,
      skipped: skippedCount,
      totalCharged,
    },
    details,
  };
}
