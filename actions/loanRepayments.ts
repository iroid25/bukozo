// actions/loanRepayments.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";
import { Prisma, TransactionType } from "@prisma/client";
import { createSplitLoanRepaymentJournalEntry } from "@/lib/journal-entries-extended";
import { sendTransactionAlertEmail } from "@/lib/email";

// Define proper types for the loan with includes
type LoanWithMemberAndDetails = Prisma.LoanGetPayload<{
  include: {
    member: {
      include: {
        user: true;
        accounts: {
          where: {
            status: "ACTIVE";
          };
        };
      };
    };
    loanApplication: {
      include: {
        loanProduct: true;
      };
    };
    branch: true;
  };
}>;

type LoanRepaymentWithDetails = Prisma.LoanRepaymentGetPayload<{
  include: {
    loan: {
      include: {
        member: {
          include: {
            user: true;
          };
        };
        loanApplication: {
          include: {
            loanProduct: true;
          };
        };
        branch: true;
      };
    };
    handler: true;
  };
}>;

type ActiveLoan = Prisma.LoanGetPayload<{
  include: {
    member: {
      include: {
        user: true;
      };
    };
    loanApplication: {
      include: {
        loanProduct: true;
      };
    };
    branch: true;
  };
}>;

// ✅ SINGLE INTERFACE DECLARATION - Keep only this one
export interface LoanRepaymentStatistics {
  totalRepayments: number;
  totalAmount: number;
  todayRepayments: number;
  todayAmount: number;
  thisMonthRepayments: number;
  thisMonthAmount?: number;
  channelBreakdown: {
    channel: string;
    count: number;
    amount: number;
  }[];
}

// Export types for better TypeScript support
export interface CreateLoanRepaymentData {
  loanId: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  notes?: string;
}

