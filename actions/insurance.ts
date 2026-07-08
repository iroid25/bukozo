// FILE: actions/insurance.ts
"use server";

import { db } from "@/prisma/db";
import { InsuranceContributionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { InsuranceRecord, CreateInsurancePaymentDTO } from "@/types/insurance";

const LOAN_INSURANCE_POOL_ACCOUNT = "SACCO_LOAN_INSURANCE_POOL";

// =====================
// GET ALL INSURANCE RECORDS
// =====================
export async function getAllInsuranceRecords(): Promise<InsuranceRecord[]> {
  try {
    const records = await db.insuranceContribution.findMany({
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            surname: true,
            otherNames: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            accountType: {
              select: {
                name: true,
              },
            },
          },
        },
        loanApplication: {
          select: {
            id: true,
            amountApplied: true,
            approvedAmount: true,
          },
        },
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to match InsuranceRecord type expected by UI
    return records.map(
      (record): InsuranceRecord => ({
        id: record.id,
        amount: record.amount,
        type: record.type, // 'CONTRIBUTION' or 'PAYMENT_OUT'
        description: record.description,
        memberName: record.member?.user.name,
        memberNumber: record.member?.memberNumber,
        accountNumber: record.account.accountNumber,
        reference: record.reference ?? undefined,
        createdAt: record.createdAt.toISOString(),
        createdBy: record.createdById, // Just the ID
        createdByName: record.createdBy.name, // The name
      })
    );
  } catch (error) {
    console.error("Error fetching insurance records:", error);
    return [];
  }
}

// =====================
// GET INSURANCE STATISTICS
// =====================
export async function getInsuranceStatistics() {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Get SACCO Insurance Account
    const insuranceAccount = await db.account.findFirst({
      where: {
        accountNumber: LOAN_INSURANCE_POOL_ACCOUNT,
      },
    });

    if (!insuranceAccount) {
      return {
        success: false,
        error: "Insurance account not found. Please create it first.",
        data: {
          totalPoolBalance: 0,
          totalCollected: 0,
          totalPaidOut: 0,
          monthlyCollection: 0,
          membersCovered: 0,
          averageContribution: 0,
        },
      };
    }

    // Total contributions collected
    const totalCollectedResult = await db.insuranceContribution.aggregate({
      where: {
        type: InsuranceContributionType.CONTRIBUTION,
      },
      _sum: {
        amount: true,
      },
    });

    // Total paid out to insurance company
    const totalPaidOutResult = await db.insuranceContribution.aggregate({
      where: {
        type: InsuranceContributionType.PAYMENT_OUT,
      },
      _sum: {
        amount: true,
      },
    });

    // This month's collections
    const monthlyCollectionResult = await db.insuranceContribution.aggregate({
      where: {
        type: InsuranceContributionType.CONTRIBUTION,
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1),
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Count unique members who have contributed
    const uniqueMembers = await db.insuranceContribution.findMany({
      where: {
        type: InsuranceContributionType.CONTRIBUTION,
        memberId: {
          not: null,
        },
      },
      select: {
        memberId: true,
      },
      distinct: ["memberId"],
    });

    const totalCollected = totalCollectedResult._sum.amount || 0;
    const totalPaidOut = totalPaidOutResult._sum.amount || 0;
    const monthlyCollection = monthlyCollectionResult._sum.amount || 0;
    const membersCovered = uniqueMembers.length;
    const averageContribution =
      membersCovered > 0 ? totalCollected / membersCovered : 0;

    return {
      success: true,
      data: {
        totalPoolBalance: insuranceAccount.balance,
        totalCollected,
        totalPaidOut,
        monthlyCollection,
        membersCovered,
        averageContribution,
      },
    };
  } catch (error) {
    console.error("Error fetching insurance statistics:", error);
    return {
      success: false,
      error: "Failed to fetch statistics",
      data: {
        totalPoolBalance: 0,
        totalCollected: 0,
        totalPaidOut: 0,
        monthlyCollection: 0,
        membersCovered: 0,
        averageContribution: 0,
      },
    };
  }
}

// =====================
// RECORD INSURANCE PAYMENT (to insurance company)
// =====================
export async function recordInsurancePayment(data: CreateInsurancePaymentDTO) {
  try {
    // Get SACCO Insurance Account
    const insuranceAccount = await db.account.findFirst({
      where: {
        accountNumber: LOAN_INSURANCE_POOL_ACCOUNT,
      },
    });

    if (!insuranceAccount) {
      return {
        success: false,
        error: "Insurance account not found",
      };
    }

    // Check if sufficient balance
    if (insuranceAccount.balance < data.amount) {
      return {
        success: false,
        error: `Insufficient balance. Available: UGX ${insuranceAccount.balance.toLocaleString()}`,
      };
    }

    // Create payment record and update balance in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create insurance payment record
      const payment = await tx.insuranceContribution.create({
        data: {
          amount: data.amount,
          type: InsuranceContributionType.PAYMENT_OUT,
          description: data.description,
          reference: data.reference,
          accountId: insuranceAccount.id,
          createdById: data.createdById,
        },
      });

      // Update insurance account balance
      await tx.account.update({
        where: { id: insuranceAccount.id },
        data: {
          balance: {
            decrement: data.amount,
          },
        },
      });

      return payment;
    });

    revalidatePath("/dashboard/insurance");
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error recording insurance payment:", error);
    return {
      success: false,
      error: "Failed to record payment",
    };
  }
}

