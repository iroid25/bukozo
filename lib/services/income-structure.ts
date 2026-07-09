import { db } from "../../prisma/db.ts";

export const INCOME_ROOT_CODE = "400000";
export const LOAN_RELATED_INCOME_CODE = "401000";
export const LOAN_INTEREST_PAID_CODE = "401001";
export const LOAN_PROCESSING_FEES_CODE = "401002";
export const INVESTMENT_INTEREST_CODE = "401004";
export const LOAN_PENALTY_PAID_CODE = "401005";
export const LEGACY_PENALTY_INCOME_CODE = "401300";
export const SALES_INCOME_CODE = "402000";
export const COMMISSION_INCOME_CODE = "403000";
export const SERVICES_INCOME_CODE = "404000";
export const FEE_INCOME_CODE = "405000";
export const WITHDRAWAL_FEE_CODE = "405001";
export const DEPOSIT_FEE_CODE = "405002";
export const MONTHLY_FEE_CHARGED_CODE = "405003";
export const MONTHLY_FEE_CHARGED_NAME = "Monthly fee charged";
export const DORMANCY_PENALTY_CODE = "405004";
export const DORMANCY_PENALTY_NAME = "Dormancy penalty charged";

type IncomeSeedNode = {
  name: string;
  code: string;
  parentCode?: string | null;
  description?: string;
};

const incomeNodes: IncomeSeedNode[] = [
  {
    name: "Income",
    code: INCOME_ROOT_CODE,
    description: "Top-level income account group",
  },
  {
    name: "Loan related income",
    code: LOAN_RELATED_INCOME_CODE,
    parentCode: INCOME_ROOT_CODE,
    description: "Income earned from loan repayments",
  },
  {
    name: "Interest paid",
    code: LOAN_INTEREST_PAID_CODE,
    parentCode: LOAN_RELATED_INCOME_CODE,
    description: "Interest income collected from loan repayments",
  },
  {
    name: "Loan penalty paid",
    code: LOAN_PENALTY_PAID_CODE,
    parentCode: LOAN_RELATED_INCOME_CODE,
    description: "Penalty income collected from overdue loans",
  },
  {
    name: "Loan processing fees",
    code: LOAN_PROCESSING_FEES_CODE,
    parentCode: LOAN_RELATED_INCOME_CODE,
    description: "Fees collected for loan processing",
  },
  {
    name: "Interest from savings",
    code: "401003",
    parentCode: INCOME_ROOT_CODE,
  },
  {
    name: "Interest from Investment",
    code: INVESTMENT_INTEREST_CODE,
    parentCode: INCOME_ROOT_CODE,
  },
  {
    name: "Sales income",
    code: SALES_INCOME_CODE,
    parentCode: INCOME_ROOT_CODE,
  },
  {
    name: "Hardware income",
    code: "402001",
    parentCode: SALES_INCOME_CODE,
  },
  {
    name: "Sale of land",
    code: "402002",
    parentCode: SALES_INCOME_CODE,
  },
  {
    name: "Sale of old motorcycle",
    code: "402003",
    parentCode: SALES_INCOME_CODE,
  },
  {
    name: "Sale of trees",
    code: "402004",
    parentCode: SALES_INCOME_CODE,
  },
  {
    name: "Commission income",
    code: COMMISSION_INCOME_CODE,
    parentCode: INCOME_ROOT_CODE,
  },
  {
    name: "Services income",
    code: SERVICES_INCOME_CODE,
    parentCode: INCOME_ROOT_CODE,
  },
  {
    name: "Hire of land",
    code: "404001",
    parentCode: SERVICES_INCOME_CODE,
  },
  {
    name: "Fee income",
    code: FEE_INCOME_CODE,
    parentCode: INCOME_ROOT_CODE,
    description: "Income from service and transaction fees",
  },
  {
    name: "Withdrawal fee charged",
    code: WITHDRAWAL_FEE_CODE,
    parentCode: FEE_INCOME_CODE,
    description: "Fees charged when processing withdrawals",
  },
  {
    name: "Deposit fee charged",
    code: DEPOSIT_FEE_CODE,
    parentCode: FEE_INCOME_CODE,
    description: "Fees charged when processing deposits",
  },
  {
    name: MONTHLY_FEE_CHARGED_NAME,
    code: MONTHLY_FEE_CHARGED_CODE,
    parentCode: FEE_INCOME_CODE,
    description: "Fees charged monthly on savings accounts",
  },
  {
    name: DORMANCY_PENALTY_NAME,
    code: DORMANCY_PENALTY_CODE,
    parentCode: FEE_INCOME_CODE,
    description: "Penalties charged when dormant accounts are reactivated",
  },
];

