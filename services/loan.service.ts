import { db } from "@/prisma/db";
// RECOMPILE TRIGGER: 2026-02-24T15:59:28+03:00
import {
  LoanStatus,
  LoanStage,
  TransactionType,
  TransactionStatus,
  UserRole,
  AccountStatus,
  Prisma,
  InsuranceContributionType,
} from "@prisma/client";
import {
  calculateLoanSchedule,
  type ScheduleFrequency,
} from "@/lib/loan-calculations";
import {
  calculateCompoundingPenalty,
  PenaltyTier,
  calculateSimplePenaltyEstimation,
} from "@/lib/penalty-calculations";
import { DEFAULT_PENALTY_TIERS } from "@/config/fees";
import { sendLoanApprovalEmail, sendTransactionAlertEmail } from "@/lib/email";
import { recordLoanInsuranceCollection } from "@/lib/services/loanInsurance";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { RelworxService } from "./relworx.service";
import {
  resolveAssociateShareAccountType,
  resolveShareCapitalAccount,
} from "@/lib/services/equity-structure";
import { createLoanPenaltyAccrualJournalEntry } from "@/lib/journal-entries";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

function buildRemainingScheduleBreakdown(loan: {
  penaltyCharged?: number | null;
  penaltyPaid?: number | null;
  schedules?: Array<{
    period?: number | null;
    dueDate?: Date | null;
    principalPayment?: number | null;
    interestPayment?: number | null;
    totalPayment?: number | null;
    paidAmount?: number | null;
  }>;
}) {
  const remainingSchedules = (loan.schedules || [])
    .map((schedule) => {
      const totalPayment = Number(schedule.totalPayment || 0);
      const paidAmount = Number(schedule.paidAmount || 0);
      const remainingAmount = Math.max(totalPayment - paidAmount, 0);
      if (remainingAmount <= 0) return null;

      const ratio = totalPayment > 0 ? remainingAmount / totalPayment : 0;
      return {
        period: schedule.period ?? null,
        dueDate: schedule.dueDate || null,
        totalLeft: remainingAmount,
        remainingPrincipal: Math.max(
          Number(schedule.principalPayment || 0) * ratio,
          0,
        ),
        remainingInterest: Math.max(
          Number(schedule.interestPayment || 0) * ratio,
          0,
        ),
      };
    })
    .filter((schedule): schedule is NonNullable<typeof schedule> => !!schedule)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

  const principal = remainingSchedules.reduce(
    (sum, schedule) => sum + schedule.remainingPrincipal,
    0,
  );
  const interest = remainingSchedules.reduce(
    (sum, schedule) => sum + schedule.remainingInterest,
    0,
  );
  const penalty = Math.max(
    Number(loan.penaltyCharged || 0) - Number(loan.penaltyPaid || 0),
    0,
  );

  return {
    principal,
    interest,
    penalty,
    total: principal + interest + penalty,
    installmentsRemaining: remainingSchedules.length,
    nextDueDate: remainingSchedules[0]?.dueDate || null,
    schedules: remainingSchedules.map((schedule) => ({
      period: schedule.period,
      dueDate: schedule.dueDate,
      principal: schedule.remainingPrincipal,
      interest: schedule.remainingInterest,
      total: schedule.totalLeft,
    })),
  };
}

