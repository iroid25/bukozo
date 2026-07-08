import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";

const STANDARD_LOAN_PENALTY_ACCOUNT_CODE = "401005";
const STANDARD_LOAN_PENALTY_ACCOUNT_NAME = "Loan penalty paid";
const STANDARD_LOAN_INTEREST_ACCOUNT_CODE = "401001";
const STANDARD_LOAN_INTEREST_ACCOUNT_NAME = "Interest paid";
const STANDARD_LOAN_FEE_ACCOUNT_CODE = "401002";
const STANDARD_LOAN_FEE_ACCOUNT_NAME = "Loan processing fees";
const STANDARD_LOAN_LEDGER_ACCOUNT_CODES = ["107000", "102003"] as const;

async function resolveStandardLoanLedgerAccount(tx: typeof db) {
  for (const accountCode of STANDARD_LOAN_LEDGER_ACCOUNT_CODES) {
    const existingCoa = await tx.chartOfAccount.findUnique({
      where: { accountCode },
      select: { id: true, isActive: true },
    });

    if (existingCoa?.isActive) {
      return existingCoa.id;
    }
  }

  throw new Error(
    "Loan portfolio account (107000 or 102003) is missing or inactive."
  );
}

async function resolveStandardLoanInterestAccount(tx: typeof db) {
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

  const existingCoa = await tx.chartOfAccount.findUnique({
    where: { accountCode: STANDARD_LOAN_INTEREST_ACCOUNT_CODE },
    select: { id: true, isActive: true },
  });

  if (existingCoa?.isActive) {
    return existingCoa.id;
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

  const existingCoa = await tx.chartOfAccount.findUnique({
    where: { accountCode: STANDARD_LOAN_FEE_ACCOUNT_CODE },
    select: { id: true, isActive: true },
  });

  if (existingCoa?.isActive) {
    return existingCoa.id;
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

  const existingCoa = await tx.chartOfAccount.findUnique({
    where: { accountCode: STANDARD_LOAN_PENALTY_ACCOUNT_CODE },
    select: { id: true, isActive: true },
  });

  if (existingCoa?.isActive) {
    return existingCoa.id;
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

const loanProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  minAmount: z.number().min(0, "Minimum amount must be positive"),
  maxAmount: z.number().min(0, "Maximum amount must be positive"),
  interestRate: z
    .number()
    .min(0, "Interest rate must be positive")
    .max(300, "Interest rate cannot exceed 300%"),
  repaymentPeriodDays: z
    .number()
    .int()
    .min(1, "Repayment period must be at least 1 day"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).default("FLAT_RATE"),
  ledgerAccountId: z.string().optional().nullable(),
  interestAccountId: z.string().optional().nullable(),
  penaltyAccountId: z.string().optional().nullable(),
  feeAccountId: z.string().optional().nullable(),
  interestPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

export async function GET() {
  try {
    const loanProducts = await db.loanProduct.findMany({
      select: {
        id: true,
        name: true,
        minAmount: true,
        maxAmount: true,
        interestRate: true,
        repaymentPeriodDays: true,
        interestType: true,
        description: true,
        isActive: true, // Included isActive to match action logic
        ledgerAccountId: true,
        interestAccountId: true,
        penaltyAccountId: true,
        feeAccountId: true,
        interestPeriod: true,
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(loanProducts);
  } catch (error) {
    console.error("Error fetching loan products:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check (Admin/Manager only?) - Assuming Admin/Manager
    // if (!["ADMIN", "MANAGER", "ACCOUNTANT", "BRANCHMANAGER"].includes(session.user.role)) { ... } 
    // For now, leaving open to authenticated users similar to action, or restrict?
    // The action `actions/loanProduct.ts` didn't have explicit role check inside, but usually protected by middleware or page.
    
    const body = await request.json();
    console.log("[API] Creating loan product. Body:", JSON.stringify(body, null, 2));

    const validation = loanProductSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate limit consistency
    if (data.maxAmount <= data.minAmount) {
      return NextResponse.json(
        { error: "Maximum amount must be greater than minimum amount" },
        { status: 400 }
      );
    }

    // Check unique name
    const existingProduct = await db.loanProduct.findFirst({
      where: { name: data.name },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: "A loan product with this name already exists" },
        { status: 409 }
      );
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

    const newProduct = await db.loanProduct.create({
      data: {
        ...data,
        description: data.description || null,
        ledgerAccountId: standardLedgerAccountId,
        interestAccountId: standardInterestAccountId,
        feeAccountId: standardFeeAccountId,
        penaltyAccountId: standardPenaltyAccountId,
      },
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error("Error creating loan product:", error);
    return NextResponse.json(
      { error: "Failed to create loan product" },
      { status: 500 }
    );
  }
}
