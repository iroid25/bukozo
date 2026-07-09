import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { db } from "@/prisma/db";
import {
  findActiveAccountByCodes,
  getAccountCodeCandidates,
} from "@/lib/accounting/coa-identity";
import { resolveShareCapitalAccount } from "@/lib/services/equity-structure";
import {
  CASH_AT_HAND_CODE,
  LOANS_CODE,
  RETIRED_LOAN_ASSET_CODE,
} from "@/lib/services/asset-structure";

// ============================================
// COMPREHENSIVE JOURNAL ENTRY HELPER FUNCTIONS
// ============================================

// 1. INCOME & EXPENDITURE
export { createIncomeJournalEntry, createExpenditureJournalEntry } from "./journal-entries";

// 2. LOANS
export { createLoanDisbursementJournalEntry, createLoanRepaymentJournalEntry, createLoanPenaltyAccrualJournalEntry } from "./journal-entries";

/**
 * Split Loan Repayment
 * Dr: Cash/Bank Account (+)
 * Cr: Loans Receivable (Principal) (-)
 * Cr: Interest Income (Interest) (+)
 * Cr: Penalty Income (Penalty) (+)
 */
export async function createSplitLoanRepaymentJournalEntry(data: {
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
  cashAccountCode?: string; // Default to 102001 (Cash at hand)
  debitAccountCode?: string; // If provided, overrides cashAccountCode (for savings deductions)
  ledgerAccountId?: string;
  interestAccountId?: string;
  penaltyAccountId?: string;
}, tx: any = db) {
  const totalAmount = data.principalAmount + data.interestAmount + data.penaltyAmount;
  if (totalAmount <= 0) throw new Error("Total amount must be greater than 0 for split repayment journal");

  const debitCode = data.debitAccountCode || data.cashAccountCode || "102001";

  const [cashAccount, loanAccount, interestAccount, penaltyAccount] = await Promise.all([
    findActiveAccountByCodes(tx, [debitCode]),
    data.ledgerAccountId
      ? tx.chartOfAccount.findUnique({ where: { id: data.ledgerAccountId, isActive: true } })
      : findActiveAccountByCodes(tx, getAccountCodeCandidates("107000")),
    data.interestAccountId
      ? tx.chartOfAccount.findUnique({ where: { id: data.interestAccountId, isActive: true } })
      : tx.chartOfAccount.findFirst({ where: { accountCode: "401001", isActive: true } }),
    data.penaltyAccountId
      ? tx.chartOfAccount.findUnique({ where: { id: data.penaltyAccountId, isActive: true } })
      : findActiveAccountByCodes(tx, getAccountCodeCandidates("401005")),
  ]);

  if (!cashAccount || !loanAccount || !interestAccount) {
    throw new Error("Required accounts (Debit/Cash: " + debitCode + ", Loan: 107000, Interest: 401001) not found for split repayment");
  }

  const linkedTransaction = data.transactionId
    ? await tx.transaction.findUnique({
        where: { id: data.transactionId },
        select: { id: true },
      })
    : null;
  const journalTransactionId = linkedTransaction?.id || null;

  const entryNumber = `JE-REPAY-SPLIT-${Date.now()}`;
  const isTransaction = (tx as any).$transaction === undefined; // Check if tx is a transaction client

  const operations = async (client: any) => {
      // Debits (Total Cash Received)
      await client.journalEntry.create({
          data: {
              entryNumber,
              accountId: cashAccount.id,
              debitAmount: totalAmount,
              creditAmount: 0,
              description: data.description,
              reference: data.reference || null,
              transactionId: journalTransactionId,
              createdByUserId: data.userId,
              entryDate: data.entryDate ?? undefined,
              branchId: data.branchId || null,
          }
      });
      await client.chartOfAccount.update({
          where: { id: cashAccount.id },
          data: buildAccountBalanceUpdate(cashAccount, { debitAmount: totalAmount })
      });

      // Credits (Splits)
      
      // 1. Principal (Reduces Loan Portfolio Asset)
      if (data.principalAmount > 0) {
          await client.journalEntry.create({
              data: {
                  entryNumber,
                  accountId: loanAccount.id,
                  debitAmount: 0,
                  creditAmount: data.principalAmount,
                  description: `${data.description} (Principal)`,
                  reference: data.reference || null,
                  transactionId: journalTransactionId,
                  createdByUserId: data.userId,
                  entryDate: data.entryDate ?? undefined,
                  branchId: data.branchId || null,
              }
          });
          await client.chartOfAccount.update({
              where: { id: loanAccount.id },
              data: buildAccountBalanceUpdate(loanAccount, { creditAmount: data.principalAmount })
          });
      }

      // 2. Interest (Increases Income)
      if (data.interestAmount > 0) {
          await client.journalEntry.create({
              data: {
                  entryNumber,
                  accountId: interestAccount.id,
                  debitAmount: 0,
                  creditAmount: data.interestAmount,
                  description: `${data.description} (Interest)`,
                  reference: data.reference || null,
                  transactionId: journalTransactionId,
                  createdByUserId: data.userId,
                  entryDate: data.entryDate ?? undefined,
                  branchId: data.branchId || null,
              }
          });
          await client.chartOfAccount.update({
              where: { id: interestAccount.id },
              data: buildAccountBalanceUpdate(interestAccount, { creditAmount: data.interestAmount })
          });
      }

      // 3. Penalty (Increases Income)
      if (data.penaltyAmount > 0 && penaltyAccount) {
          await client.journalEntry.create({
              data: {
                  entryNumber,
                  accountId: penaltyAccount.id,
                  debitAmount: 0,
                  creditAmount: data.penaltyAmount,
                  description: `${data.description} (Penalty)`,
                  reference: data.reference || null,
                  transactionId: journalTransactionId,
                  createdByUserId: data.userId,
                  entryDate: data.entryDate ?? undefined,
                  branchId: data.branchId || null,
              }
          });
          await client.chartOfAccount.update({
              where: { id: penaltyAccount.id },
              data: buildAccountBalanceUpdate(penaltyAccount, { creditAmount: data.penaltyAmount })
          });
      }
  };

  if (isTransaction) {
    await operations(tx);
  } else {
    await db.$transaction(async (newTx) => {
      await operations(newTx);
    });
  }

  return { success: true, entryNumber };
}

