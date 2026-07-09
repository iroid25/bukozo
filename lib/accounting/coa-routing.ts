export type CoaTargetCategory = "ASSETS" | "LIABILITIES" | "INCOME" | "EXPENDITURES";

export type CoaSourceRule = {
  source: string;
  targetCategory: CoaTargetCategory;
  targetAccounts: string[];
  allowInCoa: boolean;
  notes: string;
};

export const ALLOWED_COA_CATEGORIES: CoaTargetCategory[] = [
  "ASSETS",
  "LIABILITIES",
  "INCOME",
  "EXPENDITURES",
];

export const ALLOWED_COA_PREFIXES = [
  "100",
  "101",
  "102",
  "107",
  "200",
  "201",
  "202",
  "400",
  "401",
  "500",
  "501",
  "502",
  "503",
  "504",
  "505",
  "506",
];

export const COA_SOURCE_RULES: CoaSourceRule[] = [
  {
    source: "app/api/v1/journal-entries/auto/income",
    targetCategory: "ASSETS",
    targetAccounts: ["102001"],
    allowInCoa: true,
    notes: "Debit cash/bank and credit the first valid income account.",
  },
  {
    source: "app/api/v1/journal-entries/auto/expenditure",
    targetCategory: "EXPENDITURES",
    targetAccounts: ["102001"],
    allowInCoa: true,
    notes: "Debit expenditure and credit cash/bank.",
  },
  {
    source: "app/api/v1/journal-entries/auto/loan-disbursement",
    targetCategory: "ASSETS",
    targetAccounts: ["107000", "102001"],
    allowInCoa: true,
    notes: "Loan receivable and cash are the only COA targets.",
  },
  {
    source: "app/api/v1/journal-entries/auto/loan-repayment",
    targetCategory: "ASSETS",
    targetAccounts: ["107000", "102001"],
    allowInCoa: true,
    notes: "Principal reverses the loan asset and increases cash; interest and penalty are posted to loan-related income.",
  },
  {
    source: "app/api/v1/loans/products",
    targetCategory: "INCOME",
    targetAccounts: ["401001", "401002", "401005", "107000"],
    allowInCoa: true,
    notes: "Loan product setup only uses standardized COA links.",
  },
  {
    source: "app/api/v1/liabilities",
    targetCategory: "LIABILITIES",
    targetAccounts: ["201000", "202000", "201001", "201002", "201003", "201004", "200600", "202001", "202002"],
    allowInCoa: true,
    notes: "Liability creation must stay inside the liabilities family.",
  },
  {
    source: "app/api/v1/accounts/assets/create",
    targetCategory: "ASSETS",
    targetAccounts: ["100000", "101000", "102000", "103000", "104000", "105000", "106000", "107000"],
    allowInCoa: true,
    notes: "Asset child accounts only.",
  },
  {
    source: "app/api/v1/accounts/liabilities/create",
    targetCategory: "LIABILITIES",
    targetAccounts: ["200000", "201000", "202000"],
    allowInCoa: true,
    notes: "Liability child accounts only.",
  },
  {
    source: "app/api/v1/accounts/expenditures/create",
    targetCategory: "EXPENDITURES",
    targetAccounts: ["500000", "501000", "502000", "503000", "504000", "505000", "506000"],
    allowInCoa: true,
    notes: "Expenditure child accounts only.",
  },
  {
    source: "app/api/v1/reports/shares/share-capital-remittances",
    targetCategory: "LIABILITIES",
    targetAccounts: ["304000", "304001", "304002", "304003"],
    allowInCoa: false,
    notes: "Report source only; do not create ad hoc COA rows from the report.",
  },
];

export function isAllowedCoaCategory(category: string) {
  return ALLOWED_COA_CATEGORIES.includes(category as CoaTargetCategory);
}

export function getSourceRule(source: string) {
  return COA_SOURCE_RULES.find((rule) => rule.source === source) || null;
}