export class LoanService {
  /**
   * Get all active loan products
   */
  static async getProducts() {
    try {
      const products = await db.loanProduct.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
      return { ok: true, data: products };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Submit Loan Application (Officer/Staff)
   */
  static async apply(data: {
    memberId: string;
    productId: string;
    amount: number;
    purpose?: string;
    officerId: string;
    periodMonths?: number;
  }) {
    try {
      const existingApplication = await db.loanApplication.findFirst({
        where: {
          memberId: data.memberId,
          status: { in: ["PENDING", "APPROVED"] },
        },
      });

      if (existingApplication) {
        throw new Error(
          "Member already has a pending or approved loan application.",
        );
      }

      const existingLoan = await db.loan.findFirst({
        where: {
          memberId: data.memberId,
          status: { in: ["APPROVED", "DISBURSED", "OVERDUE"] },
        },
      });

      if (existingLoan) {
        // Allow application if the system provides for loan deduction of existing loan
      }

      const product = await db.loanProduct.findUnique({
        where: { id: data.productId },
      });
      if (!product) throw new Error("Loan product not found");

      const application = await db.loanApplication.create({
        data: {
          memberId: data.memberId,
          loanProductId: data.productId,
          amountApplied: data.amount,
          purpose: data.purpose,
          applicantId: data.officerId,
          loanOfficerId: data.officerId,
          status: LoanStatus.PENDING,
          stage: LoanStage.SUBMITTED,
          submittedAt: new Date(),
          interestPeriod: product.interestPeriod,
          repaymentPeriodMonths: data.periodMonths || null,
        },
        include: { loanProduct: true, member: { include: { user: true } } },
      });

      void bumpAccountingSyncState("Loan application submitted");
      return { ok: true, data: application };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Approve Loan (Manager)
   */
  static async approve(data: {
    applicationId: string;
    managerId: string;
    approvedAmount: number;
    tellerId?: string;
    approvedRepaymentPeriod?: number;
  }) {
    try {
      const result = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const applicationCheck = await tx.loanApplication.findUnique({
            where: { id: data.applicationId },
            include: { member: true, loanProduct: true },
          });

          const amountGranted = data.approvedAmount;

          if (!applicationCheck) {
            throw new Error("Loan application not found");
          }

          const existingActiveLoans = await tx.loan.findMany({
            where: {
              memberId: applicationCheck.memberId,
              status: {
                in: [
                  LoanStatus.APPROVED,
                  LoanStatus.DISBURSED,
                  LoanStatus.OVERDUE,
                ],
              },
            },
            include: { loanApplication: { include: { loanProduct: true } } },
          });

          const hasLoanRecoveryDeduction =
            applicationCheck.existingLoanBalance &&
            applicationCheck.existingLoanBalance > 0;
          if (existingActiveLoans.length > 0 && !hasLoanRecoveryDeduction) {
            const loanDetails = existingActiveLoans
              .map(
                (l: any) =>
                  `${l.loanApplication?.loanProduct?.name || "Unknown"} (${l.status})`,
              )
              .join(", ");
            throw new Error(
              `Cannot approve loan: Member already has ${existingActiveLoans.length} active loan(s): ${loanDetails}. To approve, ensure the application includes an existing loan deduction.`,
            );
          }

          const otherApprovedApps = await tx.loanApplication.count({
            where: {
              memberId: applicationCheck.memberId,
              status: "APPROVED",
              id: { not: data.applicationId },
            },
          });

          if (otherApprovedApps > 0) {
            throw new Error(
              "Cannot approve: Member has another approved loan application pending disbursement.",
            );
          }

          let interestConfig: {
            defaultInterestType: "FLAT_RATE" | "REDUCING_BALANCE";
            defaultLoanInterestRate: number;
            allowInterestTypeOverride: boolean;
          } = {
            defaultInterestType: "FLAT_RATE",
            defaultLoanInterestRate: 15,
            allowInterestTypeOverride: true,
          };

          try {
            const { getInterestConfiguration } = await import(
              "@/services/interest-config.service"
            );
            interestConfig = await getInterestConfiguration();
          } catch (error) {
            console.warn(
              "Failed to fetch interest configuration during approval, using defaults:",
              error,
            );
          }

          const productInterestType =
            applicationCheck.loanProduct.interestType ||
            interestConfig.defaultInterestType;
          const resolvedInterestType =
            interestConfig.allowInterestTypeOverride &&
            applicationCheck.interestType
              ? applicationCheck.interestType
              : productInterestType;

          const allowedUpdateData: any = {
            status: LoanStatus.APPROVED,
            stage: LoanStage.APPROVED,
            approverId: data.managerId,
            approvalDate: new Date(),
            approvedAmount: data.approvedAmount,
            allocatedTellerId: data.tellerId || null,
            interestType: resolvedInterestType,
            ...(applicationCheck.loanOfficerId
              ? {}
              : { loanOfficerId: data.tellerId || null }),
          };

          if (data.approvedRepaymentPeriod) {
            allowedUpdateData.repaymentPeriodMonths =
              data.approvedRepaymentPeriod;
          }

          const application = await tx.loanApplication.update({
            where: { id: data.applicationId },
            data: allowedUpdateData,
            include: {
              loanProduct: true,
              member: {
                include: {
                  user: true,
                  accounts: { where: { status: "ACTIVE" } },
                },
              },
            },
          });

          let calculatedInterestRate =
            application.interestRateOverride ||
            application.loanProduct.interestRate;
          const interestPeriod = LoanService.getEffectiveInterestPeriod(
            application.loanProduct.name,
            application.interestPeriod ||
              (application.loanProduct as any).interestPeriod ||
              "MONTHLY",
          );

          const memberAccount = application.member.accounts[0];
          if (!memberAccount)
            throw new Error(
              "Member has no active account for loan association",
            );

          const repaymentPeriodMonths =
            application.repaymentPeriodMonths &&
            application.repaymentPeriodMonths > 0
              ? application.repaymentPeriodMonths
              : Math.ceil(
                  (application.loanProduct.repaymentPeriodDays || 30) / 30,
                );

          const repaymentPeriodDays = repaymentPeriodMonths * 30;

          if (
            !application.loanProduct.interestRate ||
            application.loanProduct.interestRate === 0
          ) {
            calculatedInterestRate = interestConfig.defaultLoanInterestRate;
          }

          const finalInterestType = (resolvedInterestType || "FLAT_RATE") as
            | "FLAT_RATE"
            | "REDUCING_BALANCE";

          const scheduleFrequency =
            (application.modeOfRepayment as ScheduleFrequency) || "MONTHLY";
          const calcResult = calculateLoanSchedule({
            amountGranted,
            interestRate: calculatedInterestRate,
            repaymentPeriodMonths,
            interestType: finalInterestType,
            gracePeriod: application.gracePeriod || 0,
            disbursementDate: new Date(), // Estimate for approval stage
            interestPeriod,
            payments: [],
            scheduleFrequency,
          });

          const interestAmount = Math.round(calcResult.totalInterest);
          const totalAmountDue = amountGranted + interestAmount;

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + repaymentPeriodDays);

          const loan = await tx.loan.create({
            data: {
              loanApplicationId: application.id,
              memberId: application.memberId,
              amountGranted,
              interestRate: calculatedInterestRate,
              interestPeriod,
              totalAmountDue,
              outstandingBalance: totalAmountDue,
              dueDate,
              branchId: memberAccount.branchId,
              status: "APPROVED",
              allocatedTellerId: data.tellerId || null,
              interestType: finalInterestType,
              interestAmount,
              gracePeriod: application.gracePeriod || 0,
            },
          });

          await tx.notification.create({
            data: {
              userId: application.member.user.id,
              type: "IN_APP",
              subject: "Loan Application Approved",
              message: `Congratulations! Your loan application for UGX ${amountGranted.toLocaleString()} has been APPROVED. It is now awaiting disbursement.`,
              targetAddress: `/dashboard/loanprocess/tracking` as string,
              sentAt: new Date(),
              status: "SENT",
            },
          });

          if (application.member.user.email) {
            await sendLoanApprovalEmail(
              application.member.user.email,
              application.member.user.name,
              application.loanProduct.name,
              amountGranted,
            );
          }

          if (data.tellerId) {
            await tx.notification.create({
              data: {
                userId: data.tellerId,
                type: "IN_APP",
                subject: "New Loan Assigned for Disbursement",
                message: `A loan of UGX ${amountGranted.toLocaleString()} for ${application.member.user.name} has been assigned to you for disbursement.`,
                targetAddress: `/dashboard/loans/${loan.id}`,
                sentAt: new Date(),
                status: "SENT",
              },
            });
          }

          return application;
        },
      );

      void bumpAccountingSyncState("Loan approved");
      return { ok: true, data: result };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Reject Loan (Manager)
   */
  static async reject(data: {
    applicationId: string;
    managerId: string;
    reason: string;
  }) {
    try {
      const application = await db.loanApplication.update({
        where: { id: data.applicationId },
        data: {
          status: LoanStatus.REJECTED,
          stage: LoanStage.REJECTED,
          approverId: data.managerId,
          approvalDate: new Date(),
          rejectionReason: data.reason,
        },
        include: { member: { include: { user: true } }, loanProduct: true },
      });

      await db.notification.create({
        data: {
          userId: application.member.user.id,
          type: "IN_APP",
          subject: "Loan Application Update",
          message: `Your loan application for ${application.loanProduct.name} was unfortunately rejected. Reason: ${data.reason}`,
          targetAddress: `/dashboard/loan-applications`,
          sentAt: new Date(),
          status: "SENT",
        },
      });

      void bumpAccountingSyncState("Loan application rejected");
      return { ok: true, data: application };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Disburse Loan (Loans Officer)
   * Funds are drawn directly from SACCO reserves (branch vault), not teller float.
   */
  static async disburse(
    applicationId: string,
    officerId: string,
    overrides: {
      amount?: number;
      periodMonths?: number;
      repaymentStartDate?: Date;
      gracePeriod?: number;
      processingFeePercentage?: number;
      memberAccountId?: string;
    } = {},
  ) {
    try {
      const result = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const app = await tx.loanApplication.findUnique({
            where: { id: applicationId },
            include: {
              loanProduct: true,
              member: {
                include: {
                  user: true,
                  accounts: {
                    where: { status: "ACTIVE" },
                    include: { accountType: true },
                  },
                },
              },
            },
          });

          if (!app || app.stage !== LoanStage.APPROVED) {
            throw new Error("Application not approved or not found");
          }

          const loan = await tx.loan.findUnique({
            where: { loanApplicationId: applicationId },
          });

          if (!loan)
            throw new Error(
              "Loan record not found. Please ensure the application was correctly approved.",
            );
          if (loan.status === "DISBURSED")
            throw new Error("Loan has already been disbursed");

          // --- Account Selection Logic ---
          let account;

          if (overrides.memberAccountId) {
            account = app.member.accounts.find(
              (a: any) => a.id === overrides.memberAccountId,
            );
            if (!account)
              throw new Error(
                "Provided disbursement account not found or is not active.",
              );
          }

          if (!account) {
            account = app.member.accounts.find(
              (a: any) => a.accountType.name === "Voluntary Savings Account",
            );
          }

          if (!account) {
            account =
              app.member.accounts.find(
                (a: any) =>
                  !a.accountType.isShareAccount && a.status === "ACTIVE",
              ) || app.member.accounts[0];
          }

          if (!account)
            throw new Error("Member has no active account for disbursement");

          // --- 1. Determine Effective Loan Parameters ---
          const amountGranted = overrides.amount || loan.amountGranted;
          const productPeriodMonths = Math.ceil(
            (app.loanProduct.repaymentPeriodDays || 30) / 30,
          );
          const periodMonths =
            overrides.periodMonths ||
            app.repaymentPeriodMonths ||
            productPeriodMonths;
          const gracePeriod = overrides.gracePeriod || 0;

          const disbursementDate = new Date();
          const gracePeriodDays = overrides.gracePeriod || app.gracePeriod || 0;

          const calculatedStartDate = new Date(disbursementDate);
          calculatedStartDate.setDate(
            calculatedStartDate.getDate() + 30 + gracePeriodDays,
          );

          const repaymentStartDate = overrides.repaymentStartDate
            ? new Date(overrides.repaymentStartDate)
            : app.repaymentStartDate &&
                new Date(app.repaymentStartDate) > disbursementDate
              ? new Date(app.repaymentStartDate)
              : calculatedStartDate;

          const rawInterestRate = loan.interestRate;
          let defaultInterestType: "FLAT_RATE" | "REDUCING_BALANCE" =
            "FLAT_RATE";

          try {
            const { getInterestConfiguration } = await import(
              "@/services/interest-config.service"
            );
            const config = await getInterestConfiguration();
            defaultInterestType = config.defaultInterestType;
          } catch (error) {
            console.warn(
              "Failed to fetch interest configuration during disbursement, using defaults:",
              error,
            );
          }

          const effectiveInterestType = ((loan as any).interestType ||
            app.interestType ||
            app.loanProduct.interestType ||
            defaultInterestType ||
            "FLAT_RATE") as "FLAT_RATE" | "REDUCING_BALANCE";

          let interestPeriod = LoanService.getEffectiveInterestPeriod(
            app.loanProduct.name,
            (loan as any).interestPeriod ||
              app.interestPeriod ||
              app.loanProduct.interestPeriod ||
              "MONTHLY",
          );

          const interestRate =
            interestPeriod === "ANNUAL"
              ? rawInterestRate / 12
              : rawInterestRate;

          const dueDate = new Date(repaymentStartDate);
          dueDate.setMonth(dueDate.getMonth() + periodMonths + gracePeriod - 1);

          // --- 2. Calculate Deductions ---
          const grossAmount = amountGranted;
          let totalDeductions = 0;
          const deductions: any = {
            processingFee: 0,
            insurance: 0,
            shareCapital: 0,
            loanRecovery: 0,
          };
          let recoveryInterest = 0;
          let recoveryPrincipal = 0;
          let shareCapitalEquityAccountId: string | undefined;

          if (app.applyLoanProcessingFee) {
            const feePercent =
              overrides.processingFeePercentage ||
              app.loanProcessingFeePercentage ||
              2;
            deductions.processingFee = Math.round(
              (grossAmount * feePercent) / 100,
            );
            totalDeductions += deductions.processingFee;
          }

          if (deductions.processingFee > 0) {
            const processingFeeCategory = await tx.budgetCategory.findUnique({
              where: { code: "401002" },
              select: { id: true },
            });
            const existingProcessingFee = processingFeeCategory
              ? await tx.incomeRecord.findFirst({
                  where: {
                    referenceNumber: { startsWith: `LPF-APP-${applicationId.slice(0, 8)}` },
                    budgetCategoryId: processingFeeCategory.id,
                    status: TransactionStatus.COMPLETED,
                  },
                })
              : null;

            if (existingProcessingFee) {
              totalDeductions -= deductions.processingFee;
              deductions.processingFee = 0;
            }
          }

          if (app.applyLoanInsurance && app.loanInsurancePercentage) {
            deductions.insurance = Math.round(
              (grossAmount * app.loanInsurancePercentage) / 100,
            );
            totalDeductions += deductions.insurance;
          }

          const existingInsuranceContribution = app.applyLoanInsurance
            ? await tx.insuranceContribution.findFirst({
                where: {
                  loanApplicationId: applicationId,
                  type: InsuranceContributionType.CONTRIBUTION,
                },
              })
            : null;

          if (existingInsuranceContribution && deductions.insurance > 0) {
            totalDeductions -= deductions.insurance;
            deductions.insurance = 0;
          }

          if (app.applyShareDeduction && app.shareAmount) {
            deductions.shareCapital = app.shareAmount;
            totalDeductions += deductions.shareCapital;
          }

          if (app.existingLoanBalance && app.existingLoanBalance > 0) {
            deductions.loanRecovery = app.existingLoanBalance;
            totalDeductions += deductions.loanRecovery;
          }

          const netDisbursement = grossAmount - totalDeductions;
          if (netDisbursement < 0)
            throw new Error("Deductions exceed loan amount.");

          // --- 2. Financial Integrity Checks ---
          if (!loan.branchId)
            throw new Error("Loan has no branch assigned. Cannot disburse.");
          const branchVault = await tx.vault.findFirst({
            where: { branchId: loan.branchId, isActive: true },
          });
          if (!branchVault)
            throw new Error(
              "No active vault found for this branch. Please contact admin.",
            );
          if (branchVault.balance < netDisbursement) {
            throw new Error(
              `Insufficient SACCO reserves. Available: UGX ${branchVault.balance.toLocaleString()}, Required: UGX ${netDisbursement.toLocaleString()}`,
            );
          }

          // --- 3. Process Deductions ---
          const currentPeriod = await tx.financialPeriod.findFirst({
            where: {
              isClosed: false,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            },
          });

          // Processing Fee — audit transaction only (income record created in step 5)
          if (deductions.processingFee > 0) {
            await tx.transaction.create({
              data: {
                transactionRef: `FEE-${Date.now()}`,
                memberId: app.memberId,
                accountId: account.id,
                type: "LOAN_FEE",
                amount: deductions.processingFee,
                status: "COMPLETED",
                description: `Loan processing fee deduction`,
                processedByUserId: officerId,
                channel: "SYSTEM",
                branchId: loan.branchId || undefined,
                loanId: loan.id,
              },
            });
          }

          // Insurance Premium → Centralized Loan Insurance Pool
          if (deductions.insurance > 0) {
            await recordLoanInsuranceCollection({
              tx,
              amount: deductions.insurance,
              createdById: officerId,
              branchId: loan.branchId || null,
              memberId: app.memberId,
              loanApplicationId: applicationId,
              description: `Insurance from loan disbursement - ${app.member.user.name} - Loan ${loan.id.slice(0, 8)}`,
              reference: `INS-POOL-${loan.id.slice(0, 8)}`,
              createJournalEntry: false,
              operationalTransaction: {
                transactionRef: `INS-${Date.now()}`,
                memberId: app.memberId,
                loanId: loan.id,
                description: `Loan insurance premium - ${app.member.user.name} - Loan ${loan.id.slice(0, 8)}`,
                processedByUserId: officerId,
              },
            });
          }

          // Share Capital Purchase
          if (deductions.shareCapital > 0) {
            const shareAccountType = await resolveAssociateShareAccountType(tx);
            const shareAccountNumber = `${
              shareAccountType.ledgerAccount?.accountCode || "300503"
            }-${app.member.memberNumber}`;

            const shareEquityAccount = await resolveShareCapitalAccount();
            shareCapitalEquityAccountId = shareEquityAccount.id;

            let shareAccount = app.member.accounts.find(
              (a: any) =>
                a.accountType.isShareAccount &&
                a.accountTypeId === shareAccountType.id,
            );

            if (!shareAccount) {
              shareAccount = (await tx.account.create({
                data: {
                  accountNumber: shareAccountNumber,
                  accountTypeId: shareAccountType.id,
                  memberId: app.memberId,
                  balance: 0,
                  status: AccountStatus.ACTIVE,
                  ...(loan.branchId ? { branchId: loan.branchId } : {}),
                } as any,
                include: { accountType: true },
              })) as any;
            }

            await tx.account.update({
              where: { id: shareAccount!.id },
              data: { balance: { increment: deductions.shareCapital } },
            });
            await tx.transaction.create({
              data: {
                transactionRef: `SHR-${Date.now()}`,
                memberId: app.memberId,
                accountId: shareAccount!.id,
                type: "SHARES_PURCHASE" as any,
                amount: deductions.shareCapital,
                status: "COMPLETED",
                description: `Share capital deduction from loan ${loan.id.slice(0, 8)}`,
                processedByUserId: officerId,
                channel: "SYSTEM",
                loanId: loan.id,
              },
            });

            let memberShareAccount = await tx.shareAccount.findFirst({
              where: {
                memberId: app.memberId,
                accountTypeId: shareAccountType.id,
              },
              include: { accountType: true },
            });

            if (!memberShareAccount) {
              memberShareAccount = await tx.shareAccount.create({
                data: {
                  accountNumber: shareAccountNumber,
                  memberId: app.memberId,
                  accountTypeId: shareAccountType.id,
                  branchId: loan.branchId || undefined,
                  shareValue: Number(shareAccountType.sharePrice || 10000),
                  totalValue: 0,
                  status: AccountStatus.ACTIVE as any,
                },
                include: { accountType: true },
              });
            }

            const sharePrice = Number(
              memberShareAccount.shareValue || shareAccountType.sharePrice || 10000,
            );
            const sharesPurchased = Math.max(
              1,
              Math.round(deductions.shareCapital / sharePrice),
            );
            const sharesBefore = Number(memberShareAccount.numberOfShares || 0);
            const sharesAfter = sharesBefore + sharesPurchased;

            await tx.shareAccount.update({
              where: { id: memberShareAccount.id },
              data: {
                numberOfShares: { increment: sharesPurchased },
                totalValue: { increment: deductions.shareCapital },
                lastTransactionDate: new Date(),
                branchId: memberShareAccount.branchId || loan.branchId || undefined,
              },
            });

            await tx.shareTransaction.create({
              data: {
                accountId: memberShareAccount.id,
                transactionType: "PURCHASE",
                shares: sharesPurchased,
                shareValue: sharePrice,
                amount: deductions.shareCapital,
                sharesBefore,
                sharesAfter,
                transactionDate: new Date(),
                reference: `LN-SHARE-${loan.id.slice(0, 8)}`,
                description: `Share capital collected from loan disbursement ${loan.id.slice(0, 8)}`,
                tellerId: officerId,
              },
            });
          }

          // Loan Recovery — Split into Principal and Interest
          if (deductions.loanRecovery > 0) {
            const existingLoan = await tx.loan.findFirst({
              where: {
                memberId: app.memberId,
                status: { in: ["DISBURSED", "OVERDUE"] },
                id: { not: loan.id },
              },
              orderBy: { disbursementDate: "desc" },
            });
            if (existingLoan) {
              const {
                interest: recoveryInterestCalc,
                penalty: recoveryPenalty,
                principal: recoveryPrincipalCalc,
              } = await LoanService.calculateRepaymentSplit(
                existingLoan,
                deductions.loanRecovery,
              );

              recoveryInterest = recoveryInterestCalc;
              recoveryPrincipal = recoveryPrincipalCalc;

              const isFullPayoff =
                existingLoan.outstandingBalance - deductions.loanRecovery <=
                0.01;

              const lastLedger = await tx.loanLedgerTransaction.findFirst({
                where: { loanId: existingLoan.id },
                orderBy: { transactionDate: "desc" },
              });

              const prevPrincipal =
                lastLedger?.balancePrincipal ?? existingLoan.amountGranted;
              const prevInterest =
                lastLedger?.balanceInterest ??
                (existingLoan.interestAmount || 0);

              await tx.loan.update({
                where: { id: existingLoan.id },
                data: {
                  outstandingBalance: { decrement: deductions.loanRecovery },
                  amountPaid: { increment: deductions.loanRecovery },
                  interestPaid: { increment: recoveryInterest },
                  principalPaid: { increment: recoveryPrincipal },
                  penaltyPaid: { increment: recoveryPenalty },
                  status: isFullPayoff ? "REPAID" : existingLoan.status,
                },
              });

              const recoveryRepayment = await tx.loanRepayment.create({
                data: {
                  loanId: existingLoan.id,
                  memberId: app.memberId,
                  amount: deductions.loanRecovery,
                  repaymentDate: new Date(),
                  handlerUserId: officerId,
                  channel: "LOAN_DEDUCTION",
                  interestPaid: recoveryInterest,
                  principalPaid: recoveryPrincipal,
                  penaltyPaid: recoveryPenalty,
                },
              });

              await tx.loanLedgerTransaction.create({
                data: {
                  loanId: existingLoan.id,
                  transactionType: "REPAYMENT",
                  transactionDate: new Date(),
                  voucherNo: `DED-${recoveryRepayment.id.substring(0, 5).toUpperCase()}`,
                  debitPrincipal: 0,
                  debitInterest: 0,
                  creditPrincipal: recoveryPrincipal,
                  creditInterest: recoveryInterest,
                  balancePrincipal: Math.max(
                    0,
                    prevPrincipal - recoveryPrincipal,
                  ),
                  balanceInterest: Math.max(0, prevInterest - recoveryInterest),
                  balanceTotal: Math.max(
                    0,
                    prevPrincipal -
                      recoveryPrincipal +
                      (prevInterest - recoveryInterest),
                  ),
                },
              });

              // Record recovery interest as SACCO income
              if (recoveryInterest > 0) {
                // ✅ upsert parent by code
                const loanParentCategory = await tx.budgetCategory.upsert({
                  where: { code: "401000" },
                  update: { name: "Loan related income" },
                  create: {
                    name: "Loan related income",
                    code: "401000",
                    kind: "INCOME",
                    description:
                      "Loan related income including fees, interest and penalties",
                    isActive: true,
                  },
                });

                // ✅ upsert child by code — NOT by name_kind_parentId
                const interestIncomeCategory = await tx.budgetCategory.upsert({
                  where: { code: "401001" },
                  update: {
                    parentId: loanParentCategory.id,
                    name: "Interest paid",
                  },
                  create: {
                    name: "Interest paid",
                    code: "401001",
                    kind: "INCOME",
                    description: "Interest from loans",
                    isActive: true,
                    parentId: loanParentCategory.id,
                  },
                });

                await tx.incomeRecord.create({
                  data: {
                    budgetCategoryId: interestIncomeCategory.id,
                    amount: recoveryInterest,
                    date: new Date(),
                    description: `Loan recovery interest - existing loan ${existingLoan.id.slice(0, 8)}`,
                    paymentMethod: "CASH",
                    branchId: loan.branchId || undefined,
                    memberId: app.memberId,
                    receivedByUserId: officerId,
                    periodId: currentPeriod?.id,
                    status: "COMPLETED",
                    receiptNo: `LRI-${Date.now()}`,
                    externalRef: existingLoan.id,
                    recordDate: new Date(),
                  },
                });

                // GL journal entry: Dr Cash, Cr Interest Income
                const interestGl = await tx.chartOfAccount.findFirst({ where: { accountCode: "401001", isActive: true } });
                const cashGl = await tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } });
                  if (interestGl && cashGl) {
                    const jeNum = `JE-LRCV-${Date.now()}`;
                    await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: cashGl.id, debitAmount: recoveryInterest, creditAmount: 0, description: `Recovery interest - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `LRCV-${existingLoan.id.slice(0, 8)}`, branchId: loan.branchId || undefined, createdByUserId: officerId } });
                    await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: interestGl.id, debitAmount: 0, creditAmount: recoveryInterest, description: `Recovery interest - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `LRCV-${existingLoan.id.slice(0, 8)}`, branchId: loan.branchId || undefined, createdByUserId: officerId } });
                  await tx.chartOfAccount.update({ where: { id: cashGl.id }, data: buildAccountBalanceUpdate(cashGl, { debitAmount: recoveryInterest }) });
                  await tx.chartOfAccount.update({ where: { id: interestGl.id }, data: buildAccountBalanceUpdate(interestGl, { creditAmount: recoveryInterest }) });
                }
              }
            }
          }

          // --- 4. Finalize Disbursement ---
          const vaultBalanceBefore = branchVault.balance;
          await tx.vault.update({
            where: { id: branchVault.id },
            data: { balance: { decrement: netDisbursement } },
          });
          await tx.vaultTransaction.create({
            data: {
              vaultId: branchVault.id,
              type: "LOAN_DISBURSEMENT",
              amount: -netDisbursement,
              balanceBefore: vaultBalanceBefore,
              balanceAfter: vaultBalanceBefore - netDisbursement,
              description: `Loan disbursement - ${app.loanProduct.name} to ${app.member.user.name}`,
              performedByUserId: officerId,
              relatedUserId: app.member.user.id,
            },
          });

          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: netDisbursement } },
          });
          const disbursementTx = await tx.transaction.create({
            data: {
              transactionRef: `LN-DISB-${Date.now()}`,
              memberId: app.memberId,
              accountId: account.id,
              type: "LOAN_DISBURSEMENT" as any,
              amount: netDisbursement,
              status: TransactionStatus.COMPLETED,
              description: `Loan Disbursement: ${app.loanProduct.name}`,
              processedByUserId: officerId,
              channel: "INTERNAL",
              loanId: loan.id,
              branchId: loan.branchId,
            },
          });

          // --- Relworx Integration: Loan Disbursement payout ---
          if (app.disbursementMethod?.toUpperCase() === "MOBILE_MONEY") {
            const msisdn = app.mobileMoneyNumber || app.member.user.phone || "";
            if (!msisdn) {
              throw new Error("Phone number (MSISDN) is required for mobile money disbursement.");
            }

            const relworxResponse = await RelworxService.sendPayment({
              msisdn,
              amount: netDisbursement,
              currency: "UGX",
              reference: disbursementTx.transactionRef,
              description: `Loan Disbursement: ${app.loanProduct.name}`,
            });

            if (!relworxResponse.success) {
              throw new Error(`Relworx Disbursement Failed: ${relworxResponse.message}`);
            }

            // Note: In a full implementation, we would store relworxResponse.internal_reference
          }

          await tx.loanRepaymentSchedule.deleteMany({
            where: { loanId: loan.id, status: "PENDING" },
          });

          const scheduleFrequency =
            (app.modeOfRepayment as ScheduleFrequency) || "MONTHLY";
          const calcResult = calculateLoanSchedule({
            amountGranted,
            interestRate: rawInterestRate,
            repaymentPeriodMonths: periodMonths,
            interestType: effectiveInterestType,
            gracePeriod: 0,
            disbursementDate: repaymentStartDate,
            interestPeriod: interestPeriod === "ANNUAL" ? "ANNUAL" : "MONTHLY",
            payments: [],
            scheduleFrequency,
          });

          const totalInterest = Math.round(calcResult.totalInterest);
          const totalAmountDue = Math.round(calcResult.totalAmountRepaid);

          const updatedLoan = await tx.loan.update({
            where: { id: loan.id },
            data: {
              status: LoanStatus.DISBURSED,
              disbursementDate: new Date(),
              amountGranted,
              totalAmountDue,
              outstandingBalance: totalAmountDue,
              dueDate,
              gracePeriod,
              interestAmount: totalInterest,
              interestType: effectiveInterestType,
              interestPeriod,
              disbursedByUserId: officerId,
            },
          });

          if (calcResult.schedule && calcResult.schedule.length > 0) {
            await tx.loanRepaymentSchedule.createMany({
              data: calcResult.schedule.map((s) => ({
                loanId: loan.id,
                period: s.period,
                dueDate: s.dueDate,
                principalPayment: s.principalPayment,
                interestPayment: s.interestPayment,
                totalPayment: s.totalPayment,
                remainingBalance: s.remainingBalance,
                paidAmount: 0,
                status: "PENDING",
              })),
            });
          }

          await tx.loanLedgerTransaction.create({
            data: {
              loanId: loan.id,
              transactionType: "DISBURSEMENT",
              transactionDate: new Date(),
              voucherNo: loan.id.substring(0, 8).toUpperCase(),
              debitPrincipal: amountGranted,
              debitInterest: 0, // Interest accrues over time, not upfront
              creditPrincipal: 0,
              creditInterest: 0,
              balancePrincipal: amountGranted,
              balanceInterest: totalInterest,
              balanceTotal: totalAmountDue,
            },
          });

          await tx.loanApplication.update({
            where: { id: applicationId },
            data: {
              stage: LoanStage.DISBURSED,
              disbursedAt: new Date(),
              status: LoanStatus.DISBURSED,
              approvedAmount: amountGranted,
              repaymentPeriodMonths: periodMonths,
              repaymentStartDate,
              gracePeriod,
            },
          });

          const { createComprehensiveLoanDisbursementJournalEntry } =
            await import("@/lib/journal-entries-extended");
          await createComprehensiveLoanDisbursementJournalEntry(
            {
              amountGranted,
              netDisbursement,
              processingFee: deductions.processingFee,
              insuranceFee: deductions.insurance,
              shareCapital: deductions.shareCapital,
              loanRecoveryPrincipal: recoveryPrincipal || 0,
              loanRecoveryInterest: recoveryInterest || 0,
              description: `Loan Disbursement - ${app.member.user.name} - ${app.loanProduct.name}`,
              reference: `LN-DISB-${updatedLoan.id}`,
              transactionId: disbursementTx.id,
              userId: officerId,
              entryDate: new Date(),
              branchId: loan.branchId,
              sourceAccountCode: "301004",
              ledgerAccountId: app.loanProduct.ledgerAccountId || undefined,
              interestAccountId: app.loanProduct.interestAccountId || undefined,
              penaltyAccountId: app.loanProduct.penaltyAccountId || undefined,
              feeAccountId: app.loanProduct.feeAccountId || undefined,
              shareAccountId: shareCapitalEquityAccountId,
            },
            tx,
          );

          // --- 5. Record Deductions as IncomeRecords ---
          // All budget category upserts use `where: { code: "..." }` to avoid
          // the unique constraint error on (name, kind, parentId).
          if (deductions.processingFee > 0) {
            // ✅ Parent always upserted by code first
            const loanParentCategory = await tx.budgetCategory.upsert({
              where: { code: "401000" },
              update: { name: "Loan related income" },
              create: {
                name: "Loan related income",
                code: "401000",
                kind: "INCOME",
                description:
                  "Loan related income including fees, interest and penalties",
                isActive: true,
              },
            });

            if (deductions.processingFee > 0) {
              // ✅ Child upserted by code — NOT name_kind_parentId
              const feeCategory = await tx.budgetCategory.upsert({
                where: { code: "401002" },
                update: {
                  parentId: loanParentCategory.id,
                  name: "Loan processing fees",
                },
                create: {
                  name: "Loan processing fees",
                  code: "401002",
                  kind: "INCOME",
                  description: "Fees collected for loan processing",
                  isActive: true,
                  parentId: loanParentCategory.id,
                },
              });

              await tx.incomeRecord.create({
                data: {
                  budgetCategoryId: feeCategory.id,
                  amount: deductions.processingFee,
                  date: new Date(),
                  recordDate: new Date(),
                  description: `Loan Processing Fee - ${app.member.user.name} - ${updatedLoan.id.slice(0, 8)}`,
                  receivedByUserId: officerId,
                  branchId: loan.branchId || undefined,
                  memberId: app.memberId,
                  depositorName: app.member.user.name,
                  status: "COMPLETED",
                  paymentMethod: "BANK",
                  referenceNumber: `LPF-${updatedLoan.id.slice(0, 8)}`,
                  notes: `Automated entry from loan disbursement deduction.`,
                },
              });

              // GL journal entry: Dr Cash, Cr Processing Fee Income
              const feeGl = await tx.chartOfAccount.findFirst({ where: { accountCode: "401002", isActive: true } });
              const feeCashGl = await tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } });
              if (feeGl && feeCashGl) {
                const jeNum = `JE-LPF-${Date.now()}`;
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: feeCashGl.id, debitAmount: deductions.processingFee, creditAmount: 0, description: `Processing fee - ${updatedLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `LPF-${updatedLoan.id.slice(0, 8)}`, branchId: loan.branchId || undefined, createdByUserId: officerId } });
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: feeGl.id, debitAmount: 0, creditAmount: deductions.processingFee, description: `Processing fee - ${updatedLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `LPF-${updatedLoan.id.slice(0, 8)}`, branchId: loan.branchId || undefined, createdByUserId: officerId } });
                await tx.chartOfAccount.update({ where: { id: feeCashGl.id }, data: buildAccountBalanceUpdate(feeCashGl, { debitAmount: deductions.processingFee }) });
                await tx.chartOfAccount.update({ where: { id: feeGl.id }, data: buildAccountBalanceUpdate(feeGl, { creditAmount: deductions.processingFee }) });
              }
            }

          }

          await tx.notification.create({
            data: {
              userId: app.member.user.id,
              type: "IN_APP",
              subject: "Loan Disbursed Successfully",
              message: `Your loan of UGX ${amountGranted.toLocaleString()} has been disbursed. UGX ${netDisbursement.toLocaleString()} credited to ${account.accountNumber}. Deductions: UGX ${totalDeductions.toLocaleString()}. First repayment due by ${dueDate.toLocaleDateString("en-UG", { day: "2-digit", month: "short", year: "numeric" })}.`,
              targetAddress: `/dashboard/loanprocess/tracking`,
              sentAt: new Date(),
              status: "SENT",
            },
          });

          if (app.member.user.email) {
            await sendTransactionAlertEmail(
              app.member.user.email,
              app.member.user.name,
              "DISBURSEMENT",
              netDisbursement,
              account.balance + netDisbursement,
            );
          }

          return {
            ...updatedLoan,
            grossAmount: amountGranted,
            netDisbursement,
            totalDeductions,
            deductions,
            branchReserveDebited: netDisbursement,
            processingFee: deductions.processingFee,
          };
        },
        {
          maxWait: 5000,
          timeout: 60000,
        },
      );

      void bumpAccountingSyncState("Loan disbursed");
      return { ok: true, data: result };
    } catch (error: any) {
      console.error("🔥 LoanService.disburse error:", error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Disburse Institution Loan
   */
  static async disburseInstitution(
    applicationId: string,
    officerId: string,
    overrides: {
      amount?: number;
      periodMonths?: number;
      repaymentStartDate?: Date;
      gracePeriod?: number;
      processingFeePercentage?: number;
      institutionAccountId?: string;
    } = {},
  ) {
    try {
      const result = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const app = await tx.institutionLoanApplication.findUnique({
            where: { id: applicationId },
            include: {
              loanProduct: true,
              institution: {
                include: {
                  user: true,
                  accounts: {
                    where: { status: "ACTIVE" },
                    include: { accountType: true },
                  },
                },
              },
            },
          });

          if (!app || app.stage !== LoanStage.APPROVED) {
            throw new Error(
              "Institution loan application not approved or not found",
            );
          }

          const loan = await tx.institutionLoan.findUnique({
            where: { applicationId: applicationId },
          });

          if (!loan) throw new Error("Institution loan record not found.");
          if (loan.status === LoanStatus.DISBURSED)
            throw new Error("Loan has already been disbursed");

          let account;
          if (overrides.institutionAccountId) {
            account = app.institution.accounts.find(
              (a: any) => a.id === overrides.institutionAccountId,
            );
          }
          if (!account) {
            account =
              app.institution.accounts.find((a: any) =>
                a.accountType.name.includes("Voluntary Savings"),
              ) ||
              app.institution.accounts.find(
                (a: any) => !a.accountType.isShareAccount,
              ) ||
              app.institution.accounts[0];
          }

          if (!account)
            throw new Error(
              "Institution has no active account for disbursement",
            );

          const amountGranted = overrides.amount || loan.amountGranted;
          const periodMonths =
            overrides.periodMonths || app.repaymentPeriodMonths || 12;
          const gracePeriod = overrides.gracePeriod || app.gracePeriod || 0;
          const disbursementDate = new Date();
          const gracePeriodDays = overrides.gracePeriod || app.gracePeriod || 0;

          const calculatedStartDate = new Date(disbursementDate);
          calculatedStartDate.setMonth(calculatedStartDate.getMonth() + 1);
          calculatedStartDate.setDate(
            calculatedStartDate.getDate() + gracePeriodDays,
          );

          const repaymentStartDate =
            overrides.repaymentStartDate ||
            app.repaymentStartDate ||
            calculatedStartDate;

          const rawInterestRate = loan.interestRate;
          let recoveryInterest = 0;
          let recoveryPenalty = 0;
          let recoveryPrincipal = 0;
          let shareCapitalEquityAccountId: string | undefined;

          let interestPeriod = LoanService.getEffectiveInterestPeriod(
            app.loanProduct.name,
            app.interestPeriod || app.loanProduct.interestPeriod || "MONTHLY",
          );

          const dueDate = new Date(repaymentStartDate);
          dueDate.setMonth(dueDate.getMonth() + periodMonths + gracePeriod - 1);

          let totalDeductions = 0;
          const deductions = {
            processingFee: 0,
            insurance: 0,
            shares: 0,
            loanRecovery: 0,
          };

          if (app.applyLoanProcessingFee) {
            const feePercent =
              overrides.processingFeePercentage ||
              app.loanProcessingFeePercentage ||
              2;
            deductions.processingFee = (amountGranted * feePercent) / 100;
            totalDeductions += deductions.processingFee;
          }

          if (deductions.processingFee > 0) {
            const processingFeeCategory = await tx.budgetCategory.findUnique({
              where: { code: "401002" },
              select: { id: true },
            });
            const existingProcessingFee = processingFeeCategory
              ? await tx.incomeRecord.findFirst({
                  where: {
                    referenceNumber: { startsWith: `LPF-APP-${applicationId.slice(0, 8)}` },
                    budgetCategoryId: processingFeeCategory.id,
                    status: TransactionStatus.COMPLETED,
                  },
                })
              : null;

            if (existingProcessingFee) {
              totalDeductions -= deductions.processingFee;
              deductions.processingFee = 0;
            }
          }

          if (app.applyLoanInsurance && app.loanInsurancePercentage) {
            deductions.insurance =
              (amountGranted * app.loanInsurancePercentage) / 100;
            totalDeductions += deductions.insurance;
          }

          if (app.applyShareDeduction && app.shareAmount) {
            deductions.shares = app.shareAmount;
            totalDeductions += deductions.shares;
          }

          // Check for existing active institution loans (DISBURSED or OVERDUE)
          const existingLoan = await tx.institutionLoan.findFirst({
            where: {
              institutionId: app.institutionId,
              status: { in: ["DISBURSED", "OVERDUE"] },
              id: { not: loan.id },
            },
            orderBy: { disbursementDate: "desc" },
          });

          if (existingLoan && existingLoan.outstandingBalance > 0) {
            // Auto-deduct the full outstanding balance of the existing loan
            deductions.loanRecovery = existingLoan.outstandingBalance;
            totalDeductions += deductions.loanRecovery;
          }

          const netDisbursement = amountGranted - totalDeductions;
          if (netDisbursement < 0)
            throw new Error("Deductions exceed loan amount.");

          const branchVault = await tx.vault.findFirst({
            where: { branchId: account.branchId, isActive: true },
          });
          if (!branchVault || branchVault.balance < amountGranted) {
            throw new Error("Insufficient SACCO reserves in branch vault.");
          }

          const currentPeriod = await tx.financialPeriod.findFirst({
            where: {
              isClosed: false,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            },
          });

          if (deductions.processingFee > 0) {
            await tx.transaction.create({
              data: {
                transactionRef: `FEE-INST-${Date.now()}`,
                institutionId: app.institutionId,
                accountId: account.id,
                type: "LOAN_FEE",
                amount: deductions.processingFee,
                status: "COMPLETED",
                description: `Institution loan processing fee deduction`,
                processedByUserId: officerId,
                channel: "SYSTEM",
                branchId: account.branchId || undefined,
              },
            });
          }

          if (deductions.insurance > 0) {
            await recordLoanInsuranceCollection({
              tx,
              amount: deductions.insurance,
              createdById: officerId,
              branchId: account.branchId || null,
              description: `Insurance from institution loan disbursement - ${app.institution.institutionName} - Loan ${loan.id.slice(0, 8)}`,
              reference: `INS-INST-${loan.id.slice(0, 8)}`,
              createJournalEntry: false,
              operationalTransaction: {
                transactionRef: `INS-INST-${Date.now()}`,
                institutionId: app.institutionId,
                loanId: loan.id,
                description: `Institution loan insurance premium - ${app.institution.institutionName} - Loan ${loan.id.slice(0, 8)}`,
                processedByUserId: officerId,
              },
            });
          }

          if (deductions.shares > 0) {
            const shareAccountType = await tx.accountType.findFirst({
              where: { isShareAccount: true },
              include: { ledgerAccount: true },
            });

            const shareEquityAccount = await resolveShareCapitalAccount();
            shareCapitalEquityAccountId = shareEquityAccount.id;

            let shareAccount = app.institution.accounts.find(
              (a: any) => a.accountType.isShareAccount,
            );
            if (shareAccount) {
              await tx.account.update({
                where: { id: shareAccount.id },
                data: { balance: { increment: deductions.shares } },
              });
            }
          }

          // Process Loan Recovery for Institution
          if (deductions.loanRecovery > 0 && existingLoan) {
            const { interest, penalty, principal } =
              await LoanService.calculateRepaymentSplit(
                existingLoan,
                deductions.loanRecovery,
              );
            recoveryInterest = interest;
            recoveryPenalty = penalty;
            recoveryPrincipal = principal;

            const isFullPayoff =
              existingLoan.outstandingBalance - deductions.loanRecovery <= 0.01;

            const lastLedger =
              await tx.institutionLoanLedgerTransaction.findFirst({
                where: { loanId: existingLoan.id },
                orderBy: { transactionDate: "desc" },
              });
            const prevPrincipal =
              lastLedger?.balancePrincipal ?? existingLoan.amountGranted;
            const prevInterest =
              lastLedger?.balanceInterest ??
              existingLoan.totalAmountDue - existingLoan.amountGranted;

            await tx.institutionLoan.update({
              where: { id: existingLoan.id },
              data: {
                outstandingBalance: { decrement: deductions.loanRecovery },
                amountPaid: { increment: deductions.loanRecovery },
                interestPaid: { increment: recoveryInterest },
                principalPaid: { increment: recoveryPrincipal },
                penaltyPaid: { increment: recoveryPenalty },
                status: isFullPayoff ? "REPAID" : existingLoan.status,
              },
            });

            const recoveryRepay = await tx.institutionLoanRepayment.create({
              data: {
                loanId: existingLoan.id,
                institutionId: app.institutionId,
                amount: deductions.loanRecovery,
                repaymentDate: new Date(),
                channel: "LOAN_DEDUCTION",
                interestPaid: recoveryInterest,
                principalPaid: recoveryPrincipal,
                description: `Deduction from new loan disbursement ${loan.id.slice(0, 8)}`,
              },
            });

            await tx.institutionLoanLedgerTransaction.create({
              data: {
                loanId: existingLoan.id,
                transactionType: "REPAYMENT",
                transactionDate: new Date(),
                voucherNo: `DED-${recoveryRepay.id.substring(0, 5).toUpperCase()}`,
                debitPrincipal: 0,
                debitInterest: 0,
                creditPrincipal: recoveryPrincipal,
                creditInterest: recoveryInterest,
                balancePrincipal: Math.max(
                  0,
                  prevPrincipal - recoveryPrincipal,
                ),
                balanceInterest: Math.max(0, prevInterest - recoveryInterest),
                balanceTotal: Math.max(
                  0,
                  prevPrincipal -
                    recoveryPrincipal +
                    (prevInterest - recoveryInterest),
                ),
              },
            });

            if (recoveryInterest > 0) {
              // ✅ upsert by code
              const interestIncomeCategory = await tx.budgetCategory.upsert({
                where: { code: "401001" },
                update: { name: "Interest paid" },
                create: {
                  name: "Interest paid",
                  code: "401001",
                  kind: "INCOME",
                  isActive: true,
                },
              });

              await tx.incomeRecord.create({
                data: {
                  budgetCategoryId: interestIncomeCategory.id,
                  amount: recoveryInterest,
                  date: new Date(),
                  description: `Inst Loan recovery interest - existing loan ${existingLoan.id.slice(0, 8)}`,
                  paymentMethod: "CASH",
                  branchId: account.branchId || undefined,
                  receivedByUserId: officerId,
                  status: "COMPLETED",
                  receiptNo: `ILRI-${Date.now()}`,
                  recordDate: new Date(),
                  notes: `Institution: ${app.institution?.institutionName || "N/A"} (${app.institutionId})`,
                },
              });

              // GL journal entry: Dr Cash, Cr Interest Income
              const instIntGl = await tx.chartOfAccount.findFirst({ where: { accountCode: "401001", isActive: true } });
              const instIntCashGl = await tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } });
              if (instIntGl && instIntCashGl) {
                const jeNum = `JE-ILRI-${Date.now()}`;
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instIntCashGl.id, debitAmount: recoveryInterest, creditAmount: 0, description: `Inst recovery interest - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `ILRI-${existingLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instIntGl.id, debitAmount: 0, creditAmount: recoveryInterest, description: `Inst recovery interest - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `ILRI-${existingLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.chartOfAccount.update({ where: { id: instIntCashGl.id }, data: buildAccountBalanceUpdate(instIntCashGl, { debitAmount: recoveryInterest }) });
                await tx.chartOfAccount.update({ where: { id: instIntGl.id }, data: buildAccountBalanceUpdate(instIntGl, { creditAmount: recoveryInterest }) });
              }
            }

            if (recoveryPenalty > 0) {
              // ✅ upsert by code
              const penaltyIncomeCategory = await tx.budgetCategory.upsert({
                where: { code: "401005" },
                update: { name: "Loan penalty paid" },
                create: {
                  name: "Loan penalty paid",
                  code: "401005",
                  kind: "INCOME",
                  isActive: true,
                },
              });

              await tx.incomeRecord.create({
                data: {
                  budgetCategoryId: penaltyIncomeCategory.id,
                  amount: recoveryPenalty,
                  date: new Date(),
                  description: `Inst Loan recovery penalty - existing loan ${existingLoan.id.slice(0, 8)}`,
                  paymentMethod: "CASH",
                  branchId: account.branchId || undefined,
                  receivedByUserId: officerId,
                  status: "COMPLETED",
                  receiptNo: `ILRP-${Date.now()}`,
                  recordDate: new Date(),
                  notes: `Institution: ${app.institution?.institutionName || "N/A"} (${app.institutionId})`,
                },
              });

              // GL journal entry: Dr Cash, Cr Penalty Income
              const instPenGl = await tx.chartOfAccount.findFirst({ where: { accountCode: "401005", isActive: true } });
              const instPenCashGl = await tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } });
              if (instPenGl && instPenCashGl) {
                const jeNum = `JE-ILRP-${Date.now()}`;
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instPenCashGl.id, debitAmount: recoveryPenalty, creditAmount: 0, description: `Inst recovery penalty - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `ILRP-${existingLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instPenGl.id, debitAmount: 0, creditAmount: recoveryPenalty, description: `Inst recovery penalty - ${existingLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `ILRP-${existingLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.chartOfAccount.update({ where: { id: instPenCashGl.id }, data: buildAccountBalanceUpdate(instPenCashGl, { debitAmount: recoveryPenalty }) });
                await tx.chartOfAccount.update({ where: { id: instPenGl.id }, data: buildAccountBalanceUpdate(instPenGl, { creditAmount: recoveryPenalty }) });
              }
            }
          }

          // --- 4. Finalize ---
          await tx.vault.update({
            where: { id: branchVault.id },
            data: { balance: { decrement: amountGranted } },
          });
          await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: netDisbursement } },
          });

          const disbursementTx = await tx.transaction.create({
            data: {
              transactionRef: `INST-LN-DISB-${Date.now()}`,
              institutionId: app.institutionId,
              accountId: account.id,
              type: "LOAN_DISBURSEMENT",
              amount: netDisbursement,
              status: TransactionStatus.COMPLETED,
              description: `Institution Loan Disbursement: ${app.loanProduct.name}`,
              processedByUserId: officerId,
              channel: "INTERNAL",
              branchId: account.branchId || null,
            },
          });

          const instCalcResult = calculateLoanSchedule({
            amountGranted,
            interestRate: rawInterestRate,
            repaymentPeriodMonths: periodMonths,
            interestType:
              app.interestType === "REDUCING_BALANCE"
                ? "REDUCING_BALANCE"
                : "FLAT_RATE",
            gracePeriod: 0,
            disbursementDate: repaymentStartDate,
            interestPeriod: interestPeriod === "ANNUAL" ? "ANNUAL" : "MONTHLY",
            payments: [],
          });

          const totalInterest = instCalcResult.totalInterest;
          const totalAmountDue = instCalcResult.totalAmountRepaid;

          const updatedLoan = await tx.institutionLoan.update({
            where: { id: loan.id },
            data: {
              status: LoanStatus.DISBURSED,
              disbursementDate: new Date(),
              amountGranted,
              totalAmountDue,
              outstandingBalance: totalAmountDue,
              dueDate,
            },
          });

          if (instCalcResult.schedule && instCalcResult.schedule.length > 0) {
            await tx.institutionLoanRepaymentSchedule.createMany({
              data: instCalcResult.schedule.map((s) => ({
                loanId: loan.id,
                period: s.period,
                dueDate: s.dueDate,
                principalPayment: s.principalPayment,
                interestPayment: s.interestPayment,
                totalPayment: s.totalPayment,
                remainingBalance: s.remainingBalance,
                paidAmount: 0,
                status: "PENDING",
              })),
            });
          }

          await tx.institutionLoanLedgerTransaction.create({
            data: {
              loanId: loan.id,
              transactionType: "DISBURSEMENT",
              transactionDate: new Date(),
              voucherNo: disbursementTx.transactionRef,
              debitPrincipal: amountGranted,
              debitInterest: totalInterest,
              creditPrincipal: 0,
              creditInterest: 0,
              balancePrincipal: amountGranted,
              balanceInterest: totalInterest,
              balanceTotal: amountGranted + totalInterest,
            },
          });

          await tx.institutionLoanApplication.update({
            where: { id: applicationId },
            data: {
              stage: LoanStage.DISBURSED,
              status: LoanStatus.DISBURSED,
              approvedAmount: amountGranted,
            },
          });

          await tx.notification.create({
            data: {
              userId: (app.institution as any).user.id,
              type: "IN_APP",
              subject: "Institution Loan Disbursed",
              message: `The loan of UGX ${amountGranted.toLocaleString()} for ${app.institution.institutionName} has been disbursed to account ${account.accountNumber}. Net credited: UGX ${netDisbursement.toLocaleString()}.`,
              targetAddress: `/dashboard/institution-loan-applications`,
              status: "SENT",
              sentAt: new Date(),
            },
          });

          const { createComprehensiveLoanDisbursementJournalEntry } =
            await import("@/lib/journal-entries-extended");
          await createComprehensiveLoanDisbursementJournalEntry(
            {
              amountGranted,
              netDisbursement,
              processingFee: deductions.processingFee,
              insuranceFee: deductions.insurance,
              shareCapital: deductions.shares,
              loanRecoveryPrincipal: recoveryPrincipal || 0,
              loanRecoveryInterest: recoveryInterest || 0,
              description: `Institution Loan Disbursement - ${app.institution.institutionName} - ${app.loanProduct.name}`,
              reference: `INST-LN-DISB-${disbursementTx.id}`,
              transactionId: disbursementTx.id,
              userId: officerId,
              entryDate: new Date(),
              branchId: account.branchId ?? undefined,
              sourceAccountCode: "301004",
              ledgerAccountId: app.loanProduct.ledgerAccountId || undefined,
              interestAccountId: app.loanProduct.interestAccountId || undefined,
              penaltyAccountId: app.loanProduct.penaltyAccountId || undefined,
              feeAccountId: app.loanProduct.feeAccountId || undefined,
              shareAccountId: shareCapitalEquityAccountId,
            },
            tx,
          );

          // --- Record Deductions as IncomeRecords for Institutions ---
          // ✅ All child upserts use code-based where to avoid (name, kind, parentId) constraint errors
          if (deductions.processingFee > 0) {
            const loanParentCategory = await tx.budgetCategory.upsert({
              where: { code: "401000" },
              update: { name: "Loan related income" },
              create: {
                name: "Loan related income",
                code: "401000",
                kind: "INCOME",
                description:
                  "Loan related income including fees, interest and penalties",
                isActive: true,
              },
            });

            if (deductions.processingFee > 0) {
              const feeCategory = await tx.budgetCategory.upsert({
                where: { code: "401002" },
                update: {
                  parentId: loanParentCategory.id,
                  name: "Loan processing fees",
                },
                create: {
                  name: "Loan processing fees",
                  code: "401002",
                  kind: "INCOME",
                  description: "Fees collected for loan processing",
                  isActive: true,
                  parentId: loanParentCategory.id,
                },
              });

              await tx.incomeRecord.create({
                data: {
                  budgetCategoryId: feeCategory.id,
                  amount: deductions.processingFee,
                  date: new Date(),
                  recordDate: new Date(),
                  description: `Processing Fee - ${app.institution.institutionName} - ${updatedLoan.id.slice(0, 8)}`,
                  receivedByUserId: officerId,
                  branchId: account.branchId || undefined,
                  depositorName: app.institution.institutionName,
                  status: "COMPLETED",
                  paymentMethod: "BANK",
                  referenceNumber: `INST-FEE-${updatedLoan.id.slice(0, 8)}`,
                  notes: `Automated entry from institution loan disbursement deduction.`,
                },
              });

              // GL journal entry: Dr Cash, Cr Processing Fee Income
              const instFeeGl = await tx.chartOfAccount.findFirst({ where: { accountCode: "401002", isActive: true } });
              const instFeeCashGl = await tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } });
              if (instFeeGl && instFeeCashGl) {
                const jeNum = `JE-IPF-${Date.now()}`;
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instFeeCashGl.id, debitAmount: deductions.processingFee, creditAmount: 0, description: `Inst processing fee - ${updatedLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `IPF-${updatedLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.journalEntry.create({ data: { entryNumber: jeNum, accountId: instFeeGl.id, debitAmount: 0, creditAmount: deductions.processingFee, description: `Inst processing fee - ${updatedLoan.id.slice(0, 8)}`, entryDate: new Date(), reference: `IPF-${updatedLoan.id.slice(0, 8)}`, branchId: account.branchId || undefined, createdByUserId: officerId } });
                await tx.chartOfAccount.update({ where: { id: instFeeCashGl.id }, data: buildAccountBalanceUpdate(instFeeCashGl, { debitAmount: deductions.processingFee }) });
                await tx.chartOfAccount.update({ where: { id: instFeeGl.id }, data: buildAccountBalanceUpdate(instFeeGl, { creditAmount: deductions.processingFee }) });
              }
            }

          }

          if (app.institution.user?.email) {
            await sendTransactionAlertEmail(
              app.institution.user.email,
              app.institution.institutionName,
              "DISBURSEMENT",
              netDisbursement,
              account.balance + netDisbursement,
            );
          }

          return {
            loanId: loan.id,
            grossAmount: amountGranted,
            netDisbursement,
            totalDeductions,
            deductions,
            branchReserveDebited: netDisbursement,
          };
        },
        { timeout: 60000 },
      );

      return { ok: true, data: result };
    } catch (error: any) {
      console.error("🔥 LoanService.disburseInstitution error:", error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Calculate Repayment Split (Principal, Interest, Penalty)
   */
  static async calculateRepaymentSplit(
    loan: any,
    amount: number,
    explicitBreakdown?: {
      interestAmount?: number;
      penaltyAmount?: number;
      principalAmount?: number;
    },
  ) {
    if (
      explicitBreakdown &&
      (explicitBreakdown.interestAmount ||
        explicitBreakdown.penaltyAmount ||
        explicitBreakdown.principalAmount)
    ) {
      return {
        interest: explicitBreakdown.interestAmount || 0,
        penalty: explicitBreakdown.penaltyAmount || 0,
        principal: explicitBreakdown.principalAmount || 0,
      };
    }

    const isInstitution = !!loan.institutionId;
    let schedules = loan.schedules;

    if (!schedules) {
      if (isInstitution) {
        schedules = await db.$queryRaw<any[]>`
          SELECT * FROM "InstitutionLoanRepaymentSchedule"
          WHERE "loanId" = ${loan.id}
          ORDER BY "period" ASC
        `;
        schedules = schedules.map((s: any) => ({
          ...s,
          principalPayment:
            s.principalPayment || s.principal_payment || s.principalpayment,
          interestPayment:
            s.interestPayment || s.interest_payment || s.interestpayment,
          paidAmount: s.paidAmount || s.paid_amount || s.paidamount,
        }));
      } else {
        schedules = await db.loanRepaymentSchedule.findMany({
          where: { loanId: loan.id },
          orderBy: { period: "asc" },
        });
      }
    }

    const lastLedger = isInstitution
      ? await db.institutionLoanLedgerTransaction.findFirst({
          where: { loanId: loan.id },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        })
      : await db.loanLedgerTransaction.findFirst({
          where: { loanId: loan.id },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        });

    const remainingPrincipalBalance = Math.max(
      0,
      Number(
        lastLedger?.balancePrincipal ??
          ((loan.amountGranted || 0) - (loan.principalPaid || 0)),
      ),
    );
    const remainingInterestBalance = Math.max(
      0,
      Number(
        lastLedger?.balanceInterest ??
          Math.max(
            0,
            (loan.outstandingBalance || 0) - remainingPrincipalBalance,
          ),
      ),
    );

    let remaining = amount;
    let interestPortion = 0;
    let penaltyPortion = 0;
    let principalPortion = 0;

    const isOverdue =
      loan.status === "OVERDUE" ||
      (loan.dueDate && new Date(loan.dueDate) < new Date());

    if (isOverdue) {
      const penaltyConfig = await db.globalFeeConfiguration.findUnique({
        where: { key: "PENALTY_CONFIG" },
      });
      const tiers = penaltyConfig
        ? (penaltyConfig.value as unknown as PenaltyTier[])
        : DEFAULT_PENALTY_TIERS;

      const dueDate = new Date(loan.dueDate);
      const now = new Date();
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysOverdue > 0) {
        const overdueSchedules = (loan.schedules || []).filter(
          (s: any) => s.status !== "PAID" && new Date(s.dueDate) < now,
        );

        if (overdueSchedules.length > 0) {
          const installments = overdueSchedules.map((s: any) => ({
            period: s.period,
            principalArrears: s.principalPayment - (s.paidPrincipal || 0),
            interestArrears: s.interestPayment - (s.paidInterest || 0),
            daysOverdue: Math.floor(
              (now.getTime() - new Date(s.dueDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          }));
          penaltyPortion = calculateCompoundingPenalty(installments, tiers);
        } else {
          penaltyPortion = calculateSimplePenaltyEstimation(
            loan.outstandingBalance,
            daysOverdue,
            tiers,
          );
        }

        const totalPenaltyDue = penaltyPortion;
        const remainingPenaltyToPay = Math.max(
          0,
          totalPenaltyDue - (loan.penaltyPaid || 0),
        );
        penaltyPortion = Math.min(remaining, remainingPenaltyToPay);
        remaining -= penaltyPortion;
      }
    }

    const settlementThreshold =
      remainingPrincipalBalance + remainingInterestBalance;

    if (remaining >= settlementThreshold - 0.01) {
      interestPortion = remainingInterestBalance;
      principalPortion = remainingPrincipalBalance;
      return {
        interest: Number(interestPortion.toFixed(2)),
        penalty: Number(penaltyPortion.toFixed(2)),
        principal: Number(principalPortion.toFixed(2)),
      };
    }

    const remainingSchedules = Array.isArray(schedules)
      ? [...schedules]
          .filter((schedule: any) => schedule?.status !== "PAID")
          .sort(
            (a: any, b: any) => Number(a?.period || 0) - Number(b?.period || 0),
          )
      : [];

    for (const schedule of remainingSchedules) {
      if (remaining <= 0.009) break;

      const paidAmount = Number(schedule?.paidAmount || 0);
      const scheduledInterest = Number(schedule?.interestPayment || 0);
      const scheduledPrincipal = Number(schedule?.principalPayment || 0);

      const paidInterest = Math.min(paidAmount, scheduledInterest);
      const paidPrincipal = Math.min(
        Math.max(0, paidAmount - paidInterest),
        scheduledPrincipal,
      );

      const scheduleInterestRemaining = Math.max(
        0,
        scheduledInterest - paidInterest,
      );
      const schedulePrincipalRemaining = Math.max(
        0,
        scheduledPrincipal - paidPrincipal,
      );

      const interestApplied = Math.min(
        remaining,
        scheduleInterestRemaining,
        Math.max(0, remainingInterestBalance - interestPortion),
      );
      interestPortion += interestApplied;
      remaining -= interestApplied;

      const principalApplied = Math.min(
        remaining,
        schedulePrincipalRemaining,
        Math.max(0, remainingPrincipalBalance - principalPortion),
      );
      principalPortion += principalApplied;
      remaining -= principalApplied;
    }

    if (remaining > 0.009) {
      const extraInterest = Math.min(
        remaining,
        Math.max(0, remainingInterestBalance - interestPortion),
      );
      interestPortion += extraInterest;
      remaining -= extraInterest;
    }

    if (remaining > 0.009) {
      const extraPrincipal = Math.min(
        remaining,
        Math.max(0, remainingPrincipalBalance - principalPortion),
      );
      principalPortion += extraPrincipal;
      remaining -= extraPrincipal;
    }

    return {
      interest: Number(interestPortion.toFixed(2)),
      penalty: Number(penaltyPortion.toFixed(2)),
      principal: Number(principalPortion.toFixed(2)),
    };
  }

  /**
   * Repay Loan
   */
  static async repay(data: {
    loanId: string;
    amount: number;
    handlerId: string;
    handlerRole?: string;
    channel: string;
    sourceAccountId?: string;
    reference?: string;
    notes?: string;
    interestAmount?: number;
    penaltyAmount?: number;
    principalAmount?: number;
    transactionId?: string;
    branchId?: string;
  }) {
    try {
      const result = await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          let individualLoan = await tx.loan.findUnique({
            where: { id: data.loanId },
            include: {
              member: {
                include: {
                  accounts: { where: { status: "ACTIVE" } },
                  user: true,
                },
              },
              loanApplication: { include: { loanProduct: true } },
              schedules: {
                where: { status: { not: "PAID" } },
                orderBy: { period: "asc" },
                take: 1,
              },
            },
          });

          let institutionLoan = null;
          if (!individualLoan) {
            institutionLoan = await tx.institutionLoan.findUnique({
              where: { id: data.loanId },
              include: {
                institution: {
                  include: {
                    accounts: { where: { status: "ACTIVE" } },
                    user: true,
                  },
                },
                application: { include: { loanProduct: true } },
                schedules: {
                  where: { status: { not: "PAID" } },
                  orderBy: { period: "asc" },
                  take: 1,
                },
              },
            });
          }

          if (!individualLoan && !institutionLoan)
            throw new Error("Loan not found");

          const isInstitution = !!institutionLoan;
          const loan: any = individualLoan || institutionLoan;
          const loanProduct = isInstitution
            ? institutionLoan!.application.loanProduct
            : individualLoan!.loanApplication.loanProduct;
          const memberOrInstId = isInstitution
            ? institutionLoan!.institutionId
            : individualLoan!.memberId;
          const ownerName = isInstitution
            ? institutionLoan!.institution.institutionName
            : individualLoan!.member.user.name;
          const branchId =
            data.branchId ||
            loan.branchId ||
            (isInstitution
              ? institutionLoan!.institution.user.branchId
              : individualLoan!.member.user.branchId);

          if (data.amount > loan.outstandingBalance + 0.01) {
            throw new Error(
              `Repayment (${data.amount}) exceeds outstanding balance (${loan.outstandingBalance})`,
            );
          }

          // --- Relworx Integration: Mobile Money Collection ---
          if (data.channel?.toUpperCase() === "MOBILE_MONEY") {
            const transactionRef = `REPAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const msisdn = data.reference || (isInstitution ? institutionLoan!.institution.user.phone : individualLoan!.member.user.phone) || "";
            
            if (!msisdn) {
               throw new Error("Phone number is required for mobile money repayment.");
            }

            // Fetch a default account for the member/institution to satisfy Transaction requirements
            const defaultAccount = await tx.account.findFirst({
              where: {
                ...(isInstitution ? { institutionId: memberOrInstId } : { memberId: memberOrInstId }),
              }
            });

            if (!defaultAccount) {
              throw new Error("No associated SACCO account found for this member/institution.");
            }

            // Create Transaction record first in PENDING state
            const transaction = await tx.transaction.create({
              data: {
                transactionRef,
                ...(isInstitution ? { institutionId: memberOrInstId } : { memberId: memberOrInstId }),
                accountId: defaultAccount.id,
                type: "LOAN_REPAYMENT",
                amount: data.amount,
                status: TransactionStatus.PENDING,
                description: data.notes || `Loan repayment via Mobile Money`,
                processedByUserId: data.handlerId,
                channel: "MOBILE_MONEY",
                loanId: data.loanId,
                branchId,
              }
            });

            // Trigger Relworx STK Pull
            const { RelworxService } = await import("@/services/relworx.service");
            const relworxResponse = await RelworxService.requestPayment({
              msisdn,
              amount: data.amount,
              currency: "UGX",
              reference: transactionRef,
              description: data.notes || `Loan repayment request`,
            });

            if (!relworxResponse.success) {
              throw new Error(`Relworx Request Failed: ${relworxResponse.message}`);
            }

            // Return the pending transaction result
            return {
              ok: true,
              data: transaction,
              message: "Mobile money repayment initiated. Please confirm on your phone.",
              isPending: true
            };
          }

          if (data.sourceAccountId || data.channel === "ACCOUNT_DEBIT") {
            const sourceId = data.sourceAccountId;
            if (!sourceId)
              throw new Error("Source account ID required for account debit");

            const sourceAccount = await tx.account.findUnique({
              where: { id: sourceId },
            });
            if (!sourceAccount) throw new Error("Source account not found");
            if (sourceAccount.balance < data.amount - 0.01) {
              throw new Error(
                `Insufficient balance in source account. Available: UGX ${sourceAccount.balance.toLocaleString()}, Required: UGX ${data.amount.toLocaleString()}`,
              );
            }

            await tx.account.update({
              where: { id: sourceId },
              data: { balance: { decrement: data.amount } },
            });

            await tx.transaction.create({
              data: {
                transactionRef: `DEBIT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                ...(isInstitution
                  ? { institutionId: memberOrInstId }
                  : { memberId: memberOrInstId }),
                accountId: sourceId,
                type: "LOAN_REPAYMENT",
                amount: data.amount,
                status: TransactionStatus.COMPLETED,
                description:
                  data.notes || `Loan repayment deducted from account`,
                processedByUserId: data.handlerId,
                channel: "ACCOUNT_DEBIT",
                loanId: data.loanId,
                branchId,
              },
            });
          }

          const {
            interest: interestPortion,
            penalty: penaltyPortion,
            principal: principalPortion,
          } = await LoanService.calculateRepaymentSplit(loan, data.amount, {
            interestAmount: data.interestAmount,
            penaltyAmount: data.penaltyAmount,
            principalAmount: data.principalAmount,
          });

          if (!isInstitution) {
            const newBalance = Math.max(
              0,
              individualLoan!.outstandingBalance - data.amount,
            );

            await tx.loan.update({
              where: { id: data.loanId },
              data: {
                outstandingBalance: newBalance,
                amountPaid: { increment: data.amount },
                interestPaid: { increment: interestPortion },
                penaltyPaid: { increment: penaltyPortion },
                principalPaid: { increment: principalPortion },
                status: newBalance <= 0.01 ? LoanStatus.REPAID : undefined,
              },
            });

            const repayment = await tx.loanRepayment.create({
              data: {
                loanId: data.loanId,
                memberId: memberOrInstId,
                amount: data.amount,
                interestPaid: interestPortion,
                penaltyPaid: penaltyPortion,
                principalPaid: principalPortion,
                repaymentDate: new Date(),
                handlerUserId: data.handlerId,
                channel: data.channel,
                mobileMoneyRef: data.reference,
                transactionId: data.transactionId,
              },
            });

            let amountToAllocate = data.amount;
            const schedules = await tx.loanRepaymentSchedule.findMany({
              where: {
                loanId: data.loanId,
                status: { in: ["PENDING", "PARTIAL"] },
              },
              orderBy: { period: "asc" },
            });

            for (const schedule of schedules) {
              if (amountToAllocate <= 0) break;
              const canPay = schedule.totalPayment - schedule.paidAmount;
              const pay = Math.min(amountToAllocate, canPay);
              if (pay > 0) {
                await tx.loanRepaymentSchedule.update({
                  where: { id: schedule.id },
                  data: {
                    paidAmount: { increment: pay },
                    status:
                      schedule.paidAmount + pay >= schedule.totalPayment
                        ? "PAID"
                        : "PARTIAL",
                  },
                });
                amountToAllocate -= pay;
              }
            }

            const lastLedger = await tx.loanLedgerTransaction.findFirst({
              where: { loanId: data.loanId },
              orderBy: { transactionDate: "desc" },
            });
            const prevPrincipal =
              lastLedger?.balancePrincipal ?? individualLoan!.amountGranted;
            const prevInterest =
              lastLedger?.balanceInterest ??
              (individualLoan!.interestAmount || 0);

            await tx.loanLedgerTransaction.create({
              data: {
                loanId: data.loanId,
                transactionType: "REPAYMENT",
                transactionDate: new Date(),
                voucherNo: repayment.id.substring(0, 8).toUpperCase(),
                debitPrincipal: 0,
                debitInterest: 0,
                creditPrincipal: principalPortion,
                creditInterest: interestPortion,
                balancePrincipal: Math.max(0, prevPrincipal - principalPortion),
                balanceInterest: Math.max(0, prevInterest - interestPortion),
                balanceTotal:
                  Math.max(0, prevPrincipal - principalPortion) +
                  Math.max(0, prevInterest - interestPortion),
              },
            });
          } else {
            await tx.institutionLoan.update({
              where: { id: data.loanId },
              data: {
                outstandingBalance: { decrement: data.amount },
                amountPaid: { increment: data.amount },
                interestPaid: { increment: interestPortion },
                penaltyPaid: { increment: penaltyPortion },
                principalPaid: { increment: principalPortion },
                status:
                  institutionLoan!.outstandingBalance - data.amount <= 0.01
                    ? LoanStatus.REPAID
                    : undefined,
              },
            });

            await tx.institutionLoanRepayment.create({
              data: {
                loanId: data.loanId,
                institutionId: memberOrInstId,
                amount: data.amount,
                interestPaid: interestPortion,
                principalPaid: principalPortion,
                repaymentDate: new Date(),
                channel: data.channel,
                mobileMoneyRef: data.reference,
                description: `${data.notes || "Institution loan repayment"}${data.transactionId ? ` (Tx: ${data.transactionId})` : ""}`,
              },
            });

            let amountToAllocate = data.amount;
            const schedules =
              await tx.institutionLoanRepaymentSchedule.findMany({
                where: {
                  loanId: data.loanId,
                  status: { in: ["PENDING", "PARTIAL"] },
                },
                orderBy: { period: "asc" },
              });

            for (const schedule of schedules) {
              if (amountToAllocate <= 0) break;
              const canPay = schedule.totalPayment - schedule.paidAmount;
              const pay = Math.min(amountToAllocate, canPay);
              if (pay > 0) {
                await tx.institutionLoanRepaymentSchedule.update({
                  where: { id: schedule.id },
                  data: {
                    paidAmount: { increment: pay },
                    status:
                      schedule.paidAmount + pay >= schedule.totalPayment
                        ? "PAID"
                        : "PARTIAL",
                  },
                });
                amountToAllocate -= pay;
              }
            }

            const lastLedger =
              await tx.institutionLoanLedgerTransaction.findFirst({
                where: { loanId: data.loanId },
                orderBy: { transactionDate: "desc" },
              });
            const prevPrincipal =
              lastLedger?.balancePrincipal ?? institutionLoan!.amountGranted;
            const prevInterest =
              lastLedger?.balanceInterest ??
              institutionLoan!.totalAmountDue - institutionLoan!.amountGranted;

            await tx.institutionLoanLedgerTransaction.create({
              data: {
                loanId: data.loanId,
                transactionType: "REPAYMENT",
                transactionDate: new Date(),
                voucherNo: `INST-REPAY-${Date.now().toString().slice(-6)}`,
                debitPrincipal: 0,
                debitInterest: 0,
                creditPrincipal: principalPortion,
                creditInterest: interestPortion,
                balancePrincipal: Math.max(0, prevPrincipal - principalPortion),
                balanceInterest: Math.max(0, prevInterest - interestPortion),
                balanceTotal:
                  Math.max(0, prevPrincipal - principalPortion) +
                  Math.max(0, prevInterest - interestPortion),
              },
            });
          }

          // 5. Interest and Penalty are recorded via GL journal entry below
          // (createSplitLoanRepaymentJournalEntry handles Dr Cash, Cr Loan/Interest/Penalty)
          // No separate incomeRecord — GL is the canonical income record.

          // 6. Journal Entry
          const { createSplitLoanRepaymentJournalEntry } =
            await import("@/lib/journal-entries-extended");
          await createSplitLoanRepaymentJournalEntry(
            {
              principalAmount: principalPortion,
              interestAmount: interestPortion,
              penaltyAmount: penaltyPortion,
              description: `Loan Repayment - ${ownerName} - ${loan.id.slice(0, 8)}`,
              reference: data.reference || `LN-REPAY-${Date.now()}`,
              transactionId: data.loanId,
              userId: data.handlerId,
              entryDate: new Date(),
              branchId: data.branchId,
              cashAccountCode: data.channel === "CASH" ? "102001" : "102002",
              ledgerAccountId: loanProduct.ledgerAccountId || undefined,
              interestAccountId: loanProduct.interestAccountId || undefined,
              penaltyAccountId: loanProduct.penaltyAccountId || undefined,
            },
            tx,
          );

          // 6b. Vault/Float for CASH channel
          if (data.channel === "CASH" || data.channel === "Cash") {
            try {
              const userFloat = await tx.userFloat.findUnique({
                where: { userId: data.handlerId },
              });

              if (!userFloat || !userFloat.isActiveForDay) {
                throw new Error(
                  "Teller/Agent session is not active for today. Please start your session first.",
                );
              }

              await tx.userFloat.update({
                where: { id: userFloat.id },
                data: { balance: { decrement: data.amount } },
              });

              await tx.floatTransaction.create({
                data: {
                  floatId: userFloat.id,
                  type: "LOAN_REPAYMENT",
                  amount: -data.amount,
                  description: `Loan Repayment (Cash) - ${ownerName} - ${loan.id.slice(0, 8)}`,
                  performedByUserId: data.handlerId,
                },
              });

              if (loan.branchId) {
                const branchVault = await tx.vault.findFirst({
                  where: { branchId: loan.branchId, isActive: true },
                });
                if (branchVault) {
                  await tx.vault.update({
                    where: { id: branchVault.id },
                    data: { balance: { increment: data.amount } },
                  });

                  await tx.vaultTransaction.create({
                    data: {
                      vaultId: branchVault.id,
                      type: "LOAN_REPAYMENT",
                      amount: data.amount,
                      balanceBefore: branchVault.balance,
                      balanceAfter: branchVault.balance + data.amount,
                      description: `Loan Repayment received: ${ownerName}`,
                      performedByUserId: data.handlerId,
                    },
                  });
                }
              }
            } catch (vaultErr: any) {
              console.error(
                "Vault/Float accounting skipped or failed:",
                vaultErr,
              );
              throw vaultErr;
            }
          }

          // 7. In-App Notification
          const targetUserId = !isInstitution
            ? (loan as any).member?.userId
            : (loan as any).institution?.user?.id;
          if (targetUserId) {
            await tx.notification.create({
              data: {
                userId: targetUserId,
                type: "IN_APP",
                subject: "Loan Repayment Successful",
                message: `Repayment of UGX ${data.amount.toLocaleString()} for loan ${loan.id.slice(0, 8)} has been processed. New outstanding balance: UGX ${Math.max(0, loan.outstandingBalance - data.amount).toLocaleString()}.`,
              },
            });
          }

          return { success: true };
        },
      );

      try {
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/dashboard/loans");
        revalidatePath(`/dashboard/loans/${data.loanId}`);
        revalidatePath("/dashboard/loan-repayments");
        revalidatePath("/dashboard/accounts");
      } catch (revalErr) {
        console.warn("Revalidation skipped:", revalErr);
      }

      void bumpAccountingSyncState("Loan repayment posted");
      return { ok: true, data: result };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Fetch Loans with Filters
   */
  static async getLoans(
    filters: {
      memberId?: string;
      status?: LoanStatus | string;
      branchId?: string;
      allocatedTellerId?: string;
      take?: number;
      skip?: number;
      orderBy?: any;
    } = {},
  ) {
    try {
      await this.updateOverdueLoans();

      let statusFilter: any = filters.status;
      if (typeof filters.status === "string" && filters.status.includes(",")) {
        statusFilter = {
          in: filters.status.split(",").map((s) => s.trim()) as LoanStatus[],
        };
      }

      const [individualLoans, institutionLoans] = await Promise.all([
        db.loan.findMany({
          where: {
            ...(filters.memberId && { memberId: filters.memberId }),
            ...(statusFilter && { status: statusFilter }),
            ...(filters.branchId && { branchId: filters.branchId }),
            ...(filters.allocatedTellerId && {
              allocatedTellerId: filters.allocatedTellerId,
            }),
          },
          select: {
            id: true,
            loanApplicationId: true,
            memberId: true,
            amountGranted: true,
            interestRate: true,
            interestPeriod: true,
            totalAmountDue: true,
            outstandingBalance: true,
            dueDate: true,
            branchId: true,
            status: true,
            allocatedTellerId: true,
            disbursedByUserId: true,
            disbursementDate: true,
            amountPaid: true,
            principalPaid: true,
            interestPaid: true,
            interestAmount: true,
            penaltyCharged: true,
            penaltyPaid: true,
            createdAt: true,
            updatedAt: true,
            schedules: {
              select: {
                period: true,
                dueDate: true,
                principalPayment: true,
                interestPayment: true,
                totalPayment: true,
                paidAmount: true,
                status: true,
              },
              orderBy: { period: "asc" },
            },
            ledgerTransactions: {
              select: {
                balancePrincipal: true,
                balanceInterest: true,
                balanceTotal: true,
                transactionDate: true,
              },
              orderBy: { transactionDate: "desc" },
              take: 1,
            },
            member: { include: { user: true } },
            loanApplication: {
              select: {
                id: true,
                loanProduct: true,
                amountApplied: true,
                approvedAmount: true,
                approvalDate: true,
                loanOfficer: { select: { id: true, name: true, email: true } },
                approver: { select: { id: true, name: true, role: true } },
                applicant: { select: { id: true, name: true, role: true } },
                allocatedTeller: { select: { id: true, name: true, role: true } },
                applyLoanProcessingFee: true,
                loanProcessingFeePercentage: true,
                applyLoanInsurance: true,
                loanInsurancePercentage: true,
                applyShareDeduction: true,
                shareAmount: true,
                existingLoanBalance: true,
                repaymentPeriodMonths: true,
                repaymentStartDate: true,
                gracePeriod: true,
                disbursementMethod: true,
                modeOfRepayment: true,
              },
            },
            branch: true,
            allocatedTeller: { select: { id: true, name: true } },
          },
          orderBy: filters.orderBy || { createdAt: "desc" },
          take: filters.take || 50,
          skip: filters.skip || 0,
        }),
        !filters.memberId
          ? db.institutionLoan.findMany({
              where: {
                ...(statusFilter && { status: statusFilter }),
                ...(filters.allocatedTellerId && {
                  allocatedTellerId: filters.allocatedTellerId,
                }),
                ...(filters.branchId && {
                  institution: { user: { branchId: filters.branchId } },
                }),
              },
              include: {
                institution: { include: { user: true } },
                application: {
                  include: {
                    loanProduct: true,
                    loanOfficer: {
                      select: { id: true, name: true, email: true, role: true },
                    },
                  },
                },
                allocatedTeller: {
                  select: { id: true, name: true, email: true, role: true },
                },
              },
              orderBy: filters.orderBy || { createdAt: "desc" },
              take: filters.take || 50,
              skip: filters.skip || 0,
            })
          : Promise.resolve([]),
      ]);

      const mappedIndividualLoans = individualLoans.map((loan) => ({
        ...loan,
        ledgerBalancePrincipal:
          loan.ledgerTransactions?.[0]?.balancePrincipal ??
          Math.max(0, (loan.amountGranted || 0) - (loan.principalPaid || 0)),
        ledgerBalanceInterest:
          loan.ledgerTransactions?.[0]?.balanceInterest ??
          Math.max(0, (loan.interestAmount || 0) - (loan.interestPaid || 0)),
        ledgerOutstandingBalance:
          loan.ledgerTransactions?.[0]?.balanceTotal ?? loan.outstandingBalance,
        ledgerLastTransactionDate:
          loan.ledgerTransactions?.[0]?.transactionDate ?? null,
        remainingScheduleBreakdown: buildRemainingScheduleBreakdown(loan),
      }));

      const mappedInstitutionLoans = (institutionLoans as any[]).map(
        (loan) => ({
          ...loan,
          isInstitution: true,
          memberId: loan.institutionId,
          member: {
            id: loan.institutionId,
            memberNumber: loan.institution.institutionNumber,
            user: {
              name: loan.institution.institutionName,
              email: loan.institution.user?.email,
              phone: loan.institution.user?.phone,
            },
          },
          loanApplication: loan.application,
          loanApplicationId: loan.applicationId,
          remainingScheduleBreakdown: buildRemainingScheduleBreakdown(loan),
        }),
      );

      const combined = [...mappedIndividualLoans, ...mappedInstitutionLoans].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return { ok: true, data: combined.slice(0, filters.take || 50) };
    } catch (error: any) {
      console.error("🔥 LoanService.getLoans error:", error);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Update Overdue Loans Status
   */
  static async updateOverdueLoans() {
    try {
      const now = new Date();
      const result = await db.loan.updateMany({
        where: {
          status: "DISBURSED",
          dueDate: { lt: now },
          outstandingBalance: { gt: 0 },
        },
        data: { status: "OVERDUE" },
      });
      if (result.count > 0) {
        void bumpAccountingSyncState("Overdue loan statuses updated");
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Loan Statistics
   */
  static async getStatistics(
    filters: { branchId?: string; memberId?: string; officerId?: string } = {},
  ) {
    try {
      const where: any = {};
      if (filters.branchId) where.branchId = filters.branchId;
      if (filters.memberId) where.memberId = filters.memberId;
      if (filters.officerId) where.allocatedTellerId = filters.officerId;

      const instWhere: any = {};
      if (filters.branchId) {
        instWhere.institution = { user: { branchId: filters.branchId } };
      }
      if (filters.officerId) instWhere.allocatedTellerId = filters.officerId;
      if (filters.memberId) instWhere.institutionId = filters.memberId;

      const [
        totalLoans,
        activeLoans,
        overdueLoans,
        repaidLoans,
        aggregates,
        totalInstLoans,
        activeInstLoans,
        overdueInstLoans,
        repaidInstLoans,
        instAggregates,
      ] = await Promise.all([
        db.loan.count({ where }),
        db.loan.count({ where: { ...where, status: "DISBURSED" } }),
        db.loan.count({ where: { ...where, status: "OVERDUE" } }),
        db.loan.count({ where: { ...where, status: "REPAID" } }),
        db.loan.aggregate({
          where,
          _sum: {
            amountGranted: true,
            outstandingBalance: true,
            amountPaid: true,
            penaltyCharged: true,
          },
        }),
        db.institutionLoan.count({ where: instWhere }),
        db.institutionLoan.count({
          where: { ...instWhere, status: "DISBURSED" },
        }),
        db.institutionLoan.count({
          where: { ...instWhere, status: "OVERDUE" },
        }),
        db.institutionLoan.count({ where: { ...instWhere, status: "REPAID" } }),
        db.institutionLoan.aggregate({
          where: instWhere,
          _sum: {
            amountGranted: true,
            outstandingBalance: true,
            amountPaid: true,
            penaltyCharged: true,
          },
        }),
      ]);

      const totalDisbursed =
        (aggregates._sum.amountGranted || 0) +
        (instAggregates._sum.amountGranted || 0);
      const totalOutstanding =
        (aggregates._sum.outstandingBalance || 0) +
        (instAggregates._sum.outstandingBalance || 0);
      const totalRepaid =
        (aggregates._sum.amountPaid || 0) +
        (instAggregates._sum.amountPaid || 0);
      const totalPenaltyCharged =
        (aggregates._sum.penaltyCharged || 0) +
        (instAggregates._sum.penaltyCharged || 0);

      const combinedTotalLoans = totalLoans + totalInstLoans;
      const combinedActiveLoans = activeLoans + activeInstLoans;
      const combinedOverdueLoans = overdueLoans + overdueInstLoans;
      const combinedRepaidLoans = repaidLoans + repaidInstLoans;

      return {
        ok: true,
        data: {
          totalLoans: combinedTotalLoans,
          activeLoans: combinedActiveLoans,
          overdueLoans: combinedOverdueLoans,
          repaidLoans: combinedRepaidLoans,
          totalDisbursed,
          totalOutstanding,
          totalRepaid,
          totalPenaltyCharged,
          repaymentRate:
            totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0,
          defaultRate:
            combinedTotalLoans > 0
              ? (combinedOverdueLoans / combinedTotalLoans) * 100
              : 0,
        },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Loan Application Statistics
   */
  static async getApplicationStatistics(
    filters: { branchId?: string; officerId?: string } = {},
  ) {
    try {
      const where: any = {};
      if (filters.branchId) {
        where.member = { user: { branchId: filters.branchId } };
      }
      if (filters.officerId) {
        where.OR = [
          { applicantId: filters.officerId },
          { allocatedTellerId: filters.officerId },
          { loanOfficerId: filters.officerId },
        ];
      }

      const [statusCounts, disbursedAggregates] = await Promise.all([
        db.loanApplication.groupBy({
          by: ["status"],
          where,
          _count: true,
        }),
        db.loanApplication.aggregate({
          where: { ...where, status: "DISBURSED" },
          _sum: { approvedAmount: true },
        }),
      ]);

      const counts: Record<string, number> = {};
      let total = 0;
      statusCounts.forEach((item) => {
        counts[item.status] = item._count;
        total += item._count;
      });

      return {
        ok: true,
        data: {
          total,
          pending: counts["PENDING"] || 0,
          approved: counts["APPROVED"] || 0,
          rejected: counts["REJECTED"] || 0,
          underReview: counts["UNDER_REVIEW"] || 0,
          disbursed: counts["DISBURSED"] || 0,
          totalAmount: disbursedAggregates._sum.approvedAmount || 0,
          totalPending:
            (counts["PENDING"] || 0) + (counts["UNDER_REVIEW"] || 0),
        },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Helper to determine absolute interest period based on product name and config
   */
  static getEffectiveInterestPeriod(
    productName: string,
    configPeriod: string,
  ): "ANNUAL" | "MONTHLY" {
    const annualProducts = [
      "Commercial Loan",
      "Commercial/business",
      "School Fees",
      "Home Improvement",
      "Asset Acquisition",
      "Bodaboda",
      "Super Saver",
      "Starter Fund",
    ];

    if (
      configPeriod === "ANNUAL" ||
      (productName &&
        annualProducts.some((p) =>
          productName.toLowerCase().includes(p.toLowerCase()),
        ))
    ) {
      return "ANNUAL";
    }
    return "MONTHLY";
  }

  /**
   * Manually Apply Accrued Penalty to a Member Loan
   */
  static async applyManualPenalty(loanId: string, officerId: string) {
    try {
      return await db.$transaction(async (tx) => {
        const loan = await tx.loan.findUnique({
          where: { id: loanId },
          include: {
            loanApplication: { include: { loanProduct: true } },
            schedules: { orderBy: { period: "asc" } },
          },
        });

        if (!loan) throw new Error("Loan not found");
        if (
          loan.status === LoanStatus.REPAID ||
          loan.status === LoanStatus.WRITTEN_OFF
        ) {
          throw new Error("Cannot apply penalty to a closed/repaid loan");
        }

        const penaltySettingsLine = await tx.globalFeeConfiguration.findUnique({
          where: { key: "penalty_tiers" },
        });
        const tiers: PenaltyTier[] = penaltySettingsLine
          ? (penaltySettingsLine.value as any)
          : DEFAULT_PENALTY_TIERS;

        const now = new Date();
        const installments = loan.schedules
          .map((s: any) => ({
            period: s.period,
            principalArrears: s.principalPayment - (s.paidPrincipal || 0),
            interestArrears: s.interestPayment - (s.paidInterest || 0),
            daysOverdue: Math.floor(
              (now.getTime() - new Date(s.dueDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          }))
          .filter((i: any) => i.daysOverdue > 0);

        const calculation = calculateCompoundingPenalty(installments, tiers);
        const totalAccrued = calculation;
        const alreadyCharged = (loan as any).penaltyCharged || 0;
        const delta = totalAccrued - alreadyCharged;

        if (delta <= 1) {
          return {
            ok: true,
            message: "No new penalty to apply at this time.",
            amount: 0,
          };
        }

        const lastLedger = await tx.loanLedgerTransaction.findFirst({
          where: { loanId: loan.id },
          orderBy: { transactionDate: "desc" },
        });

        const newBalanceInterest = (lastLedger?.balanceInterest ?? 0) + delta;
        const newBalanceTotal = (lastLedger?.balanceTotal ?? 0) + delta;

        await tx.loanLedgerTransaction.create({
          data: {
            loanId: loan.id,
            transactionType: "PENALTY",
            transactionDate: new Date(),
            voucherNo: `PEN-${Date.now()}`,
            debitPrincipal: 0,
            debitInterest: delta,
            creditPrincipal: 0,
            creditInterest: 0,
            balancePrincipal:
              lastLedger?.balancePrincipal ?? loan.amountGranted,
            balanceInterest: newBalanceInterest,
            balanceTotal: newBalanceTotal,
          },
        });

        await tx.loan.update({
          where: { id: loanId },
          data: {
            penaltyCharged: { increment: delta },
            outstandingBalance: { increment: delta },
            lastPenaltyAppliedAt: new Date(),
            status: LoanStatus.OVERDUE,
          },
        });

        // ✅ Standardized: Use code 401005 under 401000 parent
        const loanParentCategory = await tx.budgetCategory.upsert({
          where: { code: "401000" },
          update: { name: "Loan related income" },
          create: {
            name: "Loan related income",
            code: "401000",
            kind: "INCOME",
            description:
              "Loan related income including fees, interest and penalties",
            isActive: true,
          },
        });

        const penaltyCategory = await tx.budgetCategory.upsert({
          where: { code: "401005" },
          update: {
            parentId: loanParentCategory.id,
            name: "Loan penalty paid",
            kind: "INCOME",
          },
          create: {
            name: "Loan penalty paid",
            code: "401005",
            kind: "INCOME",
            description: "Penalties charged on overdue loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: penaltyCategory.id,
            amount: delta,
            date: new Date(),
            description: `Compounding Penalty Applied - Loan ${loan.id.slice(0, 8)}`,
            paymentMethod: "OTHER",
            receivedByUserId: officerId,
            status: "COMPLETED",
            notes: `Accrued up to ${new Date().toLocaleDateString()}`,
            recordDate: new Date(),
          },
        });

        // ── Double-entry GL for penalty accrual ──
        await createLoanPenaltyAccrualJournalEntry(
          {
            amount: delta,
            description: `Compounding Penalty - Loan ${loan.id.slice(0, 8)}`,
            userId: officerId,
            entryDate: new Date(),
            branchId: loan.branchId ?? undefined,
          },
          tx,
        );

        void bumpAccountingSyncState("Loan penalty applied");
        return { ok: true, amount: delta };
      });
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Manually Apply Accrued Penalty to an Institution Loan
   */
  static async applyInstitutionManualPenalty(
    loanId: string,
    officerId: string,
  ) {
    try {
      return await db.$transaction(async (tx) => {
        const loan = await tx.institutionLoan.findUnique({
          where: { id: loanId },
          include: {
            application: { include: { loanProduct: true } },
            schedules: { orderBy: { period: "asc" } },
          },
        });

        if (!loan) throw new Error("Institution Loan not found");
        if (
          loan.status === LoanStatus.REPAID ||
          loan.status === LoanStatus.WRITTEN_OFF
        ) {
          throw new Error("Cannot apply penalty to a closed/repaid loan");
        }

        const penaltySettingsLine = await tx.globalFeeConfiguration.findUnique({
          where: { key: "penalty_tiers" },
        });
        const tiers: PenaltyTier[] = penaltySettingsLine
          ? (penaltySettingsLine.value as any)
          : DEFAULT_PENALTY_TIERS;

        const now = new Date();
        const installments = loan.schedules
          .map((s: any) => ({
            period: s.period,
            principalArrears:
              (s.principalPayment || s.principal_payment || 0) -
              (s.paidPrincipal || s.paid_principal || 0),
            interestArrears:
              (s.interestPayment || s.interest_payment || 0) -
              (s.paidInterest || s.paid_interest || 0),
            daysOverdue: Math.floor(
              (now.getTime() - new Date(s.dueDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          }))
          .filter((i: any) => i.daysOverdue > 0);

        const calculation = calculateCompoundingPenalty(installments, tiers);
        const totalAccrued = calculation;
        const alreadyCharged = (loan as any).penaltyCharged || 0;
        const delta = totalAccrued - alreadyCharged;

        if (delta <= 1) {
          return {
            ok: true,
            message: "No new penalty to apply at this time.",
            amount: 0,
          };
        }

        const lastLedger = await tx.institutionLoanLedgerTransaction.findFirst({
          where: { loanId: loan.id },
          orderBy: { transactionDate: "desc" },
        });

        const newBalanceInterest = (lastLedger?.balanceInterest ?? 0) + delta;
        const newBalanceTotal = (lastLedger?.balanceTotal ?? 0) + delta;

        await tx.institutionLoanLedgerTransaction.create({
          data: {
            loanId: loan.id,
            transactionType: "PENALTY",
            transactionDate: new Date(),
            voucherNo: `I-PEN-${Date.now()}`,
            debitPrincipal: 0,
            debitInterest: delta,
            creditPrincipal: 0,
            creditInterest: 0,
            balancePrincipal:
              lastLedger?.balancePrincipal ?? loan.amountGranted,
            balanceInterest: newBalanceInterest,
            balanceTotal: newBalanceTotal,
          },
        });

        await tx.institutionLoan.update({
          where: { id: loanId },
          data: {
            penaltyCharged: { increment: delta },
            outstandingBalance: { increment: delta },
            lastPenaltyAppliedAt: new Date(),
            status: LoanStatus.OVERDUE,
          },
        });

        // ✅ upsert by code
        const penaltyCategory = await tx.budgetCategory.upsert({
          where: { code: "400200" },
          update: {},
          create: {
            name: "Loan Penalties Income",
            code: "400200",
            kind: "INCOME",
            isActive: true,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: penaltyCategory.id,
            amount: delta,
            date: new Date(),
            description: `Inst Compounding Penalty Applied - Loan ${loan.id.slice(0, 8)}`,
            paymentMethod: "OTHER",
            receivedByUserId: officerId,
            status: "COMPLETED",
            notes: `Institution: ${loan.id.slice(0, 8)}. Accrued up to ${new Date().toLocaleDateString()}`,
            recordDate: new Date(),
          },
        });

        // ── Double-entry GL for institution penalty accrual ──
        await createLoanPenaltyAccrualJournalEntry(
          {
            amount: delta,
            description: `Inst Compounding Penalty - Loan ${loan.id.slice(0, 8)}`,
            userId: officerId,
                entryDate: new Date(),
                branchId: undefined,
              },
              tx,
            );

            void bumpAccountingSyncState("Institution loan penalty applied");
        return { ok: true, amount: delta };
      });
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }
}