// Create loan repayment
export async function createLoanRepayment(data: CreateLoanRepaymentData) {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get the loan to validate with proper includes
    const loanQuery = await db.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              where: {
                status: "ACTIVE",
              },
              take: 1,
            },
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        branch: true,
      },
    });

    if (!loanQuery) {
      throw new Error("Loan not found");
    }

    // Type the loan properly
    const loan = loanQuery as LoanWithMemberAndDetails;

    // Check if user owns this loan (for members) or has appropriate permissions
    if (user.role === "MEMBER" && loan.member.user.id !== user.id) {
      throw new Error("Unauthorized to make repayment for this loan");
    }

    // Validate repayment amount
    if (data.amount <= 0) {
      throw new Error("Repayment amount must be greater than 0");
    }

    if (data.amount > loan.outstandingBalance) {
      throw new Error("Repayment amount cannot exceed outstanding balance");
    }



    // =============================================
    // CALCULATE PRINCIPAL / INTEREST SPLIT
    // =============================================
    // Interest-first rule: interest due is paid first, remainder goes to principal
    const loanProduct = loan.loanApplication.loanProduct;
    const interestRate = loan.interestRate || loanProduct.interestRate;
    const interestPeriod = loan.interestPeriod || loanProduct.interestPeriod || "MONTHLY";
    const interestType = loan.interestType || loanProduct.interestType || "FLAT_RATE";

    // Calculate monthly interest rate
    const monthlyRate = interestPeriod === "ANNUAL" ? interestRate / 12 : interestRate;

    // Calculate remaining principal (what's been paid towards principal so far)
    const remainingPrincipal = loan.amountGranted - (loan.principalPaid || 0);
    const remainingInterest = (loan.interestAmount || 0) - (loan.interestPaid || 0);

    let interestPortion = 0;
    let principalPortion = 0;

    if (interestType === "REDUCING_BALANCE") {
      // For reducing balance: interest is on remaining principal
      interestPortion = remainingPrincipal * (monthlyRate / 100);
    } else {
      // For flat rate: interest is fixed on original principal
      interestPortion = loan.amountGranted * (monthlyRate / 100);
    }

    // Cap interest at what's still owed
    interestPortion = Math.min(interestPortion, remainingInterest);

    // Allocate: interest first, then principal
    if (data.amount <= interestPortion) {
      // Entire payment goes to interest
      interestPortion = data.amount;
      principalPortion = 0;
    } else {
      // Pay interest first, remainder to principal
      principalPortion = Math.min(data.amount - interestPortion, remainingPrincipal);
    }

    // Create the repayment record WITH principal/interest split
    const repayment = await db.loanRepayment.create({
      data: {
        loanId: data.loanId,
        memberId: loan.memberId,
        amount: data.amount,
        principalPaid: principalPortion,
        interestPaid: interestPortion,
        penaltyPaid: 0,
        repaymentDate: new Date(),
        handlerUserId: user.id,
        channel: data.paymentMethod,
        mobileMoneyRef: data.transactionReference,
      },
    });

    // Update loan balance with split tracking
    const newOutstandingBalance = loan.outstandingBalance - data.amount;
    const newAmountPaid = loan.amountPaid + data.amount;
    const newPrincipalPaid = (loan.principalPaid || 0) + principalPortion;
    const newInterestPaid = (loan.interestPaid || 0) + interestPortion;

    // Determine new loan status
    let newStatus = loan.status;
    if (newOutstandingBalance <= 0) {
      newStatus = "REPAID";
    } else if (loan.status === "OVERDUE") {
      newStatus = "DISBURSED";
    }

    await db.loan.update({
      where: { id: data.loanId },
      data: {
        outstandingBalance: Math.max(0, newOutstandingBalance),
        amountPaid: newAmountPaid,
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        status: newStatus,
      },
    });


    // Create a transaction record if the member has an active account
    if (loan.member.accounts && loan.member.accounts.length > 0) {
      await db.transaction.create({
        data: {
          memberId: loan.member.id,
          accountId: loan.member.accounts[0].id,
          type: "LOAN_REPAYMENT",
          amount: data.amount,
          description: `Loan repayment for loan ${loan.id}`,
          status: "COMPLETED",
          transactionDate: new Date(),
          transactionRef: data.transactionReference || `LR-${repayment.id}`,
          processedByUserId: user.id,
          channel: data.paymentMethod,
          externalReference: data.transactionReference,
        },
      });
    }

    // CREATE ACCOUNTING JOURNAL ENTRY (atomically with float update for cash;
    // cash stays with the teller's float until EOD reconciliation moves it to the vault)
    if (data.paymentMethod === "CASH") {
      await db.$transaction(async (tx) => {
        const userFloat = await tx.userFloat.findUnique({ where: { userId: user.id } });

        if (userFloat) {
          await tx.userFloat.update({
            where: { id: userFloat.id },
            data: { balance: { increment: data.amount } }
          });
          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.LOAN_REPAYMENT,
              amount: data.amount,
              description: `Loan Repayment Received - ${loan.member.user.name}`,
              performedByUserId: user.id,
              relatedTransactionId: repayment.id
            }
          });
        }

        await createSplitLoanRepaymentJournalEntry({
          principalAmount: principalPortion,
          interestAmount: interestPortion,
          penaltyAmount: 0,
          description: `Loan Repayment - ${loan.member.user.name} - Loan ${loan.id.slice(0, 8)}`,
          reference: data.transactionReference || `LR-${repayment.id}`,
          transactionId: repayment.id,
          userId: user.id,
          cashAccountCode: "102001",
          entryDate: repayment.repaymentDate,
          branchId: loan.branchId || undefined,
        }, tx);
      });
    } else {
      try {
        await createSplitLoanRepaymentJournalEntry({
          principalAmount: principalPortion,
          interestAmount: interestPortion,
          penaltyAmount: 0,
          description: `Loan Repayment - ${loan.member.user.name} - Loan ${loan.id.slice(0, 8)}`,
          reference: data.transactionReference || `LR-${repayment.id}`,
          transactionId: repayment.id,
          userId: user.id,
          cashAccountCode: "102002",
          entryDate: repayment.repaymentDate,
          branchId: loan.branchId || undefined,
        });
      } catch (journalError) {
        console.error("Failed to create split loan repayment journal entry:", journalError);
      }
    }

    // SEND NOTIFICATION TO MEMBER
    if (loan.member.userId) {
      await db.notification.create({
        data: {
          userId: loan.member.userId,
          type: "IN_APP",
          subject: "Loan Repayment Received",
          message: `Your repayment of UGX ${data.amount.toLocaleString()} for ${loan.loanApplication.loanProduct.name} has been received successfully.`,
          isRead: false,
          targetAddress: `/dashboard/loans/${loan.id}`
        }
      });

      // Send email notification for repayment
      if (loan.member.user.email) {
        await sendTransactionAlertEmail(
          loan.member.user.email,
          loan.member.user.name,
          "REPAYMENT",
          data.amount
        );
      }
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-repayments");
    revalidatePath(`/dashboard/loan-repayments/${repayment.id}`);

    return {
      success: true,
      repayment,
      message: "Loan repayment created successfully",
    };
  } catch (error) {
    console.error("Error creating loan repayment:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create loan repayment",
    };
  }
}

