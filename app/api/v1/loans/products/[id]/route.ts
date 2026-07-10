import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";
import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { ensureIncomeStructure } from "@/lib/services/income-structure";
import { findActiveAccountByCodes } from "@/lib/accounting/coa-identity";

const STANDARD_LOAN_PENALTY_ACCOUNT_CODE = "401005";
const STANDARD_LOAN_PENALTY_ACCOUNT_NAME = "Loan penalty paid";
const STANDARD_LOAN_INTEREST_ACCOUNT_CODE = "401001";
const STANDARD_LOAN_INTEREST_ACCOUNT_NAME = "Interest paid";
const STANDARD_LOAN_FEE_ACCOUNT_CODE = "401002";
const STANDARD_LOAN_FEE_ACCOUNT_NAME = "Loan processing fees";
const STANDARD_LOAN_LEDGER_ACCOUNT_CODES = ["107000"] as const;

async function resolveStandardLoanLedgerAccount(tx: typeof db) {
  await ensureAssetStructure();
  const existingCoa = await findActiveAccountByCodes(tx, [
    ...STANDARD_LOAN_LEDGER_ACCOUNT_CODES,
  ]);

  if (existingCoa) {
    return existingCoa.id;
  }

  const sourceAccount = await tx.chartOfAccount.findFirst({
    where: { accountCode: "107000", ledgerType: "ASSETS" },
    select: { id: true, accountName: true, category: true },
  });

  if (!sourceAccount) {
    throw new Error("Loan account source (107000) is missing or inactive.");
  }

  const coa = await tx.chartOfAccount.upsert({
    where: { accountCode: "107000" },
    update: {
      accountName: sourceAccount.accountName || "Loans",
      fullCode: "107000",
      ledgerType: "ASSETS",
      debitCredit: "DR",
      isActive: true,
      category: sourceAccount.category || "Assets",
    },
    create: {
      accountCode: "107000",
      accountName: sourceAccount.accountName || "Loans",
      fullCode: "107000",
      ledgerType: "ASSETS",
      debitCredit: "DR",
      isActive: true,
      level: 2,
      category: sourceAccount.category || "Assets",
    },
    select: { id: true },
  });

  return coa.id;
}

