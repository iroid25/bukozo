import { AccountStatus, InsuranceContributionType, Prisma } from "@prisma/client";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";
const LOAN_INSURANCE_POOL_ACCOUNT = "SACCO_LOAN_INSURANCE_POOL";
const DEFAULT_INSURANCE_LIABILITY_CODE = "200600";
const LEGACY_INSURANCE_LIABILITY_CODES = ["201020", "202001"];
const DEFAULT_CASH_ASSET_CODE = CASH_AT_HAND_CODE;

type InsuranceTransactionInput = {
  transactionRef: string;
  description: string;
  processedByUserId: string;
  memberId?: string | null;
  institutionId?: string | null;
  loanId?: string | null;
};

type RecordLoanInsuranceCollectionInput = {
  tx: Prisma.TransactionClient;
  amount: number;
  createdById: string;
  branchId?: string | null;
  memberId?: string | null;
  loanApplicationId?: string | null;
  description: string;
  reference?: string | null;
  entryDescription?: string;
  createJournalEntry?: boolean;
  debitAccountCode?: string;
  operationalTransaction?: InsuranceTransactionInput;
};

type RecordInsuranceSettlementInput = {
  tx: Prisma.TransactionClient;
  amount: number;
  createdById: string;
  description: string;
  reference?: string | null;
  creditAccountCode?: string;
};

export async function ensureLoanInsurancePoolAccount(
  tx: Prisma.TransactionClient,
  branchId?: string | null,
) {
  let insurancePoolAccount = await tx.account.findFirst({
    where: { accountNumber: LOAN_INSURANCE_POOL_ACCOUNT },
  });

  if (insurancePoolAccount) {
    return insurancePoolAccount;
  }

  let poolType = await tx.accountType.findFirst({
    where: { name: "Loan Insurance" },
  });

  if (!poolType) {
    poolType = await tx.accountType.create({
      data: {
        name: "Loan Insurance",
        isLoanEligible: false,
        canWithdraw: false,
        interestRate: 0,
        minBalance: 0,
      },
    });
  }

  insurancePoolAccount = await tx.account.create({
    data: {
      accountNumber: LOAN_INSURANCE_POOL_ACCOUNT,
      accountTypeId: poolType.id,
      balance: 0,
      status: AccountStatus.ACTIVE,
      branchId: branchId || undefined,
    } as any,
  });

  return insurancePoolAccount;
}

async function resolveInsuranceLiabilityAccount(tx: Prisma.TransactionClient) {
  const preferred = await tx.chartOfAccount.findFirst({
    where: { accountCode: DEFAULT_INSURANCE_LIABILITY_CODE, isActive: true },
  });
  if (preferred) return preferred;

  for (const legacyCode of LEGACY_INSURANCE_LIABILITY_CODES) {
    const legacy = await tx.chartOfAccount.findFirst({
      where: { accountCode: legacyCode, isActive: true },
    });
    if (legacy) return legacy;
  }

  return tx.chartOfAccount.findFirst({
    where: {
      ledgerType: "LIABILITIES",
      OR: [
        { accountName: { equals: "Loan Insurance", mode: "insensitive" } },
      ],
      isActive: true,
    },
  });
}

async function resolveCashAssetAccount(
  tx: Prisma.TransactionClient,
  preferredCode = DEFAULT_CASH_ASSET_CODE,
) {
  return (
    (await tx.chartOfAccount.findFirst({
      where: { accountCode: preferredCode, isActive: true },
    })) ||
    (await tx.chartOfAccount.findFirst({
      where: {
        ledgerType: "ASSETS",
        OR: [
          { accountName: { contains: "cash", mode: "insensitive" } },
          { accountName: { contains: "bank", mode: "insensitive" } },
        ],
        isActive: true,
      },
    }))
  );
}

