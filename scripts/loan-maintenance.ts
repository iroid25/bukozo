import { db } from "../prisma/db";

export type LoanMaintenanceTarget = {
  label: string;
  snapshot: () => Promise<any[]>;
  purge: () => Promise<{ count: number }>;
};

export const loanMaintenanceTargets: LoanMaintenanceTarget[] = [
  {
    label: "InsuranceContribution (loan applications only)",
    snapshot: () =>
      db.insuranceContribution.findMany({
        where: { loanApplicationId: { not: null } },
      }),
    purge: () =>
      db.insuranceContribution.deleteMany({
        where: { loanApplicationId: { not: null } },
      }),
  },
  {
    label: "AccountHold (loan-linked holds only)",
    snapshot: () =>
      db.accountHold.findMany({
        where: { loanId: { not: null } },
      }),
    purge: () =>
      db.accountHold.deleteMany({
        where: { loanId: { not: null } },
      }),
  },
  {
    label: "LoanRepaymentSchedule",
    snapshot: () => db.loanRepaymentSchedule.findMany(),
    purge: () => db.loanRepaymentSchedule.deleteMany(),
  },
  {
    label: "LoanRepayment",
    snapshot: () => db.loanRepayment.findMany(),
    purge: () => db.loanRepayment.deleteMany(),
  },
  {
    label: "LoanRepaymentRequest",
    snapshot: () => db.loanRepaymentRequest.findMany(),
    purge: () => db.loanRepaymentRequest.deleteMany(),
  },
  {
    label: "LoanWriteOff",
    snapshot: () => db.loanWriteOff.findMany(),
    purge: () => db.loanWriteOff.deleteMany(),
  },
  {
    label: "LoanReschedule",
    snapshot: () => db.loanReschedule.findMany(),
    purge: () => db.loanReschedule.deleteMany(),
  },
  {
    label: "LoanLedgerTransaction",
    snapshot: () => db.loanLedgerTransaction.findMany(),
    purge: () => db.loanLedgerTransaction.deleteMany(),
  },
  {
    label: "LoanAppeal",
    snapshot: () => db.loanAppeal.findMany(),
    purge: () => db.loanAppeal.deleteMany(),
  },
  {
    label: "Loan",
    snapshot: () => db.loan.findMany(),
    purge: () => db.loan.deleteMany(),
  },
  {
    label: "LoanApplication",
    snapshot: () => db.loanApplication.findMany(),
    purge: () => db.loanApplication.deleteMany(),
  },
  {
    label: "InstitutionLoanRepaymentSchedule",
    snapshot: () => db.institutionLoanRepaymentSchedule.findMany(),
    purge: () => db.institutionLoanRepaymentSchedule.deleteMany(),
  },
  {
    label: "InstitutionLoanRepayment",
    snapshot: () => db.institutionLoanRepayment.findMany(),
    purge: () => db.institutionLoanRepayment.deleteMany(),
  },
  {
    label: "InstitutionLoanLedgerTransaction",
    snapshot: () => db.institutionLoanLedgerTransaction.findMany(),
    purge: () => db.institutionLoanLedgerTransaction.deleteMany(),
  },
  {
    label: "InstitutionLoan",
    snapshot: () => db.institutionLoan.findMany(),
    purge: () => db.institutionLoan.deleteMany(),
  },
  {
    label: "InstitutionLoanApplication",
    snapshot: () => db.institutionLoanApplication.findMany(),
    purge: () => db.institutionLoanApplication.deleteMany(),
  },
];

export function getLoanMaintenanceSummary() {
  return loanMaintenanceTargets.map((target) => target.label);
}