async function resolveStandardLoanInterestAccount(tx: typeof db) {
  await ensureIncomeStructure();
  const interestIncomeItem = await tx.budgetCategory.findFirst({
    where: {
      kind: "INCOME",
      code: STANDARD_LOAN_INTEREST_ACCOUNT_CODE,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!interestIncomeItem) {
    throw new Error(
      "Interest paid income item (401001) is missing or inactive under Loan related income."
    );
  }

  const coa = await tx.chartOfAccount.upsert({
    where: { accountCode: STANDARD_LOAN_INTEREST_ACCOUNT_CODE },
    update: {
      accountName: interestIncomeItem.name || STANDARD_LOAN_INTEREST_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_INTEREST_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_INTEREST_ACCOUNT_CODE}`,
    },
    create: {
      accountCode: STANDARD_LOAN_INTEREST_ACCOUNT_CODE,
      accountName: interestIncomeItem.name || STANDARD_LOAN_INTEREST_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_INTEREST_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_INTEREST_ACCOUNT_CODE}`,
    },
    select: { id: true },
  });

  return coa.id;
}

async function resolveStandardLoanFeeAccount(tx: typeof db) {
  await ensureIncomeStructure();
  const feeIncomeItem = await tx.budgetCategory.findFirst({
    where: {
      kind: "INCOME",
      code: STANDARD_LOAN_FEE_ACCOUNT_CODE,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!feeIncomeItem) {
    throw new Error(
      "Loan processing fees income item (401002) is missing or inactive under Loan related income."
    );
  }

  const coa = await tx.chartOfAccount.upsert({
    where: { accountCode: STANDARD_LOAN_FEE_ACCOUNT_CODE },
    update: {
      accountName: feeIncomeItem.name || STANDARD_LOAN_FEE_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_FEE_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_FEE_ACCOUNT_CODE}`,
    },
    create: {
      accountCode: STANDARD_LOAN_FEE_ACCOUNT_CODE,
      accountName: feeIncomeItem.name || STANDARD_LOAN_FEE_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_FEE_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_FEE_ACCOUNT_CODE}`,
    },
    select: { id: true },
  });

  return coa.id;
}

async function resolveStandardLoanPenaltyAccount(tx: typeof db) {
  await ensureIncomeStructure();
  const penaltyIncomeItem = await tx.budgetCategory.findFirst({
    where: {
      kind: "INCOME",
      code: STANDARD_LOAN_PENALTY_ACCOUNT_CODE,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!penaltyIncomeItem) {
    throw new Error(
      "Loan penalty paid income item (401005) is missing or inactive under Loan related income."
    );
  }

  const coa = await tx.chartOfAccount.upsert({
    where: { accountCode: STANDARD_LOAN_PENALTY_ACCOUNT_CODE },
    update: {
      accountName: penaltyIncomeItem.name || STANDARD_LOAN_PENALTY_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_PENALTY_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_PENALTY_ACCOUNT_CODE}`,
    },
    create: {
      accountCode: STANDARD_LOAN_PENALTY_ACCOUNT_CODE,
      accountName: penaltyIncomeItem.name || STANDARD_LOAN_PENALTY_ACCOUNT_NAME,
      fullCode: STANDARD_LOAN_PENALTY_ACCOUNT_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: `Synced from income item ${STANDARD_LOAN_PENALTY_ACCOUNT_CODE}`,
    },
    select: { id: true },
  });

  return coa.id;
}

const loanProductUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  interestRate: z.number().min(0).max(300).optional(),
  repaymentPeriodDays: z.number().int().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).optional(),
  ledgerAccountId: z.string().optional().nullable(),
  interestAccountId: z.string().optional().nullable(),
  penaltyAccountId: z.string().optional().nullable(),
  feeAccountId: z.string().optional().nullable(),
  interestPeriod: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
    });

    if (!loanProduct) {
      return NextResponse.json(
        { error: "Loan product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(loanProduct);
  } catch (error) {
    console.error("Error fetching loan product:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan product" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const body = await request.json();
    const validation = loanProductUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate limit consistency if both provided
    if (
      data.minAmount !== undefined &&
      data.maxAmount !== undefined &&
      data.maxAmount <= data.minAmount
    ) {
      return NextResponse.json(
        { error: "Maximum amount must be greater than minimum amount" },
        { status: 400 }
      );
    }

    // Check unique name if updated
    if (data.name) {
      const existingProduct = await db.loanProduct.findFirst({
        where: {
          name: data.name,
          id: { not: params.id },
        },
      });

      if (existingProduct) {
        return NextResponse.json(
          { error: "A loan product with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Check existing limits if updating only one
    if (data.minAmount !== undefined || data.maxAmount !== undefined) {
       const currentProduct = await db.loanProduct.findUnique({ where: { id: params.id }});
       if (currentProduct) {
           const newMin = data.minAmount ?? currentProduct.minAmount;
           const newMax = data.maxAmount ?? currentProduct.maxAmount;
           if (newMax <= newMin) {
               return NextResponse.json(
                   { error: "Maximum amount must be greater than minimum amount" },
                   { status: 400 }
               );
           }
       }
    }

    let standardLedgerAccountId: string;
    let standardInterestAccountId: string;
    let standardFeeAccountId: string;
    let standardPenaltyAccountId: string;
    try {
      standardLedgerAccountId = await resolveStandardLoanLedgerAccount(db);
      standardInterestAccountId = await resolveStandardLoanInterestAccount(db);
      standardFeeAccountId = await resolveStandardLoanFeeAccount(db);
      standardPenaltyAccountId = await resolveStandardLoanPenaltyAccount(db);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Loan penalty income item (401005) is not configured.",
        },
        { status: 400 }
      );
    }

    const updatedProduct = await db.loanProduct.update({
      where: { id: params.id },
      data: {
        ...data,
        ledgerAccountId: standardLedgerAccountId,
        interestAccountId: standardInterestAccountId,
        feeAccountId: standardFeeAccountId,
        penaltyAccountId: standardPenaltyAccountId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("Error updating loan product:", error);
    return NextResponse.json(
      { error: "Failed to update loan product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    
    // Check dependencies
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
    });

    if (!loanProduct) {
      return NextResponse.json(
        { error: "Loan product not found" },
        { status: 404 }
      );
    }

    if (loanProduct._count.loanApplications > 0) {
      return NextResponse.json(
        { error: `Cannot delete loan product. It has ${loanProduct._count.loanApplications} associated loan applications.` },
        { status: 409 }
      );
    }

    await db.loanProduct.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Loan product deleted successfully" });
  } catch (error) {
    console.error("Error deleting loan product:", error);
    return NextResponse.json(
      { error: "Failed to delete loan product" },
      { status: 500 }
    );
  }
}