export async function recordLoanInsuranceCollection(
  input: RecordLoanInsuranceCollectionInput,
) {
  const {
    tx,
    amount,
    createdById,
    branchId,
    memberId,
    loanApplicationId,
    description,
    reference,
    entryDescription,
    createJournalEntry = false,
    debitAccountCode,
    operationalTransaction,
  } = input;

  if (amount <= 0) {
    throw new Error("Loan insurance amount must be greater than zero.");
  }

  const insurancePoolAccount = await ensureLoanInsurancePoolAccount(tx, branchId);

  await tx.account.update({
    where: { id: insurancePoolAccount.id },
    data: { balance: { increment: amount } },
  });

  if (operationalTransaction) {
    await tx.transaction.create({
      data: {
        transactionRef: operationalTransaction.transactionRef,
        memberId: operationalTransaction.memberId || undefined,
        institutionId: operationalTransaction.institutionId || undefined,
        loanId: operationalTransaction.loanId || undefined,
        accountId: insurancePoolAccount.id,
        type: "INSURANCE_PREMIUM",
        amount,
        status: "COMPLETED",
        description: operationalTransaction.description,
        processedByUserId: operationalTransaction.processedByUserId,
        channel: "SYSTEM",
      },
    });
  }

  const contribution = await tx.insuranceContribution.create({
    data: {
      amount,
      type: InsuranceContributionType.CONTRIBUTION,
      description,
      reference: reference || null,
      memberId: memberId || null,
      accountId: insurancePoolAccount.id,
      loanApplicationId: loanApplicationId || null,
      createdById,
    },
  });

  if (createJournalEntry) {
    const [insuranceLiabilityAccount, cashAssetAccount] = await Promise.all([
      resolveInsuranceLiabilityAccount(tx),
      resolveCashAssetAccount(tx, debitAccountCode),
    ]);

    if (!insuranceLiabilityAccount) {
      throw new Error(
        `Loan insurance liability account (${DEFAULT_INSURANCE_LIABILITY_CODE}) is missing or inactive.`,
      );
    }

    if (!cashAssetAccount) {
      throw new Error("Cash collection asset account for the insurance pool is missing or inactive.");
    }

    const entryNumber = `JE-INS-COLL-${Date.now()}`;
    const journalDescription = entryDescription || description;
    const journalReference = reference || contribution.id;

    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: cashAssetAccount.id,
        debitAmount: amount,
        creditAmount: 0,
        description: journalDescription,
        entryDate: new Date(),
        reference: journalReference,
        branchId: branchId || undefined,
        createdByUserId: createdById,
      },
    });

    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: insuranceLiabilityAccount.id,
        debitAmount: 0,
        creditAmount: amount,
        description: journalDescription,
        entryDate: new Date(),
        reference: journalReference,
        branchId: branchId || undefined,
        createdByUserId: createdById,
      },
    });

    await tx.chartOfAccount.update({
      where: { id: cashAssetAccount.id },
      data: {
        balance: { increment: amount },
        debitBalance: { increment: amount },
      },
    });

    await tx.chartOfAccount.update({
      where: { id: insuranceLiabilityAccount.id },
      data: {
        balance: { increment: amount },
        creditBalance: { increment: amount },
      },
    });
  }

  return {
    poolAccountId: insurancePoolAccount.id,
    contribution,
  };
}

export async function recordInsuranceSettlement(
  input: RecordInsuranceSettlementInput,
) {
  const {
    tx,
    amount,
    createdById,
    description,
    reference,
    creditAccountCode,
  } = input;

  if (amount <= 0) {
    throw new Error("Insurance settlement amount must be greater than zero.");
  }

  const insurancePoolAccount = await ensureLoanInsurancePoolAccount(tx);

  if (insurancePoolAccount.balance < amount) {
    throw new Error(
      `Insufficient insurance pool balance. Available: UGX ${insurancePoolAccount.balance.toLocaleString()}.`,
    );
  }

  const [insuranceLiabilityAccount, cashAssetAccount] = await Promise.all([
    resolveInsuranceLiabilityAccount(tx),
    resolveCashAssetAccount(tx, creditAccountCode),
  ]);

  if (!insuranceLiabilityAccount) {
    throw new Error(
      `Loan insurance liability account (${DEFAULT_INSURANCE_LIABILITY_CODE}) is missing or inactive.`,
    );
  }

  if (!cashAssetAccount) {
    throw new Error("Cash or bank asset account for insurance settlement is missing or inactive.");
  }

  const payment = await tx.insuranceContribution.create({
    data: {
      amount,
      type: InsuranceContributionType.PAYMENT_OUT,
      description,
      reference: reference || null,
      accountId: insurancePoolAccount.id,
      createdById,
    },
  });

  // Create Transaction record for audit trail (balance adjustments tracked separately)
  const transactionRef = `INS-PAYOUT-${Date.now()}`;
  await tx.transaction.create({
    data: {
      transactionRef,
      type: "FEE" as any,
      amount,
      status: "COMPLETED" as any,
      description,
      processedByUserId: createdById,
      channel: "SYSTEM",
      accountId: insurancePoolAccount.id,
    },
  });

  await tx.account.update({
    where: { id: insurancePoolAccount.id },
    data: {
      balance: {
        decrement: amount,
      },
    },
  });

  const entryNumber = `JE-INS-PAYOUT-${Date.now()}`;
  const journalReference = reference || payment.id;

  await tx.journalEntry.create({
    data: {
      entryNumber,
      accountId: insuranceLiabilityAccount.id,
      debitAmount: amount,
      creditAmount: 0,
      description,
      entryDate: new Date(),
      reference: journalReference,
      createdByUserId: createdById,
    },
  });

  await tx.journalEntry.create({
    data: {
      entryNumber,
      accountId: cashAssetAccount.id,
      debitAmount: 0,
      creditAmount: amount,
      description,
      entryDate: new Date(),
      reference: journalReference,
      createdByUserId: createdById,
    },
  });

  await tx.chartOfAccount.update({
    where: { id: insuranceLiabilityAccount.id },
    data: {
      balance: { decrement: amount },
      debitBalance: { increment: amount },
    },
  });

  await tx.chartOfAccount.update({
    where: { id: cashAssetAccount.id },
    data: {
      balance: { decrement: amount },
      creditBalance: { increment: amount },
    },
  });

  return payment;
}
