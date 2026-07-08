// services/loan-migration.service.ts
import { db } from "@/prisma/db";
import { calculateLoanSchedule } from "@/lib/loan-calculations";
import { LoanStatus, LoanStage } from "@prisma/client";

export interface MigrationRow {
  rowNum?: number;
  memberId: string;
  memberNumber?: string;
  loanProductId: string;
  amountGranted: number;
  outstandingBalance: number;
  dateDisbursed: string;
  repaymentPeriodMonths: number;
  interestRate: number;
  notes?: string;
  interestPeriod?: "MONTHLY" | "ANNUAL";
  
  // Breakdown (optional)
  principleAmount?: number;
  interestAmount?: number;
  penaltiesAmount?: number;
  currentPeriodMonths?: number;

  // Collateral (optional)
  collateralType?: string;
  collateralValue?: number;
  collateralLocation?: string;
  collateralDetails?: string;
  forcedSaleValue?: number;

  // Guarantors (optional)
  guarantors?: Array<{
    name: string;
    memberNumber: string;
    memberId: string;
  }>;
}

export class LoanMigrationService {
  static async migrateSingleLoan(row: MigrationRow, officerId: string, branchId?: string) {
    return await db.$transaction(async (tx) => {
        // 1. Validate Product
        const product = await tx.loanProduct.findUnique({
            where: { id: row.loanProductId }
        });
        if (!product) throw new Error(`Product not found for row ${row.rowNum || ''}`);

        // 2. Validate Member
        const member = await tx.member.findUnique({
            where: { id: row.memberId },
            include: { user: true }
        });
        if (!member) throw new Error(`Member not found for row ${row.rowNum || ''}`);

        const effectiveBranchId = branchId || member.user?.branchId;
        if (!effectiveBranchId) throw new Error(`Branch ID could not be determined for member ${member.memberNumber}`);

        // 3. Prepare Data
        const dateDisbursed = new Date(row.dateDisbursed);
        const interestPeriod = row.interestPeriod || product.interestPeriod || "ANNUAL";
        
        // Calculate Total Interest and Due Date
        let totalInterest = 0;
        const rate = row.interestRate;
        const principal = row.amountGranted;
        const periods = row.repaymentPeriodMonths;

        if (interestPeriod === "ANNUAL") {
            totalInterest = principal * (rate / 100) * (periods / 12);
        } else {
            totalInterest = principal * (rate / 100) * periods;
        }

        const totalAmountDue = principal + totalInterest;
        const amountPaid = totalAmountDue - row.outstandingBalance;

        const dueDate = new Date(dateDisbursed);
        dueDate.setMonth(dueDate.getMonth() + periods);

        // 4. Create Loan Application (Bypassing workflow)
        const application = await tx.loanApplication.create({
            data: {
                memberId: row.memberId,
                loanProductId: row.loanProductId,
                amountApplied: principal,
                approvedAmount: principal,
                applicationDate: dateDisbursed,
                purpose: "Legacy Migration",
                status: row.outstandingBalance <= 0 ? LoanStatus.REPAID : LoanStatus.DISBURSED,
                stage: LoanStage.DISBURSED,
                applicantId: officerId,
                approverId: officerId,
                loanOfficerId: officerId,
                approvalDate: dateDisbursed,
                submittedAt: dateDisbursed,
                disbursedAt: dateDisbursed,
                repaymentPeriodMonths: periods,
                interestRateOverride: rate,
                interestPeriod: interestPeriod as any,
                decisionNotes: row.notes ? `Migration: ${row.notes}` : "Imported from Legacy System",
                
                // Collateral
                collateralType: row.collateralType,
                collateralValue: row.collateralValue,
                collateralLocation: row.collateralLocation,
                collateralDetails: row.collateralDetails,
                forcedSaleValue: row.forcedSaleValue,
                
                // Guarantors
                guarantors: row.guarantors as any,
            },
        });

        // 5. Create Loan Record
        const loan = await tx.loan.create({
            data: {
                loanApplicationId: application.id,
                memberId: row.memberId,
                amountGranted: principal,
                interestRate: rate,
                interestPeriod: interestPeriod as any,
                interestAmount: totalInterest,
                totalAmountDue: totalAmountDue,
                outstandingBalance: row.outstandingBalance,
                amountPaid: Math.max(0, amountPaid),
                principalPaid: Math.max(0, amountPaid - totalInterest), // Rough estimate for ledger
                interestPaid: Math.min(amountPaid, totalInterest), // Rough estimate for ledger
                disbursementDate: dateDisbursed,
                dueDate: dueDate,
                status: row.outstandingBalance <= 0 ? LoanStatus.REPAID : LoanStatus.DISBURSED,
                disbursedByUserId: officerId,
                allocatedTellerId: officerId,
                branchId: effectiveBranchId,
                interestType: product.interestType,
            },
        });

        // 6. Generate and Save Repayment Schedules
        const result = calculateLoanSchedule({
            amountGranted: principal,
            interestRate: rate,
            repaymentPeriodMonths: periods,
            disbursementDate: dateDisbursed,
            interestType: product.interestType,
            interestPeriod: interestPeriod as any,
            gracePeriod: 0
        });
        const schedules = result.schedule;

        if (schedules && schedules.length > 0) {
            // Adjust schedules based on balance
            // If already partially paid, we mark older schedules as PAID
            let runningPaid = amountPaid;
            const schedulesToCreate = schedules.map(s => {
                const isPaid = runningPaid >= s.totalPayment;
                const paidAmount = isPaid ? s.totalPayment : Math.max(0, runningPaid);
                runningPaid -= paidAmount;
                
                return {
                    loanId: loan.id,
                    period: s.period,
                    dueDate: s.dueDate,
                    principalPayment: s.principalPayment,
                    interestPayment: s.interestPayment,
                    totalPayment: s.totalPayment,
                    remainingBalance: s.remainingBalance,
                    paidAmount: paidAmount,
                    status: isPaid ? "PAID" : (paidAmount > 0 ? "PARTIAL" : "PENDING")
                };
            });

            await tx.loanRepaymentSchedule.createMany({
                data: schedulesToCreate
            });
        }

        // 7. Initial Accounting (Loan Ledger & GL)
        // Set opening balance in ledger
        await tx.loanLedgerTransaction.create({
            data: {
                loanId: loan.id,
                transactionType: "DISBURSEMENT",
                transactionDate: dateDisbursed,
                voucherNo: `MIG-${loan.id.substring(0, 5).toUpperCase()}`,
                debitPrincipal: principal,
                debitInterest: totalInterest,
                creditPrincipal: 0,
                creditInterest: 0,
                balancePrincipal: principal,
                balanceInterest: totalInterest,
                balanceTotal: totalAmountDue,
            }
        });

        // If partially paid, record repayments in ledger too
        if (amountPaid > 0) {
            await tx.loanLedgerTransaction.create({
                data: {
                    loanId: loan.id,
                    transactionType: "REPAYMENT",
                    transactionDate: dateDisbursed,
                    voucherNo: `MIG-ADJ`,
                    debitPrincipal: 0,
                    debitInterest: 0,
                    creditPrincipal: Math.max(0, amountPaid - totalInterest),
                    creditInterest: Math.min(amountPaid, totalInterest),
                    balancePrincipal: principal - Math.max(0, amountPaid - totalInterest),
                    balanceInterest: totalInterest - Math.min(amountPaid, totalInterest),
                    balanceTotal: row.outstandingBalance,
                }
            });
        }

        // 8. GL Journal Entries for Migration Opening Balance
        const { createMigrationOpeningBalanceEntry } = await import("@/lib/journal-entries-extended");
        await createMigrationOpeningBalanceEntry({
            loanId: loan.id,
            memberId: row.memberId,
            branchId: effectiveBranchId,
            principal: principal,
            outstandingBalance: row.outstandingBalance,
            interestDue: totalInterest,
            ledgerAccountId: product.ledgerAccountId || undefined,
            interestAccountId: product.interestAccountId || undefined,
            officerId: officerId,
            description: `Legacy migration opening balance for loan ${loan.id.substring(0, 8)}`,
            date: dateDisbursed,
            entryDate: dateDisbursed
        }, tx);

        return loan;
    });
  }
}