// =====================
// GET MEMBER INSURANCE CONTRIBUTIONS
// =====================
export async function getMemberInsuranceContributions(memberId: string) {
  try {
    const contributions = await db.insuranceContribution.findMany({
      where: {
        memberId,
        type: InsuranceContributionType.CONTRIBUTION,
      },
      include: {
        loanApplication: {
          select: {
            amountApplied: true,
            approvedAmount: true,
            applicationDate: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalContributed = contributions.reduce(
      (sum, contrib) => sum + contrib.amount,
      0
    );

    return {
      success: true,
      data: {
        contributions: contributions.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          loanApplication: c.loanApplication
            ? {
                ...c.loanApplication,
                applicationDate:
                  c.loanApplication.applicationDate.toISOString(),
              }
            : null,
        })),
        totalContributed,
        count: contributions.length,
      },
    };
  } catch (error) {
    console.error("Error fetching member contributions:", error);
    return {
      success: false,
      error: "Failed to fetch member contributions",
      data: {
        contributions: [],
        totalContributed: 0,
        count: 0,
      },
    };
  }
}

// =====================
// HELPER: Record Insurance Deduction During Loan Approval
// (Called from loan approval process)
// =====================
export async function recordLoanInsuranceDeduction(data: {
  memberId: string;
  loanApplicationId: string;
  amount: number;
  createdById: string;
}) {
  try {
    // Get SACCO Insurance Account
    const insuranceAccount = await db.account.findFirst({
      where: {
        accountNumber: LOAN_INSURANCE_POOL_ACCOUNT,
      },
    });

    if (!insuranceAccount) {
      throw new Error("Insurance account not found");
    }

    // Create insurance contribution record and update balance
    const result = await db.$transaction(async (tx) => {
      // Create contribution record
      const contribution = await tx.insuranceContribution.create({
        data: {
          amount: data.amount,
          type: InsuranceContributionType.CONTRIBUTION,
          description: `Insurance deduction for loan application`,
          memberId: data.memberId,
          loanApplicationId: data.loanApplicationId,
          accountId: insuranceAccount.id,
          createdById: data.createdById,
        },
      });

      // Update insurance account balance
      await tx.account.update({
        where: { id: insuranceAccount.id },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      return contribution;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error recording loan insurance deduction:", error);
    return {
      success: false,
      error: "Failed to record insurance deduction",
    };
  }
}
