// actions/mobileLoanRepayments.ts
"use server";

import { revalidatePath } from "next/cache";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

/* ---------------- TYPES ---------------- */

export interface MobileLoanRepaymentCreateDTO {
  loanId: string;
  memberId: string;
  amount: number;
  channel: string;
  mobileMoneyRef: string;
  description?: string;
}

export interface MobileMoneyStatistics {
  today: {
    amount: number;
    count: number;
  };
  thisMonth: {
    amount: number;
    count: number;
  };
  total: {
    amount: number;
    count: number;
  };
}

export interface MobileMoneyLoanRepayment {
  id: string;
  loanId: string;
  memberId: string;
  amount: number;
  repaymentDate: Date;
  handlerUserId: string;
  channel: string;
  mobileMoneyRef: string | null;

  loan: {
    id: string;
    amountGranted: number;
    interestRate: number;
    totalAmountDue: number;
    amountPaid: number;
    outstandingBalance: number;
    disbursementDate: Date;
    dueDate: Date;
    status: string;
    loanApplication: {
      id: string;
      amountApplied: number;
      applicationDate: Date;
      loanProduct: {
        id: string;
        name: string;
      };
    };
  };

  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      image: string | null;
    };
  };

  handler: {
    id: string;
    name: string;
    role: string;
  };
}

/* ---------------- FETCH OPERATIONS ---------------- */

// Fetch all mobile money loan repayments
export async function getAllMobileLoanRepayments(): Promise<
  MobileMoneyLoanRepayment[]
> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      channel: "MOBILE_MONEY",
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loan = {
        branchId: user.branchId,
      };
    }

    const repayments = await db.loanRepayment.findMany({
      where: whereClause,
      select: {
        id: true,
        loanId: true,
        memberId: true,
        amount: true,
        repaymentDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        loan: {
          select: {
            id: true,
            amountGranted: true,
            interestRate: true,
            totalAmountDue: true,
            amountPaid: true,
            outstandingBalance: true,
            disbursementDate: true,
            dueDate: true,
            status: true,
            loanApplication: {
              select: {
                id: true,
                amountApplied: true,
                applicationDate: true,
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments as MobileMoneyLoanRepayment[];
  } catch (error) {
    console.error("Error fetching mobile money loan repayments:", error);
    throw error;
  }
}

// Fetch today's mobile money loan repayments
export async function getTodaysMobileLoanRepayments(): Promise<
  MobileMoneyLoanRepayment[]
> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const whereClause: any = {
      channel: "MOBILE_MONEY",
      repaymentDate: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loan = {
        branchId: user.branchId,
      };
    }

    const repayments = await db.loanRepayment.findMany({
      where: whereClause,
      select: {
        id: true,
        loanId: true,
        memberId: true,
        amount: true,
        repaymentDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        loan: {
          select: {
            id: true,
            amountGranted: true,
            interestRate: true,
            totalAmountDue: true,
            amountPaid: true,
            outstandingBalance: true,
            disbursementDate: true,
            dueDate: true,
            status: true,
            loanApplication: {
              select: {
                id: true,
                amountApplied: true,
                applicationDate: true,
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments as MobileMoneyLoanRepayment[];
  } catch (error) {
    console.error(
      "Error fetching today's mobile money loan repayments:",
      error
    );
    throw error;
  }
}

// Fetch monthly mobile money loan repayments
export async function getMonthlyMobileLoanRepayments(): Promise<
  MobileMoneyLoanRepayment[]
> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const whereClause: any = {
      channel: "MOBILE_MONEY",
      repaymentDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loan = {
        branchId: user.branchId,
      };
    }

    const repayments = await db.loanRepayment.findMany({
      where: whereClause,
      select: {
        id: true,
        loanId: true,
        memberId: true,
        amount: true,
        repaymentDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        loan: {
          select: {
            id: true,
            amountGranted: true,
            interestRate: true,
            totalAmountDue: true,
            amountPaid: true,
            outstandingBalance: true,
            disbursementDate: true,
            dueDate: true,
            status: true,
            loanApplication: {
              select: {
                id: true,
                amountApplied: true,
                applicationDate: true,
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        repaymentDate: "desc",
      },
    });

    return repayments as MobileMoneyLoanRepayment[];
  } catch (error) {
    console.error(
      "Error fetching monthly mobile money loan repayments:",
      error
    );
    throw error;
  }
}

// Get mobile money loan repayment statistics
export async function getMobileLoanRepaymentStatistics(): Promise<MobileMoneyStatistics> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      channel: "MOBILE_MONEY",
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loan = {
        branchId: user.branchId,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const [todayStats, monthStats, totalStats] = await Promise.all([
      db.loanRepayment.aggregate({
        where: {
          ...whereClause,
          repaymentDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.loanRepayment.aggregate({
        where: {
          ...whereClause,
          repaymentDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.loanRepayment.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      today: {
        amount: Number(todayStats._sum.amount || 0),
        count: todayStats._count._all,
      },
      thisMonth: {
        amount: Number(monthStats._sum.amount || 0),
        count: monthStats._count._all,
      },
      total: {
        amount: Number(totalStats._sum.amount || 0),
        count: totalStats._count._all,
      },
    };
  } catch (error) {
    console.error(
      "Error fetching mobile money loan repayment statistics:",
      error
    );
    throw error;
  }
}

// Fetch single repayment by ID
export async function getMobileLoanRepaymentById(
  id: string
): Promise<MobileMoneyLoanRepayment | null> {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      id,
      channel: "MOBILE_MONEY",
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loan = {
        branchId: user.branchId,
      };
    }

    const repayment = await db.loanRepayment.findFirst({
      where: whereClause,
      select: {
        id: true,
        loanId: true,
        memberId: true,
        amount: true,
        repaymentDate: true,
        handlerUserId: true,
        channel: true,
        mobileMoneyRef: true,
        loan: {
          select: {
            id: true,
            amountGranted: true,
            interestRate: true,
            totalAmountDue: true,
            amountPaid: true,
            outstandingBalance: true,
            disbursementDate: true,
            dueDate: true,
            status: true,
            loanApplication: {
              select: {
                id: true,
                amountApplied: true,
                applicationDate: true,
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!repayment) {
      throw new Error("Repayment not found or you don't have access to it");
    }

    return repayment as MobileMoneyLoanRepayment;
  } catch (error) {
    console.error("Error fetching mobile money loan repayment:", error);
    throw error;
  }
}

/* ---------------- CREATE OPERATION ---------------- */

// Create mobile money loan repayment
export async function createMobileLoanRepayment(
  data: MobileLoanRepaymentCreateDTO,
  handlerUserId: string
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Only TELLER and AGENT can create repayments
    if (!["TELLER", "AGENT"].includes(user.role)) {
      return {
        success: false,
        error: "Only tellers and agents can process loan repayments",
      };
    }

    // Validate amount
    if (data.amount <= 0) {
      return {
        success: false,
        error: "Repayment amount must be greater than zero",
      };
    }

    // Validate mobile money reference
    if (!data.mobileMoneyRef?.trim()) {
      return {
        success: false,
        error: "Mobile money reference is required",
      };
    }

    // Validate loan
    const loan = await db.loan.findFirst({
      where: {
        id: data.loanId,
        memberId: data.memberId,
        status: { in: ["DISBURSED", "OVERDUE"] },
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!loan) {
      return {
        success: false,
        error: "Loan not found or already fully repaid",
      };
    }

    // Check if repayment amount exceeds outstanding balance
    if (data.amount > loan.outstandingBalance) {
      return {
        success: false,
        error: `Repayment amount (${formatCurrency(
          data.amount
        )}) exceeds outstanding balance (${formatCurrency(
          loan.outstandingBalance
        )})`,
      };
    }

    // Create repayment
    const repayment = await db.$transaction(async (tx) => {
      const newRepayment = await tx.loanRepayment.create({
        data: {
          loanId: data.loanId,
          memberId: data.memberId,
          amount: data.amount,
          channel: "MOBILE_MONEY",
          mobileMoneyRef: data.mobileMoneyRef.trim(),
          repaymentDate: new Date(),
          handlerUserId,
        },
        include: {
          loan: {
            include: {
              loanApplication: {
                include: {
                  loanProduct: true,
                },
              },
            },
          },
          member: {
            include: {
              user: true,
            },
          },
          handler: true,
        },
      });

      // Update loan balance
      const newAmountPaid = loan.amountPaid + data.amount;
      const newOutstandingBalance = loan.totalAmountDue - newAmountPaid;
      const newStatus = newOutstandingBalance <= 0 ? "REPAID" : loan.status;

      await tx.loan.update({
        where: { id: data.loanId },
        data: {
          amountPaid: newAmountPaid,
          outstandingBalance: newOutstandingBalance,
          status: newStatus,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: handlerUserId,
          action: "MOBILE_LOAN_REPAYMENT_CREATED",
          entityType: "LoanRepayment",
          entityId: newRepayment.id,
          details: JSON.stringify({
            loanId: data.loanId,
            amount: data.amount,
            channel: "MOBILE_MONEY",
            mobileMoneyRef: data.mobileMoneyRef,
            memberNumber: loan.member.memberNumber,
          }),
        },
      });

      return newRepayment;
    });

    revalidatePath("/dashboard/mobile-money/loan-repayments");
    revalidatePath("/dashboard/loans");

    return {
      success: true,
      repayment,
      message: `Loan repayment of ${formatCurrency(
        data.amount
      )} processed successfully via Mobile Money`,
    };
  } catch (error: any) {
    console.error("Error creating mobile money loan repayment:", error);
    return {
      success: false,
      error: error.message || "Failed to create loan repayment",
    };
  }
}

/* ---------------- UTILITY FUNCTIONS ---------------- */

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}
/* ---------------- HELPER FUNCTIONS ---------------- */

/**
 * Get members with active loans for mobile money repayments
 * Returns members who have loans with outstanding balances
 */
export async function getMembersWithActiveLoansForMobile() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      isApproved: true,
      loans: {
        some: {
          status: { in: ["DISBURSED", "OVERDUE"] },
          outstandingBalance: {
            gt: 0,
          },
        },
      },
    };

    // Add branch filtering for non-admin roles
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.loans = {
        some: {
          status: { in: ["DISBURSED", "OVERDUE"] },
          outstandingBalance: {
            gt: 0,
          },
          branchId: user.branchId,
        },
      };
    }

    const members = await db.member.findMany({
      where: whereClause,
      select: {
        id: true,
        memberNumber: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        loans: {
          where: {
            status: { in: ["DISBURSED", "OVERDUE"] },
            outstandingBalance: {
              gt: 0,
            },
            ...(["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role) &&
            user.branchId
              ? { branchId: user.branchId }
              : {}),
          },
          select: {
            id: true,
            amountGranted: true,
            outstandingBalance: true,
            dueDate: true,
            loanApplication: {
              select: {
                loanProduct: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        memberNumber: "asc",
      },
    });

    return members;
  } catch (error) {
    console.error("Error fetching members with active loans:", error);
    return [];
  }
}

/**
 * Get member's active loans for mobile money repayments
 * Returns all active loans for a specific member
 */
export async function getMemberActiveLoans(memberId: string) {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const whereClause: any = {
      memberId,
      status: { in: ["DISBURSED", "OVERDUE"] },
      outstandingBalance: {
        gt: 0,
      },
    };

    // Add branch filtering for non-admin roles
    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) {
        throw new Error("User does not have an assigned branch");
      }
      whereClause.branchId = user.branchId;
    }

    const loans = await db.loan.findMany({
      where: whereClause,
      select: {
        id: true,
        amountGranted: true,
        interestRate: true,
        totalAmountDue: true,
        amountPaid: true,
        outstandingBalance: true,
        disbursementDate: true,
        dueDate: true,
        status: true,
        loanApplication: {
          select: {
            id: true,
            amountApplied: true,
            applicationDate: true,
            loanProduct: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    return loans;
  } catch (error) {
    console.error("Error fetching member active loans:", error);
    return [];
  }
}
