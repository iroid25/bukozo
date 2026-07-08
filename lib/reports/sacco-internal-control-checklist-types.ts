export type SaccoChecklistStatus = "PENDING" | "PASS" | "FAIL" | "PARTIAL" | "NA";

export interface SaccoInternalControlChecklistTemplateItem {
  itemCode: string;
  itemLabel: string;
  controlArea: string;
  guidance: string;
}

export interface SaccoInternalControlChecklistRecord extends SaccoInternalControlChecklistTemplateItem {
  id: string | null;
  branchId: string;
  branchName: string;
  periodKey: string;
  status: SaccoChecklistStatus;
  remarks: string;
  evidence: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface SaccoInternalControlChecklistSummary {
  totalItems: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  naCount: number;
  pendingCount: number;
  completionRate: number;
}

export interface SaccoInternalControlChecklistFilters {
  branchId?: string;
  periodKey?: string;
}

export const SACCO_INTERNAL_CONTROL_CHECKLIST_TEMPLATE: SaccoInternalControlChecklistTemplateItem[] = [
  {
    itemCode: "CTRL-01",
    itemLabel: "Member onboarding documents are complete",
    controlArea: "Member Records",
    guidance: "Verify KYC, approval evidence, and signature completeness.",
  },
  {
    itemCode: "CTRL-02",
    itemLabel: "Branch cash and vault balances are reconciled",
    controlArea: "Cash Management",
    guidance: "Compare system balances with physical cash and branch floats.",
  },
  {
    itemCode: "CTRL-03",
    itemLabel: "Deposits and withdrawals are posted on time",
    controlArea: "Transactions",
    guidance: "Check that all same-day transactions have source evidence.",
  },
  {
    itemCode: "CTRL-04",
    itemLabel: "Loan approvals follow delegation limits",
    controlArea: "Credit Controls",
    guidance: "Confirm authorisations align with policy and approval matrix.",
  },
  {
    itemCode: "CTRL-05",
    itemLabel: "Loan disbursements match approved schedules",
    controlArea: "Credit Controls",
    guidance: "Verify disbursement dates, amounts, and supporting documents.",
  },
  {
    itemCode: "CTRL-06",
    itemLabel: "Repayments are allocated correctly",
    controlArea: "Loan Portfolio",
    guidance: "Confirm principal, interest, and penalties are posted correctly.",
  },
  {
    itemCode: "CTRL-07",
    itemLabel: "Suspense and clearing items are reviewed",
    controlArea: "Accounts Review",
    guidance: "Escalate unreconciled items and document follow-up actions.",
  },
  {
    itemCode: "CTRL-08",
    itemLabel: "Branch user access rights are current",
    controlArea: "Access Control",
    guidance: "Review teller, officer, and manager permissions periodically.",
  },
  {
    itemCode: "CTRL-09",
    itemLabel: "Audit trail entries are intact",
    controlArea: "System Integrity",
    guidance: "Check that critical edits and reversals are traceable.",
  },
  {
    itemCode: "CTRL-10",
    itemLabel: "Exception register is maintained",
    controlArea: "Governance",
    guidance: "Track exceptions, approvals, and remediation status.",
  },
  {
    itemCode: "CTRL-11",
    itemLabel: "Branch reports are filed and signed",
    controlArea: "Reporting",
    guidance: "Ensure mandatory reports are completed and signed off.",
  },
  {
    itemCode: "CTRL-12",
    itemLabel: "Outstanding issues are escalated to management",
    controlArea: "Governance",
    guidance: "Verify open findings have owners and deadlines.",
  },
];

export const EMPTY_SACCO_INTERNAL_CONTROL_CHECKLIST_SUMMARY: SaccoInternalControlChecklistSummary =
  {
    totalItems: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    naCount: 0,
    pendingCount: 0,
    completionRate: 0,
  };