// ============================================
// JOURNAL ENTRY REVERSAL
// ============================================

/**
 * Reverses all journal entries linked to a given record via transactionId.
 * Creates opposite-direction entries and updates COA balances accordingly.
 * Safe to call even if no journal entries exist (no-op).
 */
export async function reverseJournalEntriesForRecord(
  recordId: string,
  userId: string,
  description: string,
  tx: any,
  entryDate?: Date,
  branchId?: string,
) {
  const entries = await tx.journalEntry.findMany({
    where: { transactionId: recordId },
  });

  if (entries.length === 0) return;

  const reversals: Array<{ original: typeof entries[0]; reverseDebit: number; reverseCredit: number }> = [];

  for (const entry of entries) {
    reversals.push({
      original: entry,
      reverseDebit: entry.creditAmount, // Swap debit <-> credit
      reverseCredit: entry.debitAmount,
    });
  }

  const revEntryNumber = `JE-REV-${Date.now()}-${recordId.slice(0, 6)}`;

  for (const rev of reversals) {
    await tx.journalEntry.create({
      data: {
        entryNumber: revEntryNumber,
        accountId: rev.original.accountId,
        debitAmount: rev.reverseDebit,
        creditAmount: rev.reverseCredit,
        description: `REVERSAL: ${description}`,
        reference: rev.original.reference,
        transactionId: recordId,
        createdByUserId: userId,
        entryDate: entryDate || null,
        branchId: branchId || null,
      },
    });

    const coa = await tx.chartOfAccount.findUnique({
      where: { id: rev.original.accountId },
      select: { id: true, debitBalance: true, creditBalance: true, balance: true, ledgerType: true, accountCode: true, accountName: true, fullCode: true, parentId: true, level: true, category: true, isActive: true, isSystem: true },
    });
    if (coa) {
      await tx.chartOfAccount.update({
        where: { id: coa.id },
        data: buildAccountBalanceUpdate(coa, { debitAmount: rev.reverseDebit, creditAmount: rev.reverseCredit }),
      });
    }
  }
}