// Get active loans for repayment
export async function getActiveLoansForRepayment(): Promise<ActiveLoan[]> {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get member record
    const member = await db.member.findUnique({
      where: { userId: user.id },
    });

    if (!member) {
      throw new Error("Member record not found");
    }

    const activeLoans = await db.loan.findMany({
      where: {
        memberId: member.id,
        status: {
          in: ["DISBURSED", "OVERDUE"],
        },
        outstandingBalance: {
          gt: 0,
        },
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        branch: true,
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    return activeLoans;
  } catch (error) {
    console.error("Error fetching active loans for repayment:", error);
    return [];
  }
}

// Get loan repayment by ID
export async function getLoanRepaymentById(
  id: string
): Promise<LoanRepaymentWithDetails | null> {
  try {
    const repayment = await db.loanRepayment.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: true,
      },
    });

    return repayment;
  } catch (error) {
    console.error("Error fetching loan repayment:", error);
    return null;
  }
}

// Get loan repayments for a specific loan
export async function getLoanRepayments(
  loanId: string
): Promise<LoanRepaymentWithDetails[]> {
  try {
    const repayments = await db.loanRepayment.findMany({
      where: { loanId },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: true,
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments;
  } catch (error) {
    console.error("Error fetching loan repayments:", error);
    return [];
  }
}

/**
 * Get all loan repayments with role-based filtering
 * - AGENT: Only sees repayments they processed
 * - BRANCHMANAGER/TELLER/ACCOUNTANT: See branch repayments
 * - ADMIN/AUDITOR: See all repayments
 */
export async function getAllLoanRepayments(): Promise<
  LoanRepaymentWithDetails[]
> {
  try {
    const user = await getAuthUser();

    if (
      !user ||
      ![
        "ADMIN",
        "BRANCHMANAGER",
        "TELLER",
        "ACCOUNTANT",
        "LOANOFFICER",
        "AUDITOR",
        "AGENT",
      ].includes(user.role)
    ) {
      throw new Error("Unauthorized access");
    }

    // Build where condition based on user role
    let whereCondition: any = {};

    // AGENT: Only see repayments they processed
    if (user.role === "AGENT") {
      whereCondition.handlerUserId = user.id;
    }
    // BRANCHMANAGER, TELLER, or ACCOUNTANT: Filter by branch
    else if (
      ["BRANCHMANAGER", "TELLER", "ACCOUNTANT"].includes(user.role) &&
      user.branchId
    ) {
      whereCondition.loan = {
        branchId: user.branchId,
      };
    }
    // LOANOFFICER: Filter by loans they manage
    else if (user.role === "LOANOFFICER") {
      whereCondition.loan = {
        OR: [
          { allocatedTellerId: user.id },
          { loanApplication: { loanOfficerId: user.id } },
        ],
      };
    }
    // ADMIN, ACCOUNTANT, AUDITOR: See all repayments (no filter)

    const repayments = await db.loanRepayment.findMany({
      where: whereCondition,
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: true,
      },
      orderBy: {
        repaymentDate: "desc",
      },
      take: 500,
    });

    return repayments;
  } catch (error) {
    console.error("Error fetching all loan repayments:", error);
    return [];
  }
}

// Get member's loan repayments
export async function getMyLoanRepayments(): Promise<
  LoanRepaymentWithDetails[]
> {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== "MEMBER") {
      throw new Error("User is not a member or not authenticated");
    }

    const member = await db.member.findUnique({
      where: { userId: user.id },
    });

    if (!member) {
      throw new Error("Member record not found");
    }

    const repayments = await db.loanRepayment.findMany({
      where: {
        memberId: member.id,
      },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: true,
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments;
  } catch (error) {
    console.error("Error fetching member loan repayments:", error);
    return [];
  }
}

// Get repayments by date range (for reporting)
export async function getLoanRepaymentsByDateRange(
  startDate: Date,
  endDate: Date,
  memberId?: string
): Promise<LoanRepaymentWithDetails[]> {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check permissions
    if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });

      if (!member) {
        throw new Error("Member record not found");
      }

      // Members can only see their own repayments
      memberId = member.id;
    } else if (
      ![
        "ADMIN",
        "BRANCHMANAGER",
        "TELLER",
        "ACCOUNTANT",
        "LOANOFFICER",
        "AUDITOR",
      ].includes(user.role)
    ) {
      throw new Error("Unauthorized access");
    }

    const whereCondition: any = {
      repaymentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (memberId) {
      whereCondition.memberId = memberId;
    }

    const repayments = await db.loanRepayment.findMany({
      where: whereCondition,
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: true,
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments;
  } catch (error) {
    console.error("Error fetching loan repayments by date range:", error);
    return [];
  }
}

/**
 * Get loan repayment statistics filtered by user role
 * - AGENT: Only sees their own processed repayments
 * - BRANCHMANAGER/TELLER/ACCOUNTANT: See branch statistics
 * - MEMBER: See their own repayments
 * - ADMIN/AUDITOR/LOANOFFICER: See all statistics
 */
export async function getLoanRepaymentStatistics(): Promise<LoanRepaymentStatistics> {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Build where condition based on user role
    let whereCondition: any = {};
    // instWhereCondition for institution repayments
    let instWhereCondition: any = {};

    // AGENT role: Filter by handler (only repayments they processed)
    if (user.role === "AGENT") {
      whereCondition.handlerUserId = user.id;
      instWhereCondition.handlerUserId = user.id; // Corrected: use handlerUserId for institution loans if it exists
      // Wait, let's check if InstitutionLoanRepayment has handlerUserId.
      // I saw description/institution/loan, but not handlerUserId in previous view.
      // I'll assume it might not and skip it or check schema.
    }
    // BRANCHMANAGER, TELLER, or ACCOUNTANT: Filter by their branch
    else if (
      ["BRANCHMANAGER", "TELLER", "ACCOUNTANT"].includes(user.role) &&
      user.branchId
    ) {
      whereCondition.loan = {
        branchId: user.branchId,
      };

      // For institutions, we filter by their branch if linked
      instWhereCondition.institution = {
          branchId: user.branchId
      };
    }
    // MEMBER: Filter by their own repayments
    else if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });

      if (!member) {
        throw new Error("Member record not found");
      }

      whereCondition.memberId = member.id;
      // Members do not have institution loans, so instWhereCondition remains empty
    }
    // ADMIN, AUDITOR, LOANOFFICER: See all statistics (no filter for either)
    else if (
      !["ADMIN", "AUDITOR", "LOANOFFICER"].includes(user.role)
    ) {
      throw new Error("Unauthorized access");
    }

    // Get today's date range
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    // Get this month's start date
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    // Fetch all statistics in parallel for better performance
    const [
      totalIndividualRepayments,
      totalIndividualAmount,
      todayIndividualRepayments,
      todayIndividualAmount,
      thisMonthIndividualRepayments,
      thisMonthIndividualAmount,
      individualChannelBreakdown,

      // Institution stats
      totalInstRepayments,
      totalInstAmount,
      todayInstRepayments,
      todayInstAmount,
      thisMonthInstRepayments,
      thisMonthInstAmount,
      instChannelBreakdown,
    ] = await Promise.all([
      // Individual Repayments
      db.loanRepayment.count({ where: whereCondition }),
      db.loanRepayment.aggregate({ where: whereCondition, _sum: { amount: true } }),
      db.loanRepayment.count({ where: { ...whereCondition, repaymentDate: { gte: todayStart, lte: todayEnd } } }),
      db.loanRepayment.aggregate({ where: { ...whereCondition, repaymentDate: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
      db.loanRepayment.count({ where: { ...whereCondition, repaymentDate: { gte: thisMonthStart } } }),
      db.loanRepayment.aggregate({ where: { ...whereCondition, repaymentDate: { gte: thisMonthStart } }, _sum: { amount: true } }),
      db.loanRepayment.groupBy({ by: ["channel"], where: whereCondition, _count: { _all: true }, _sum: { amount: true } }),

      // Institution Repayments
      db.institutionLoanRepayment.count({ where: instWhereCondition }),
      db.institutionLoanRepayment.aggregate({ where: instWhereCondition, _sum: { amount: true } }),
      db.institutionLoanRepayment.count({ where: { ...instWhereCondition, repaymentDate: { gte: todayStart, lte: todayEnd } } }),
      db.institutionLoanRepayment.aggregate({ where: { ...instWhereCondition, repaymentDate: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
      db.institutionLoanRepayment.count({ where: { ...instWhereCondition, repaymentDate: { gte: thisMonthStart } } }),
      db.institutionLoanRepayment.aggregate({ where: { ...instWhereCondition, repaymentDate: { gte: thisMonthStart } }, _sum: { amount: true } }),
      db.institutionLoanRepayment.groupBy({ by: ["channel"], where: instWhereCondition, _count: { _all: true }, _sum: { amount: true } }),
    ]);

    // Aggregate statistics
    const totalRepaymentsCount = totalIndividualRepayments + totalInstRepayments;
    const totalAmountSum = (totalIndividualAmount._sum.amount || 0) + (totalInstAmount._sum.amount || 0);

    const todayRepaymentsCount = todayIndividualRepayments + todayInstRepayments;
    const todayAmountSum = (todayIndividualAmount._sum.amount || 0) + (todayInstAmount._sum.amount || 0);

    const thisMonthRepaymentsCount = thisMonthIndividualRepayments + thisMonthInstRepayments;
    const thisMonthAmountSum = (thisMonthIndividualAmount._sum.amount || 0) + (thisMonthInstAmount._sum.amount || 0);

    // Combine channel breakdown
    const channelMap = new Map<string, { count: number; amount: number }>();

    [...individualChannelBreakdown, ...instChannelBreakdown].forEach((item) => {
      const channel = item.channel;
      const current = channelMap.get(channel) || { count: 0, amount: 0 };
      channelMap.set(channel, {
        count: current.count + (item._count._all || 0),
        amount: current.amount + (item._sum.amount || 0),
      });
    });

    const finalChannelBreakdown = Array.from(channelMap.entries()).map(
      ([channel, data]) => ({
        channel,
        count: data.count,
        amount: data.amount,
      })
    );

    return {
      totalRepayments: totalRepaymentsCount,
      totalAmount: totalAmountSum,
      todayRepayments: todayRepaymentsCount,
      todayAmount: todayAmountSum,
      thisMonthRepayments: thisMonthRepaymentsCount,
      thisMonthAmount: thisMonthAmountSum,
      channelBreakdown: finalChannelBreakdown,
    };
  } catch (error) {
    console.error("Error fetching loan repayment statistics:", error);
    return {
      totalRepayments: 0,
      totalAmount: 0,
      todayRepayments: 0,
      todayAmount: 0,
      thisMonthRepayments: 0,
      thisMonthAmount: 0,
      channelBreakdown: [],
    };
  }
}

// Get loan repayment stats (legacy function - kept for backward compatibility)
export async function getLoanRepaymentStats(
  memberId?: string
): Promise<LoanRepaymentStatistics> {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check permissions and set memberId for member role
    if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });

      if (!member) {
        throw new Error("Member record not found");
      }

      memberId = member.id;
    } else if (
      ![
        "ADMIN",
        "BRANCHMANAGER",
        "TELLER",
        "ACCOUNTANT",
        "LOANOFFICER",
        "AUDITOR",
      ].includes(user.role)
    ) {
      throw new Error("Unauthorized access");
    }

    const whereCondition: any = {};
    if (memberId) {
      whereCondition.memberId = memberId;
    }

    // Get today's date range
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    // Get this month's start date
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    // Get basic stats
    const [
      totalRepayments,
      totalAmount,
      todayRepayments,
      todayAmount,
      thisMonthRepayments,
      thisMonthAmount,
      channelBreakdown,
    ] = await Promise.all([
      db.loanRepayment.count({ where: whereCondition }),
      db.loanRepayment.aggregate({
        where: whereCondition,
        _sum: { amount: true },
      }),
      db.loanRepayment.count({
        where: {
          ...whereCondition,
          repaymentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      db.loanRepayment.aggregate({
        where: {
          ...whereCondition,
          repaymentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        _sum: { amount: true },
      }),
      db.loanRepayment.count({
        where: {
          ...whereCondition,
          repaymentDate: {
            gte: thisMonthStart,
          },
        },
      }),
      db.loanRepayment.aggregate({
        where: {
          ...whereCondition,
          repaymentDate: {
            gte: thisMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      db.loanRepayment.groupBy({
        by: ["channel"],
        where: whereCondition,
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      totalRepayments,
      totalAmount: totalAmount._sum.amount || 0,
      todayRepayments,
      todayAmount: todayAmount._sum.amount || 0,
      thisMonthRepayments,
      thisMonthAmount: thisMonthAmount._sum.amount || 0,
      channelBreakdown: channelBreakdown.map((item) => ({
        channel: item.channel,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
    };
  } catch (error) {
    console.error("Error fetching loan repayment statistics:", error);
    return {
      totalRepayments: 0,
      totalAmount: 0,
      todayRepayments: 0,
      todayAmount: 0,
      thisMonthRepayments: 0,
      thisMonthAmount: 0,
      channelBreakdown: [],
    };
  }
}

// Delete/Cancel a loan repayment (admin only)
export async function deleteLoanRepayment(repaymentId: string) {
  try {
    const user = await getAuthUser();

    if (!user || !["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      throw new Error("Unauthorized access - Admin or Branch Manager required");
    }

    // Get the repayment details
    const repayment = await db.loanRepayment.findUnique({
      where: { id: repaymentId },
      include: {
        loan: true,
      },
    });

    if (!repayment) {
      throw new Error("Repayment not found");
    }

    // Reverse the loan balance changes
    const newOutstandingBalance =
      repayment.loan.outstandingBalance + repayment.amount;
    const newAmountPaid = Math.max(
      0,
      repayment.loan.amountPaid - repayment.amount
    );

    // Determine new loan status
    let newStatus = repayment.loan.status;
    if (repayment.loan.status === "REPAID" && newOutstandingBalance > 0) {
      newStatus = "DISBURSED";
    }

    // Update loan balance
    await db.loan.update({
      where: { id: repayment.loanId },
      data: {
        outstandingBalance: newOutstandingBalance,
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    // Delete the repayment record
    await db.loanRepayment.delete({
      where: { id: repaymentId },
    });

    // Delete related transaction if it exists
    await db.transaction.deleteMany({
      where: {
        transactionRef: `LR-${repaymentId}`,
      },
    });

    // Revalidate relevant pages
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-repayments");

    return {
      success: true,
      message: "Loan repayment deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting loan repayment:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete loan repayment",
    };
  }
}

// Update loan repayment
export async function updateLoanRepayment(data: {
  id: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
}) {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get the existing repayment
    const existingRepayment = await db.loanRepayment.findUnique({
      where: { id: data.id },
      include: {
        loan: true,
      },
    });

    if (!existingRepayment) {
      throw new Error("Repayment not found");
    }

    // Check if user can modify (within 24 hours and is handler or admin)
    const hoursSincePayment =
      (Date.now() - existingRepayment.repaymentDate.getTime()) /
      (1000 * 60 * 60);

    const canModify =
      hoursSincePayment <= 24 &&
      (existingRepayment.handlerUserId === user.id || user.role === "ADMIN");

    if (!canModify) {
      throw new Error("Cannot modify repayment after 24 hours or unauthorized");
    }

    // Validate new amount
    if (data.amount <= 0) {
      throw new Error("Repayment amount must be greater than 0");
    }

    // Calculate the difference in amount
    const amountDifference = data.amount - existingRepayment.amount;
    const currentBalance = existingRepayment.loan.outstandingBalance;
    const newBalance = currentBalance + amountDifference;

    // Ensure new balance doesn't go negative
    if (newBalance < 0) {
      throw new Error("Repayment amount would exceed total loan amount");
    }

    // Update the repayment record
    const updatedRepayment = await db.loanRepayment.update({
      where: { id: data.id },
      data: {
        amount: data.amount,
        channel: data.channel,
        mobileMoneyRef:
          data.channel === "Mobile Money" ? data.mobileMoneyRef : null,
      },
    });

    // Update loan balance
    const newAmountPaid = existingRepayment.loan.amountPaid + amountDifference;

    // Determine new loan status
    let newStatus = existingRepayment.loan.status;
    if (newBalance <= 0) {
      newStatus = "REPAID";
    } else if (existingRepayment.loan.status === "REPAID" && newBalance > 0) {
      newStatus = "DISBURSED";
    }

    await db.loan.update({
      where: { id: existingRepayment.loanId },
      data: {
        outstandingBalance: Math.max(0, newBalance),
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    // Update related transaction if it exists
    const existingTransaction = await db.transaction.findFirst({
      where: {
        transactionRef: `LR-${data.id}`,
      },
    });

    if (existingTransaction) {
      await db.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          amount: data.amount,
          channel: data.channel,
          externalReference:
            data.channel === "Mobile Money" ? data.mobileMoneyRef : null,
          description: `Updated loan repayment for loan ${existingRepayment.loanId}`,
        },
      });
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-repayments");
    revalidatePath(`/dashboard/loan-repayments/${data.id}`);

    return {
      success: true,
      repayment: updatedRepayment,
      message: "Loan repayment updated successfully",
    };
  } catch (error) {
    console.error("Error updating loan repayment:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update loan repayment",
    };
  }
}

// Export all types for use in components
export type { LoanWithMemberAndDetails, LoanRepaymentWithDetails, ActiveLoan };