async function ensureBudgetCategory(node: IncomeSeedNode, parentId: string | null) {
  return db.budgetCategory.upsert({
    where: { code: node.code },
    update: {
      name: node.name,
      kind: "INCOME",
      description: node.description || null,
      isActive: true,
      parentId,
    },
    create: {
      name: node.name,
      code: node.code,
      kind: "INCOME",
      description: node.description || null,
      isActive: true,
      parentId,
    },
  });
}

async function ensureChartAccount(
  node: IncomeSeedNode,
  parentId: string | null,
  level: number,
) {
  return db.chartOfAccount.upsert({
    where: { accountCode: node.code },
    update: {
      accountName: node.name,
      fullCode: node.code,
      parentId,
      level,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      category: "INCOME",
      description: node.description || null,
    },
    create: {
      accountCode: node.code,
      accountName: node.name,
      fullCode: node.code,
      parentId,
      level,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      category: "INCOME",
      description: node.description || null,
    },
  });
}

export async function ensureIncomeStructure() {
  const budgetCategoryMap = new Map<string, string>();
  const coaMap = new Map<string, string>();

  for (const node of incomeNodes) {
    const parentCode = node.parentCode || null;
    const parentBudgetId = parentCode ? budgetCategoryMap.get(parentCode) || null : null;
    const parentCoaId = parentCode ? coaMap.get(parentCode) || null : null;
    const level = parentCode === null ? 0 : parentCode === INCOME_ROOT_CODE ? 1 : 2;

    const category = await ensureBudgetCategory(node, parentBudgetId);
    budgetCategoryMap.set(node.code, category.id);

    const coa = await ensureChartAccount(node, parentCoaId, level);
    coaMap.set(node.code, coa.id);
  }

  const duplicateLoanApplicationFeeAccount = await db.chartOfAccount.findUnique({
    where: { accountCode: "401006" },
    select: { id: true, isActive: true },
  });

  if (duplicateLoanApplicationFeeAccount?.isActive) {
    await db.chartOfAccount.update({
      where: { id: duplicateLoanApplicationFeeAccount.id },
      data: { isActive: false },
    });
  }

  const duplicateLoanApplicationFeeCategory = await db.budgetCategory.findUnique({
    where: { code: "401006" },
    select: { id: true, isActive: true },
  });

  if (duplicateLoanApplicationFeeCategory?.isActive) {
    await db.budgetCategory.update({
      where: { id: duplicateLoanApplicationFeeCategory.id },
      data: { isActive: false },
    });
  }

  const legacyPenaltyAccount = await db.chartOfAccount.findUnique({
    where: { accountCode: LEGACY_PENALTY_INCOME_CODE },
    select: { id: true, isActive: true },
  });

  if (legacyPenaltyAccount?.isActive) {
    await db.chartOfAccount.update({
      where: { id: legacyPenaltyAccount.id },
      data: { isActive: false },
    });
  }

  const legacyPenaltyCategory = await db.budgetCategory.findUnique({
    where: { code: LEGACY_PENALTY_INCOME_CODE },
    select: { id: true, isActive: true },
  });

  if (legacyPenaltyCategory?.isActive) {
    await db.budgetCategory.update({
      where: { id: legacyPenaltyCategory.id },
      data: { isActive: false },
    });
  }

  return {
    rootCode: INCOME_ROOT_CODE,
    nodes: incomeNodes,
  };
}