/**
 * Comprehensive Loan Disbursement Journal Entry
 */
export async function createComprehensiveLoanDisbursementJournalEntry(data: {
  amountGranted: number; // Gross amount
  netDisbursement: number; // Net amount given to borrower
  processingFee: number;
  insuranceFee: number;
  shareCapital: number;
  loanRecoveryPrincipal: number;
  loanRecoveryInterest: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
  sourceAccountCode?: string; // Default to 102001 (Cash at hand)
  ledgerAccountId?: string;
  interestAccountId?: string;
  penaltyAccountId?: string;
  feeAccountId?: string;
  shareAccountId?: string;
  insuranceAccountId?: string;
}, tx: any = db) {
  const resolveAccountByIdOrCode = async (
    ref: string | undefined,
    fallbackCode: string,
  ) => {
    if (ref) {
      const byId = await tx.chartOfAccount.findUnique({
        where: { id: ref },
      });
      if (byId?.accountCode === RETIRED_LOAN_ASSET_CODE) {
        const liveLoansAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: LOANS_CODE, isActive: true },
        });
        if (liveLoansAccount) return liveLoansAccount;
      }
      if (byId?.isActive) return byId;

      const byCode = await tx.chartOfAccount.findFirst({
        where: { accountCode: ref, isActive: true },
      });
      if (byCode?.accountCode === RETIRED_LOAN_ASSET_CODE) {
        const liveLoansAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: LOANS_CODE, isActive: true },
        });
        if (liveLoansAccount) return liveLoansAccount;
      }
      if (byCode) return byCode;
    }

    if (fallbackCode === RETIRED_LOAN_ASSET_CODE) {
      const liveLoansAccount = await tx.chartOfAccount.findFirst({
        where: { accountCode: LOANS_CODE, isActive: true },
      });
      if (liveLoansAccount) return liveLoansAccount;
    }

    return tx.chartOfAccount.findFirst({
      where: { accountCode: fallbackCode, isActive: true },
    });
  };

  const [
    sourceAccount,
    loanPortfolioAccount,
    feeAccount,
    insuranceAccount,
    interestIncomeAccount,
    penaltyIncomeAccount,
    sharesAccount
  ] = await Promise.all([
    findActiveAccountByCodes(tx, getAccountCodeCandidates(data.sourceAccountCode || "102001")),
    resolveAccountByIdOrCode(data.ledgerAccountId, "107000"),
    resolveAccountByIdOrCode(data.feeAccountId, "401002"),
    resolveAccountByIdOrCode(data.insuranceAccountId, "200600"),
    resolveAccountByIdOrCode(data.interestAccountId, "401001"),
    resolveAccountByIdOrCode(data.penaltyAccountId, "401005"),
    resolveAccountByIdOrCode(data.shareAccountId, "304000"),
  ]);

  if (!sourceAccount || !loanPortfolioAccount) {
    throw new Error("Critical accounts (Source or Portfolio) not found for disbursement JE");
  }

  const entryNumber = `JE-DISB-COMP-${Date.now()}`;
  const isTransaction = (tx as any).$transaction === undefined;

  const operations = async (client: any) => {
    // 1. Debit: Loan Portfolio (Asset Increases by full amount granted)
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: loanPortfolioAccount.id,
        debitAmount: data.amountGranted,
        creditAmount: 0,
        description: `${data.description} (Principal Disbursement)`,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      }
    });
    await client.chartOfAccount.update({
      where: { id: loanPortfolioAccount.id },
      data: buildAccountBalanceUpdate(loanPortfolioAccount, { debitAmount: data.amountGranted })
    });

    // 2. Credit: Source Account (Asset Decreases by net disbursement)
    // Note: netDisbursement is what actually leaves the vault/bank
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: sourceAccount.id,
        debitAmount: 0,
        creditAmount: data.netDisbursement,
        description: `${data.description} (Cash Outflow)`,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      }
    });
    await client.chartOfAccount.update({
      where: { id: sourceAccount.id },
      data: buildAccountBalanceUpdate(sourceAccount, { creditAmount: data.netDisbursement })
    });

    // Credits for Deductions (Internal movement or Income recognition)
    
    // 3. Processing Fee (Income)
    if (data.processingFee > 0 && feeAccount) {
      await client.journalEntry.create({
        data: {
          entryNumber,
          accountId: feeAccount.id,
          debitAmount: 0,
          creditAmount: data.processingFee,
          description: `${data.description} (Processing Fee)`,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        }
      });
      await client.chartOfAccount.update({
        where: { id: feeAccount.id },
        data: buildAccountBalanceUpdate(feeAccount, { creditAmount: data.processingFee })
      });
    }

    // 4. Insurance (Liability/Pool)
    if (data.insuranceFee > 0 && insuranceAccount) {
      await client.journalEntry.create({
        data: {
          entryNumber,
          accountId: insuranceAccount.id,
          debitAmount: 0,
          creditAmount: data.insuranceFee,
          description: `${data.description} (Insurance Premium)`,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        }
      });
      await client.chartOfAccount.update({
        where: { id: insuranceAccount.id },
        data: buildAccountBalanceUpdate(insuranceAccount, { creditAmount: data.insuranceFee })
      });
    }

    // 5. Existing Loan Recovery - Principal (Reduces Portfolio)
    if (data.loanRecoveryPrincipal > 0) {
      // This is a credit to the same loanPortfolioAccount (Asset decrease)
      // But for clarity we create a separate JE line
      await client.journalEntry.create({
        data: {
          entryNumber,
          accountId: loanPortfolioAccount.id,
          debitAmount: 0,
          creditAmount: data.loanRecoveryPrincipal,
          description: `${data.description} (Old Loan Principal Recovery)`,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        }
      });
      await client.chartOfAccount.update({
        where: { id: loanPortfolioAccount.id },
        data: buildAccountBalanceUpdate(loanPortfolioAccount, { creditAmount: data.loanRecoveryPrincipal })
      });
    }

    // 6. Existing Loan Recovery - Interest (Income)
    if (data.loanRecoveryInterest > 0 && interestIncomeAccount) {
      await client.journalEntry.create({
        data: {
          entryNumber,
          accountId: interestIncomeAccount.id,
          debitAmount: 0,
          creditAmount: data.loanRecoveryInterest,
          description: `${data.description} (Old Loan Interest Recovery)`,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        }
      });
      await client.chartOfAccount.update({
        where: { id: interestIncomeAccount.id },
        data: buildAccountBalanceUpdate(interestIncomeAccount, { creditAmount: data.loanRecoveryInterest })
      });
    }

    // 7. Share Capital Deduction (Equity)
    if (data.shareCapital > 0 && sharesAccount) {
      await client.journalEntry.create({
        data: {
          entryNumber,
          accountId: sharesAccount.id,
          debitAmount: 0,
          creditAmount: data.shareCapital,
          description: `${data.description} (Share Capital Contribution)`,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        }
      });
      await client.chartOfAccount.update({
        where: { id: sharesAccount.id },
        data: buildAccountBalanceUpdate(sharesAccount, { creditAmount: data.shareCapital })
      });
    }
  };

  if (isTransaction) {
    await operations(tx);
  } else {
    await db.$transaction(async (newTx) => {
      await operations(newTx);
    });
  }

  return { success: true, entryNumber };
}


