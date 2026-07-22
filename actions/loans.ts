// actions/loans.ts
"use server";

import { revalidatePath } from "next/cache";
import { LoanUpdateDTO } from "@/types/loan";
import { db } from "@/prisma/db";
import { LoanService } from "@/services/loan.service";
import {
  calculateLoanSchedule,
  type ScheduleFrequency,
} from "@/lib/loan-calculations";

// Fetch all active loans with relations
export async function getAllLoans() {
  try {
    const loans = await db.loan.findMany({
      include: {
        loanApplication: {
          select: {
            id: true,
            purpose: true,
            applicationDate: true,
            allocatedTeller: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        disbursedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        repayments: {
          select: {
            id: true,
            amount: true,
            repaymentDate: true,
            handler: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            repaymentDate: "desc",
          },
        },
        _count: {
          select: {
            repayments: true,
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    // Update overdue loans
    const overdueLoans = loans.filter(
      (loan) =>
        new Date() > loan.dueDate &&
        loan.outstandingBalance > 0 &&
        loan.status !== "OVERDUE",
    );

    if (overdueLoans.length > 0) {
      await db.loan.updateMany({
        where: {
          id: {
            in: overdueLoans.map((loan) => loan.id),
          },
        },
        data: {
          status: "OVERDUE",
        },
      });

      // Refresh the data after updating overdue loans
      return getAllLoans();
    }

    return loans;
  } catch (error) {
    console.error("Error fetching loans:", error);
    return [];
  }
}

// Fetch loans by member ID
export async function getLoansByMemberId(memberId: string) {
  try {
    const loans = await db.loan.findMany({
      where: { memberId },
      include: {
        loanApplication: {
          select: {
            id: true,
            purpose: true,
            applicationDate: true,
            loanProduct: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                repaymentPeriodDays: true,
              },
            },
            allocatedTeller: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        disbursedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        repayments: {
          select: {
            id: true,
            amount: true,
            repaymentDate: true,
            handler: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            repaymentDate: "desc",
          },
        },
        _count: {
          select: {
            repayments: true,
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    // Update overdue loans if needed
    const overdueLoans = loans.filter(
      (loan) =>
        new Date() > loan.dueDate &&
        loan.outstandingBalance > 0 &&
        loan.status !== "OVERDUE",
    );

    if (overdueLoans.length > 0) {
      await db.loan.updateMany({
        where: {
          id: {
            in: overdueLoans.map((loan) => loan.id),
          },
        },
        data: {
          status: "OVERDUE",
        },
      });

      // Refresh data after updating overdue loans
      return getLoansByMemberId(memberId);
    }

    return loans;
  } catch (error) {
    console.error("Error fetching member loans:", error);
    return [];
  }
}
// Fetch single loan by ID
export async function getLoanById(id: string) {
  try {
    const loan = await db.loan.findUnique({
      where: { id },
      include: {
        loanApplication: {
          include: {
            loanProduct: true,
            allocatedTeller: {
              select: {
                id: true,
                name: true,
              },
            },
            applicant: {
              select: {
                name: true,
                role: true,
              },
            },
            approver: {
              select: {
                name: true,
                role: true,
              },
            },
          },
        },
        member: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        disbursedByUser: true,
        branch: true,
        repayments: {
          include: {
            handler: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: {
            repaymentDate: "desc",
          },
        },
        schedules: {
          orderBy: {
            period: "asc",
          },
        },
      },
    });

    // Update status if overdue
    if (
      loan &&
      new Date() > loan.dueDate &&
      loan.outstandingBalance > 0 &&
      loan.status !== "OVERDUE"
    ) {
      await db.loan.update({
        where: { id },
        data: { status: "OVERDUE" },
      });

      return getLoanById(id); // Fetch updated loan
    }

    return loan;
  } catch (error) {
    console.error("Error fetching loan:", error);
    return null;
  }
}

// Update loan
export async function updateLoan(data: LoanUpdateDTO) {
  try {
    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate;
    }

    const loan = await db.loan.update({
      where: { id: data.id },
      data: updateData,
      include: {
        member: {
          include: {
            user: true,
          },
        },
        disbursedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
        branch: true,
      },
    });

    revalidatePath("/dashboard/loans");
    revalidatePath(`/dashboard/loans/${data.id}`);
    return {
      error: null,
      data: loan,
    };
  } catch (error) {
    console.error("Error updating loan:", error);
    return {
      error: "Failed to update loan. Please try again.",
      data: null,
    };
  }
}

// Get loan statistics
export async function getLoanStatistics() {
  try {
    const [
      totalLoans,
      activeLoans,
      overdueLoans,
      repaidLoans,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
    ] = await Promise.all([
      db.loan.count(),
      db.loan.count({
        where: { status: "DISBURSED" },
      }),
      db.loan.count({
        where: { status: "OVERDUE" },
      }),
      db.loan.count({
        where: { status: "REPAID" },
      }),
      db.loan.aggregate({
        _sum: { amountGranted: true },
      }),
      db.loan.aggregate({
        _sum: { outstandingBalance: true },
        where: { status: { in: ["DISBURSED", "OVERDUE"] } },
      }),
      db.loan.aggregate({
        _sum: { amountPaid: true },
      }),
    ]);

    // Calculate loan performance metrics
    const repaymentRate = totalLoans > 0 ? (repaidLoans / totalLoans) * 100 : 0;
    const defaultRate = totalLoans > 0 ? (overdueLoans / totalLoans) * 100 : 0;

    return {
      totalLoans,
      activeLoans,
      overdueLoans,
      repaidLoans,
      totalDisbursed: totalDisbursed._sum.amountGranted || 0,
      totalOutstanding: totalOutstanding._sum.outstandingBalance || 0,
      totalRepaid: totalRepaid._sum.amountPaid || 0,
      repaymentRate: Math.round(repaymentRate * 100) / 100,
      defaultRate: Math.round(defaultRate * 100) / 100,
    };
  } catch (error) {
    console.error("Error fetching loan statistics:", error);
    return {
      totalLoans: 0,
      activeLoans: 0,
      overdueLoans: 0,
      repaidLoans: 0,
      totalDisbursed: 0,
      totalOutstanding: 0,
      totalRepaid: 0,
      repaymentRate: 0,
      defaultRate: 0,
    };
  }
}

// Get overdue loans for follow-up
export async function getOverdueLoans() {
  try {
    const loans = await db.loan.findMany({
      where: {
        OR: [
          { status: "OVERDUE" },
          {
            AND: [
              { status: "DISBURSED" },
              { dueDate: { lt: new Date() } },
              { outstandingBalance: { gt: 0 } },
            ],
          },
        ],
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    // Update status for newly overdue loans
    const newlyOverdue = loans.filter(
      (loan) =>
        loan.status !== "OVERDUE" &&
        new Date() > loan.dueDate &&
        loan.outstandingBalance > 0,
    );

    if (newlyOverdue.length > 0) {
      await db.loan.updateMany({
        where: {
          id: { in: newlyOverdue.map((loan) => loan.id) },
        },
        data: { status: "OVERDUE" },
      });
    }

    return loans;
  } catch (error) {
    console.error("Error fetching overdue loans:", error);
    return [];
  }
}

// Get loans due in next X days
export async function getLoansDueSoon(days: number = 30) {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const loans = await db.loan.findMany({
      where: {
        status: "DISBURSED",
        dueDate: {
          gte: new Date(),
          lte: futureDate,
        },
        outstandingBalance: { gt: 0 },
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    return loans;
  } catch (error) {
    console.error("Error fetching loans due soon:", error);
    return [];
  }
}

// Mark loan as fully repaid
export async function markLoanAsRepaid(loanId: string) {
  try {
    const loan = await db.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      return {
        error: "Loan not found",
        data: null,
      };
    }

    if (loan.outstandingBalance > 0) {
      return {
        error: "Cannot mark loan as repaid while outstanding balance exists",
        data: null,
      };
    }

    const updatedLoan = await db.loan.update({
      where: { id: loanId },
      data: {
        status: "REPAID",
        outstandingBalance: 0,
      },
    });

    revalidatePath("/dashboard/loans");
    revalidatePath(`/dashboard/loans/${loanId}`);

    return {
      error: null,
      data: updatedLoan,
    };
  } catch (error) {
    console.error("Error marking loan as repaid:", error);
    return {
      error: "Failed to update loan status. Please try again.",
      data: null,
    };
  }
}

import { LoanStatus, TransactionStatus, TransactionType } from "@prisma/client";

// Helper function to check if loan can be disbursed
export async function canDisburseLoan(loanId: string) {
  try {
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: {
          include: {
            accounts: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    if (!loan) {
      return {
        canDisburse: false,
        reason: "Loan not found",
      };
    }

    if (loan.status === "DISBURSED") {
      return {
        canDisburse: false,
        reason: "Loan has already been disbursed",
      };
    }

    if (loan.status === "REPAID") {
      return {
        canDisburse: false,
        reason: "Loan has been repaid",
      };
    }

    if (loan.member.accounts.length === 0) {
      return {
        canDisburse: false,
        reason: "Member has no active account",
      };
    }

    return {
      canDisburse: true,
      reason: null,
      accounts: loan.member.accounts,
    };
  } catch (error) {
    console.error("Error checking loan disbursement eligibility:", error);
    return {
      canDisburse: false,
      reason: "Error checking eligibility",
    };
  }
}

// Get disbursement summary before processing
export async function getLoanDisbursementSummary(
  loanId: string,
  processingFeePercentage: number = 2,
) {
  try {
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        member: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
              },
            },
          },
        },
      },
    });

    if (!loan) {
      return null;
    }

    const processingFee = (loan.amountGranted * processingFeePercentage) / 100;
    const netDisbursement = loan.amountGranted - processingFee;

    return {
      loanId: loan.id,
      memberName: loan.member.user.name,
      loanProduct: loan.loanApplication.loanProduct.name,
      principalAmount: loan.amountGranted,
      interestRate: loan.interestRate,
      totalAmountDue: loan.totalAmountDue,
      processingFeePercentage,
      processingFee,
      netDisbursement,
      dueDate: loan.dueDate,
      availableAccounts: loan.member.accounts.map((acc) => ({
        id: acc.id,
        accountNumber: acc.accountNumber,
        type: acc.accountType.name,
        currentBalance: acc.balance,
      })),
    };
  } catch (error) {
    console.error("Error getting disbursement summary:", error);
    return null;
  }
}
// Add these improved functions to your loans.ts file

/**
 * IMPROVED: Disburse loan with processing fees
 * This function properly credits the member's account
 */
export async function disburseLoanWithFees(data: {
  loanId: string;
  userId: string;
  processingFeePercentage?: number;
  memberAccountId?: string;
}) {
  try {
    // We need to find the application associated with this loan
    const loan = await db.loan.findUnique({
      where: { id: data.loanId },
      select: { loanApplicationId: true },
    });

    if (!loan) throw new Error("Loan not found");

    const result = await LoanService.disburse(
      loan.loanApplicationId,
      data.userId,
      {
        processingFeePercentage: data.processingFeePercentage,
        memberAccountId: data.memberAccountId,
      },
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    revalidatePath("/dashboard/loans");
    revalidatePath(`/dashboard/loans/${data.loanId}`);
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/income");

    const disbursementData = result.data as any;
    return {
      error: null,
      data: result,
      message: `Loan disbursed successfully! Net amount: UGX ${disbursementData.netDisbursement.toLocaleString()}, Processing fee: UGX ${disbursementData.processingFee.toLocaleString()}. Account ${disbursementData.accountCredited} credited.`,
    };
  } catch (error) {
    console.error("Error disbursing loan:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to disburse loan",
      data: null,
      message: null,
    };
  }
}

/**
 * IMPROVED: Create loan from approved application
 * This ensures the loan is created with the correct initial status
 */
export async function createLoanFromApplication(
  applicationId: string,
  userId: string,
) {
  try {
    const result = await db.$transaction(async (tx: any) => {
      // Get the approved loan application
      const application = await tx.loanApplication.findUnique({
        where: { id: applicationId },
        include: {
          loanProduct: true,
          member: true,
        },
      });

      if (!application) {
        throw new Error("Loan application not found");
      }

      if (
        application.status !== "APPROVED" ||
        application.stage !== "APPROVED"
      ) {
        throw new Error(
          "Loan application must be approved before creating loan",
        );
      }

      if (!application.approvedAmount) {
        throw new Error("Approved amount not set");
      }

      // Check if loan already exists for this application
      const existingLoan = await tx.loan.findUnique({
        where: { loanApplicationId: applicationId },
      });

      if (existingLoan) {
        throw new Error("Loan already exists for this application");
      }

      // Calculate loan details
      const principal = application.approvedAmount;
      const interestRate =
        application.interestRateOverride ||
        application.loanProduct.interestRate;

      const repaymentPeriodMonths =
        application.repaymentPeriodMonths ||
        Math.ceil((application.loanProduct.repaymentPeriodDays || 30) / 30);

      const interestType = (application.interestType ||
        application.loanProduct.interestType) as any;
      const interestPeriod = (application.interestPeriod ||
        application.loanProduct.interestPeriod) as any;
      const gracePeriodDays = application.gracePeriod || 0;

      const disbursementDate = new Date();
      const startDate = application.repaymentStartDate
        ? new Date(application.repaymentStartDate)
        : new Date(
            disbursementDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000,
          );

      // Calculate interest and total due using the standard robust function
      const scheduleFrequency =
        (application.modeOfRepayment as ScheduleFrequency) || "MONTHLY";
      const calcResult = calculateLoanSchedule({
        amountGranted: principal,
        interestRate: interestRate,
        repaymentPeriodMonths: repaymentPeriodMonths,
        interestType:
          interestType === "REDUCING_BALANCE"
            ? "REDUCING_BALANCE"
            : "FLAT_RATE",
        gracePeriod: 0, // Grace period already included in startDate calculation
        disbursementDate: startDate,
        interestPeriod: interestPeriod === "ANNUAL" ? "ANNUAL" : "MONTHLY",
        payments: [],
        scheduleFrequency,
      });

      const totalInterest = calcResult.totalInterest;
      const totalAmountDue = principal + totalInterest;

      // Calculate due date based on the final item in the schedule
      // If schedule is empty for some reason, fallback to basic math
      let dueDate = new Date();
      if (calcResult.schedule && calcResult.schedule.length > 0) {
        dueDate = calcResult.schedule[calcResult.schedule.length - 1].dueDate;
      } else {
        dueDate.setMonth(dueDate.getMonth() + repaymentPeriodMonths);
      }

      // Create the loan with PENDING status (ready for disbursement)
      const loan = await tx.loan.create({
        data: {
          loanApplicationId: applicationId,
          memberId: application.memberId,
          amountGranted: principal,
          interestRate: interestRate,
          totalAmountDue: totalAmountDue,
          amountPaid: 0,
          outstandingBalance: totalAmountDue,
          disbursementDate: new Date(), // Will be updated on actual disbursement
          dueDate: dueDate,
          status: "PENDING", // Ready for disbursement
          disbursedByUserId: userId,
          allocatedTellerId: application.allocatedTellerId,
          branchId: application.member.user?.branchId,
          interestAmount: totalInterest,
          interestType:
            application.interestType || application.loanProduct.interestType,
          interestPeriod:
            application.interestPeriod ||
            application.loanProduct.interestPeriod,
        },
      });

      // Insert initial schedule into DB
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

      return loan;
    });

    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-applications");

    return {
      error: null,
      data: result,
      message: "Loan created successfully. Ready for disbursement.",
    };
  } catch (error) {
    console.error("Error creating loan:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create loan",
      data: null,
      message: null,
    };
  }
}

/**
 * IMPROVED: Process loan repayment
 * Handles both cash and account-based repayments
 */
export async function processLoanRepayment(data: {
  loanId: string;
  memberId: string;
  amount: number;
  handlerUserId: string;
  channel?: string;
  mobileMoneyRef?: string;
  sourceAccountId?: string;
}) {
  try {
    const result = await db.$transaction(async (tx: any) => {
      // 1. Get the loan
      const loan = await tx.loan.findUnique({
        where: { id: data.loanId },
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!loan) {
        throw new Error("Loan not found");
      }

      if (loan.memberId !== data.memberId) {
        throw new Error("Loan does not belong to this member");
      }

      if (loan.status === "REPAID") {
        throw new Error("Loan is already fully repaid");
      }

      if (data.amount > loan.outstandingBalance) {
        throw new Error(
          `Repayment amount (${data.amount}) exceeds outstanding balance (${loan.outstandingBalance})`,
        );
      }

      // 2. If paying from account, debit the account
      if (data.sourceAccountId) {
        const sourceAccount = await tx.account.findUnique({
          where: { id: data.sourceAccountId },
        });

        if (!sourceAccount) {
          throw new Error("Source account not found");
        }

        if (sourceAccount.memberId !== data.memberId) {
          throw new Error("Source account does not belong to member");
        }

        if (sourceAccount.balance < data.amount) {
          throw new Error("Insufficient balance in source account");
        }

        // Debit the account
        await tx.account.update({
          where: { id: data.sourceAccountId },
          data: {
            balance: {
              decrement: data.amount,
            },
          },
        });

        // Create transaction for the withdrawal
        const withdrawalRef = `LOAN-REPAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        await tx.transaction.create({
          data: {
            transactionRef: withdrawalRef,
            memberId: data.memberId,
            accountId: data.sourceAccountId,
            type: "LOAN_REPAYMENT",
            amount: data.amount,
            status: "COMPLETED",
            description: `Loan repayment deducted from account`,
            transactionDate: new Date(),
            processedByUserId: data.handlerUserId,
            loanId: data.loanId,
            channel: "ACCOUNT_DEBIT",
          },
        });
      }

      // 3. Create loan repayment record
      const repayment = await tx.loanRepayment.create({
        data: {
          loanId: data.loanId,
          memberId: data.memberId,
          amount: data.amount,
          repaymentDate: new Date(),
          handlerUserId: data.handlerUserId,
          channel: data.sourceAccountId
            ? "ACCOUNT_DEBIT"
            : data.channel || "CASH",
          mobileMoneyRef: data.mobileMoneyRef,
        },
      });

      // 4. Update loan status
      const newAmountPaid = loan.amountPaid + data.amount;
      const newOutstandingBalance = loan.outstandingBalance - data.amount;
      const isFullyRepaid = newOutstandingBalance <= 0;

      const updatedLoan = await tx.loan.update({
        where: { id: data.loanId },
        data: {
          amountPaid: newAmountPaid,
          outstandingBalance: Math.max(0, newOutstandingBalance),
          status: isFullyRepaid
            ? "REPAID"
            : loan.status === "OVERDUE"
              ? "OVERDUE"
              : "DISBURSED",
        },
      });

      // 5. Create audit log
      await tx.auditLog.create({
        data: {
          userId: data.handlerUserId,
          action: "LOAN_REPAYMENT",
          entityType: "Loan",
          entityId: data.loanId,
          details: `Loan repayment of UGX ${data.amount.toLocaleString()}. Outstanding: UGX ${newOutstandingBalance.toLocaleString()}`,
          timestamp: new Date(),
        },
      });

      // 6. Create notification
      await tx.notification.create({
        data: {
          userId: loan.member.userId,
          type: "IN_APP",
          subject: "Loan Repayment Received",
          message: `Payment of UGX ${data.amount.toLocaleString()} received. ${
            isFullyRepaid
              ? "Congratulations! Your loan is now fully repaid."
              : `Outstanding balance: UGX ${newOutstandingBalance.toLocaleString()}`
          }`,
          sentAt: new Date(),
        },
      });

      return {
        repayment,
        updatedLoan,
        isFullyRepaid,
      };
    });

    revalidatePath("/dashboard/loans");
    revalidatePath(`/dashboard/loans/${data.loanId}`);
    revalidatePath("/dashboard/accounts");

    return {
      error: null,
      data: result,
      message: result.isFullyRepaid
        ? "Loan fully repaid!"
        : `Repayment successful. Outstanding: UGX ${result.updatedLoan.outstandingBalance.toLocaleString()}`,
    };
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to process repayment",
      data: null,
      message: null,
    };
  }
}