// ============================================
// 3. ASSET TRANSACTIONS
// ============================================

/**
 * Asset Purchase (Land, Buildings, Equipment, Vehicles)
 * Dr: Asset Account (+)
 * Cr: Cash Account (-)
 */
export async function createAssetPurchaseJournalEntry(data: {
  amount: number;
  assetAccountCode: string; // e.g., "101001" for LAND, "101004" for BUILDING
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [assetAccount, cashAccount] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: { accountCode: data.assetAccountCode, isActive: true },
    }),
    db.chartOfAccount.findFirst({
      where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
    }),
  ]);

  if (!assetAccount || !cashAccount) throw new Error("Asset or Cash account not found for asset purchase journal");

  const entryNumber = `JE-ASSET-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: assetAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: assetAccount.id },
      data: buildAccountBalanceUpdate(assetAccount, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

/**
 * Depreciation Entry
 * Dr: Depreciation Expense (+)
 * Cr: Accumulated Depreciation (+)
 */
export async function createDepreciationJournalEntry(data: {
  amount: number;
  assetAccountCode: string;
  description: string;
  reference?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [depreciationExpense, accumulatedDepreciation] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: {
        ledgerType: "EXPENDITURES",
        accountName: { contains: "DEPRECIATION", mode: "insensitive" },
        isActive: true,
      },
    }),
    db.chartOfAccount.findFirst({
      where: {
        ledgerType: "LIABILITIES",
        accountName: { contains: "ACCUMULATED", mode: "insensitive" },
        isActive: true,
      },
    }),
  ]);

  if (!depreciationExpense || !accumulatedDepreciation) throw new Error("Depreciation accounts not found");

  const entryNumber = `JE-DEP-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: depreciationExpense.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: accumulatedDepreciation.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: depreciationExpense.id },
      data: buildAccountBalanceUpdate(depreciationExpense, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: accumulatedDepreciation.id },
      data: buildAccountBalanceUpdate(accumulatedDepreciation, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

// ============================================
// 4. EMPLOYEE TRANSACTIONS
// ============================================

/**
 * Salary Payment
 * Dr: Salary Expense (+)
 * Cr: Cash Account (-)
 */
export async function createSalaryPaymentJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [salaryExpense, cashAccount] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: {
        ledgerType: "EXPENDITURES",
        accountName: { contains: "SALARY", mode: "insensitive" },
        isActive: true,
      },
    }),
    db.chartOfAccount.findFirst({
      where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
    }),
  ]);

  if (!salaryExpense || !cashAccount) throw new Error("Salary or Cash account not found");

  const entryNumber = `JE-SAL-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: salaryExpense.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: salaryExpense.id },
      data: buildAccountBalanceUpdate(salaryExpense, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

// ============================================
// 5. MEMBER TRANSACTIONS
// ============================================

/**
 * Member Deposit
 * Dr: Cash Account (+)
 * Cr: Member Savings Account (+)
 */
export async function createMemberDepositJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  cashAccountCode?: string;
  savingsLedgerAccountCode?: string;
  entryDate?: Date;
  branchId?: string;
}, tx: any = db) {
  const assetCode = data.cashAccountCode || CASH_AT_HAND_CODE;
  const [cashAccount, savingsAccount] = await Promise.all([
    tx.chartOfAccount.findFirst({
      where: { accountCode: assetCode, isActive: true },
    }),
    data.savingsLedgerAccountCode
      ? tx.chartOfAccount.findFirst({
          where: { accountCode: data.savingsLedgerAccountCode, isActive: true },
        })
      : tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "LIABILITIES",
            accountName: { contains: "SAVINGS", mode: "insensitive" },
            isActive: true,
          },
        }),
  ]);

  if (!cashAccount || !savingsAccount) throw new Error("Cash or Savings account not found for deposit journal");

  const entryNumber = `JE-DEP-${Date.now()}`;

  const operations = async (client: any) => {
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: savingsAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await client.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { debitAmount: data.amount }),
    });
    await client.chartOfAccount.update({
      where: { id: savingsAccount.id },
      data: buildAccountBalanceUpdate(savingsAccount, { creditAmount: data.amount }),
    });
  };

  if (tx === db) {
    await db.$transaction(async (newTx) => {
      await operations(newTx);
    });
  } else {
    await operations(tx);
  }

  return { success: true, entryNumber };
}

/**
 * Member Withdrawal
 * Dr: Member Savings Account (-)
 * Cr: Cash Account (-)
 */
export async function createMemberWithdrawalJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  entryDate?: Date;
  branchId?: string;
}) {
  const [savingsAccount, cashAccount] = await Promise.all([
    db.chartOfAccount.findFirst({
      where: {
        ledgerType: "LIABILITIES",
        accountName: { contains: "SAVINGS", mode: "insensitive" },
        isActive: true,
      },
    }),
    db.chartOfAccount.findFirst({
      where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
    }),
  ]);

  if (!savingsAccount || !cashAccount) throw new Error("Savings or Cash account not found for withdrawal journal");

  const entryNumber = `JE-WD-${Date.now()}`;

  await db.$transaction([
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: savingsAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    }),
    db.chartOfAccount.update({
      where: { id: savingsAccount.id },
      data: buildAccountBalanceUpdate(savingsAccount, { debitAmount: data.amount }),
    }),
    db.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    }),
  ]);

  return { success: true, entryNumber };
}

// ============================================
// 6. EQUITY TRANSACTIONS
// ============================================

/**
 * Share Capital Contribution
 * Dr: Cash Account (+)
 * Cr: Share Capital (+)
 */
export async function createShareCapitalJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  debitAccountCode?: string;
  entryDate?: Date;
  branchId?: string;
}, tx: any = db) {
  const assetCode = data.debitAccountCode || CASH_AT_HAND_CODE;
  const [cashAccount, shareCapital] = await Promise.all([
    tx.chartOfAccount.findFirst({
      where: { accountCode: assetCode, isActive: true },
    }),
    resolveShareCapitalAccount(),
  ]);

  if (!cashAccount || !shareCapital) throw new Error("Cash or Share Capital account not found");

  const entryNumber = `JE-SHARE-${Date.now()}`;

  const isTransaction = tx !== db;

  if (isTransaction) {
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: shareCapital.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await tx.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { debitAmount: data.amount }),
    });
    await tx.chartOfAccount.update({
      where: { id: shareCapital.id },
      data: buildAccountBalanceUpdate(shareCapital, { creditAmount: data.amount }),
    });
  } else {
    await db.$transaction([
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
          debitAmount: data.amount,
          creditAmount: 0,
          description: data.description,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        },
      }),
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: shareCapital.id,
          debitAmount: 0,
          creditAmount: data.amount,
          description: data.description,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        },
      }),
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: buildAccountBalanceUpdate(cashAccount, { debitAmount: data.amount }),
      }),
      db.chartOfAccount.update({
        where: { id: shareCapital.id },
        data: buildAccountBalanceUpdate(shareCapital, { creditAmount: data.amount }),
      }),
    ]);
  }

  return { success: true, entryNumber };
}

// ============================================
// 7. FEE TRANSACTIONS
// ============================================

/**
 * Withdrawal Fee Income
 * Dr: Member Savings Account (-) [Fee deducted from member]
 * Cr: Fee Income Account (+) [Income recognized]
 */
export async function createWithdrawalFeeJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  feeAccountCode?: string;
  feeAccountName?: string;
  /** Exact GL account code for the savings liability being debited (e.g. from accountType.ledgerAccount.accountCode) */
  debitAccountCode?: string;
  entryDate?: Date;
  branchId?: string;
}, tx: any = db) {
  const [savingsAccount, feeIncomeAccount] = await Promise.all([
    data.debitAccountCode
      ? tx.chartOfAccount.findFirst({
          where: {
            accountCode: data.debitAccountCode,
            ledgerType: "LIABILITIES",
            isActive: true,
          },
        })
      : tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "LIABILITIES",
            accountName: { contains: "Member Savings", mode: "insensitive" },
            isActive: true,
          },
        }),
    data.feeAccountCode
      ? tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "INCOME",
            accountCode: data.feeAccountCode,
            isActive: true,
          },
        })
      : tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "INCOME",
            accountName: data.feeAccountName
              ? { equals: data.feeAccountName, mode: "insensitive" }
              : { contains: "FEE", mode: "insensitive" },
            isActive: true,
          },
        }),
  ]);

  if (!savingsAccount || !feeIncomeAccount) {
    throw new Error("Required accounts not found for withdrawal fee entry");
  }

  const entryNumber = `JE-WFEE-${Date.now()}`;

  // If tx is the main db instance, use $transaction
  // If tx is already a transaction client, just await the operations
  const isTransaction = tx !== db;

  if (isTransaction) {
      // We are already in a transaction, so just run commands sequentially
      await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: savingsAccount.id,
            debitAmount: data.amount,
            creditAmount: 0,
            description: data.description,
            reference: data.reference || null,
            transactionId: data.transactionId || null,
            createdByUserId: data.userId,
            entryDate: data.entryDate ?? undefined,
            branchId: data.branchId || null,
          },
      });
      await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: feeIncomeAccount.id,
            debitAmount: 0,
            creditAmount: data.amount,
            description: data.description,
            reference: data.reference || null,
            transactionId: data.transactionId || null,
            createdByUserId: data.userId,
            entryDate: data.entryDate ?? undefined,
            branchId: data.branchId || null,
          },
      });
      await tx.chartOfAccount.update({
          where: { id: savingsAccount.id },
          data: buildAccountBalanceUpdate(savingsAccount, { debitAmount: data.amount }),
      });
      await tx.chartOfAccount.update({
          where: { id: feeIncomeAccount.id },
          data: buildAccountBalanceUpdate(feeIncomeAccount, { creditAmount: data.amount }),
      });
  } else {
      // Start a new transaction
      await db.$transaction([
        db.journalEntry.create({
          data: {
            entryNumber,
            accountId: savingsAccount.id,
            debitAmount: data.amount,
            creditAmount: 0,
            description: data.description,
            reference: data.reference || null,
            transactionId: data.transactionId || null,
            createdByUserId: data.userId,
            entryDate: data.entryDate ?? undefined,
            branchId: data.branchId || null,
          },
        }),
        db.journalEntry.create({
          data: {
            entryNumber,
            accountId: feeIncomeAccount.id,
            debitAmount: 0,
            creditAmount: data.amount,
            description: data.description,
            reference: data.reference || null,
            transactionId: data.transactionId || null,
            createdByUserId: data.userId,
            entryDate: data.entryDate ?? undefined,
            branchId: data.branchId || null,
          },
        }),
        db.chartOfAccount.update({
          where: { id: savingsAccount.id },
          data: buildAccountBalanceUpdate(savingsAccount, { debitAmount: data.amount }),
        }),
        db.chartOfAccount.update({
          where: { id: feeIncomeAccount.id },
          data: buildAccountBalanceUpdate(feeIncomeAccount, { creditAmount: data.amount }),
        }),
      ]);
  }

  return { success: true, entryNumber };
}

/**
 * Withdrawal Principal Journal Entry (for confirm route)
 * Dr: Savings Liability (LIABILITIES) — liability decreases
 * Cr: Cash/Bank (ASSETS) — asset decreases
 */
export async function createWithdrawalPrincipalJournalEntry(data: {
  amount: number;
  description: string;
  reference?: string;
  transactionId?: string;
  userId: string;
  /** Exact GL account code for the savings liability being debited */
  debitAccountCode?: string;
  /** GL account code for cash/bank being credited (default CASH_AT_HAND_CODE for cash, use "102001" for bank) */
  cashAccountCode?: string;
  entryDate?: Date;
  branchId?: string;
}, tx: any = db) {
  const assetCode = data.cashAccountCode || CASH_AT_HAND_CODE;
  const [savingsAccount, cashAccount] = await Promise.all([
    data.debitAccountCode
      ? tx.chartOfAccount.findFirst({
          where: {
            accountCode: data.debitAccountCode,
            ledgerType: "LIABILITIES",
            isActive: true,
          },
        })
      : tx.chartOfAccount.findFirst({
          where: {
            ledgerType: "LIABILITIES",
            accountName: { contains: "Member Savings", mode: "insensitive" },
            isActive: true,
          },
        }),
    tx.chartOfAccount.findFirst({
      where: { accountCode: assetCode, isActive: true },
    }),
  ]);

  if (!savingsAccount || !cashAccount) {
    throw new Error("Required accounts not found for withdrawal principal entry");
  }

  const entryNumber = `JE-WPRIN-${Date.now()}`;

  const isTransaction = tx !== db;

  if (isTransaction) {
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: savingsAccount.id,
        debitAmount: data.amount,
        creditAmount: 0,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: data.amount,
        description: data.description,
        reference: data.reference || null,
        transactionId: data.transactionId || null,
        createdByUserId: data.userId,
        entryDate: data.entryDate ?? undefined,
        branchId: data.branchId || null,
      },
    });
    await tx.chartOfAccount.update({
      where: { id: savingsAccount.id },
      data: buildAccountBalanceUpdate(savingsAccount, { debitAmount: data.amount }),
    });
    await tx.chartOfAccount.update({
      where: { id: cashAccount.id },
      data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
    });
  } else {
    await db.$transaction([
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: savingsAccount.id,
          debitAmount: data.amount,
          creditAmount: 0,
          description: data.description,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        },
      }),
      db.journalEntry.create({
        data: {
          entryNumber,
          accountId: cashAccount.id,
          debitAmount: 0,
          creditAmount: data.amount,
          description: data.description,
          reference: data.reference || null,
          transactionId: data.transactionId || null,
          createdByUserId: data.userId,
          entryDate: data.entryDate ?? undefined,
          branchId: data.branchId || null,
        },
      }),
      db.chartOfAccount.update({
        where: { id: savingsAccount.id },
        data: buildAccountBalanceUpdate(savingsAccount, { debitAmount: data.amount }),
      }),
      db.chartOfAccount.update({
        where: { id: cashAccount.id },
        data: buildAccountBalanceUpdate(cashAccount, { creditAmount: data.amount }),
      }),
    ]);
  }

  return { success: true, entryNumber };
}

// ============================================
// 8. MIGRATION TRANSACTIONS
// ============================================

/**
 * Migration Opening Balance
 * Dr: Loan Portfolio Asset (+) [outstandingBalance]
 * Cr: Migration Clearing / Equity (+) [outstandingBalance]
 */
export async function createMigrationOpeningBalanceEntry(data: {
  loanId: string;
  memberId: string;
  branchId: string;
  principal: number;
  outstandingBalance: number;
  interestDue: number;
  ledgerAccountId?: string;
  interestAccountId?: string;
  officerId: string;
  description: string;
  date: Date;
  reference?: string;
  entryDate?: Date;
}, tx: any = db) {
  const [loanAccount, clearingAccount] = await Promise.all([
    data.ledgerAccountId
      ? tx.chartOfAccount.findUnique({ where: { id: data.ledgerAccountId, isActive: true } })
      : findActiveAccountByCodes(tx, getAccountCodeCandidates("107000")),
    findActiveAccountByCodes(tx, getAccountCodeCandidates("102001")),
  ]);

  if (!loanAccount || !clearingAccount) throw new Error("Migration accounts not found");

  const entryNumber = `JE-MIG-${Date.now()}`;
  const isTransaction = (tx as any).$transaction === undefined;

  const operations = async (client: any) => {
    // Debit: Loan Portfolio
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: loanAccount.id,
        debitAmount: data.outstandingBalance,
        creditAmount: 0,
        description: data.description,
        createdByUserId: data.officerId,
        reference: data.reference || null,
        entryDate: data.entryDate || data.date || null,
        branchId: data.branchId || null,
      }
    });
    await client.chartOfAccount.update({
      where: { id: loanAccount.id },
      data: buildAccountBalanceUpdate(loanAccount, { debitAmount: data.outstandingBalance })
    });

    // Credit: Clearing/Equity
    await client.journalEntry.create({
      data: {
        entryNumber,
        accountId: clearingAccount.id,
        debitAmount: 0,
        creditAmount: data.outstandingBalance,
        description: data.description,
        createdByUserId: data.officerId,
        reference: data.reference || null,
        entryDate: data.entryDate || data.date || null,
        branchId: data.branchId || null,
      }
    });
    await client.chartOfAccount.update({
      where: { id: clearingAccount.id },
      data: buildAccountBalanceUpdate(clearingAccount, { creditAmount: data.outstandingBalance })
    });
  };

  if (isTransaction) {
    await operations(tx);
  } else {
    await db.$transaction(async (newTx) => {
      await operations(newTx);
    });
  }

  return { success: true, entryNumber };
}
