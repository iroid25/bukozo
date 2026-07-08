import { db } from "../../prisma/db.ts";
import { InterestType, InterestPeriod } from "@prisma/client";
import type { LoanProduct } from "@prisma/client";

export interface LoanProductDTO {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  interestType: InterestType;
  interestPeriod: InterestPeriod;
  repaymentPeriodDays: number;
  description?: string | null;
  isActive?: boolean;
  ledgerAccountId?: string | null;
  interestAccountId?: string | null;
  penaltyAccountId?: string | null;
  feeAccountId?: string | null;
}

export const DEFAULT_LOAN_PRODUCT_CATALOG: LoanProductDTO[] = [
  {
    name: "Commercial/business loan",
    minAmount: 500000,
    maxAmount: 50000000,
    interestRate: 30,
    interestType: "REDUCING_BALANCE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 365,
    description: "Commercial and business financing product",
    isActive: true,
  },
  {
    name: "Asset acquisition/home improvement",
    minAmount: 1000000,
    maxAmount: 100000000,
    interestRate: 30,
    interestType: "REDUCING_BALANCE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 730,
    description: "For asset purchase and home improvement",
    isActive: true,
  },
  {
    name: "School fees loan",
    minAmount: 100000,
    maxAmount: 10000000,
    interestRate: 21.6,
    interestType: "FLAT_RATE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 180,
    description: "Short-term loan for school fees",
    isActive: true,
  },
  {
    name: "Employed loan - Category 1",
    minAmount: 100000,
    maxAmount: 5000000,
    interestRate: 20,
    interestType: "FLAT_RATE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 180,
    description: "Employed borrower category 1",
    isActive: true,
  },
  {
    name: "Employed loan - Category 2",
    minAmount: 100000,
    maxAmount: 5000000,
    interestRate: 21.6,
    interestType: "REDUCING_BALANCE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 180,
    description: "Employed borrower category 2",
    isActive: true,
  },
  {
    name: "Bodaboda loan",
    minAmount: 500000,
    maxAmount: 15000000,
    interestRate: 18,
    interestType: "REDUCING_BALANCE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 365,
    description: "Loan for boda boda riders and related business",
    isActive: true,
  },
  {
    name: "Starter fund",
    minAmount: 50000,
    maxAmount: 2000000,
    interestRate: 12,
    interestType: "FLAT_RATE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 90,
    description: "Entry-level starter loan product",
    isActive: true,
  },
  {
    name: "Super saver loan",
    minAmount: 100000,
    maxAmount: 10000000,
    interestRate: 24,
    interestType: "REDUCING_BALANCE",
    interestPeriod: "ANNUAL",
    repaymentPeriodDays: 365,
    description: "Savings-backed loan product",
    isActive: true,
  },
];

type LoanProductWithPortfolioMetrics = LoanProduct & {
  _count: {
    loanApplications: number;
  };
  totalOutstanding: number;
  totalDisbursed: number;
  activeLoans: number;
};

export class LoanProductService {
  static async ensureDefaultCatalog() {
    return this.upsertMany(DEFAULT_LOAN_PRODUCT_CATALOG);
  }

  static async getAll() {
    const count = await db.loanProduct.count();
    if (count === 0) await this.ensureDefaultCatalog();

    const products = await db.loanProduct.findMany({
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const [individualLoans, institutionLoans] = await Promise.all([
      db.loan.findMany({
        where: {
          status: { in: ["DISBURSED", "OVERDUE"] },
        },
        select: {
          amountGranted: true,
          outstandingBalance: true,
          loanApplication: {
            select: {
              loanProductId: true,
            },
          },
        },
      }),
      db.institutionLoan.findMany({
        where: {
          status: { in: ["DISBURSED", "OVERDUE"] },
        },
        select: {
          amountGranted: true,
          outstandingBalance: true,
          application: {
            select: {
              loanProductId: true,
            },
          },
        },
      }),
    ]);

    const portfolioByProduct = new Map<
      string,
      { totalOutstanding: number; totalDisbursed: number; activeLoans: number }
    >();

    const accumulatePortfolio = (
      productId: string | null | undefined,
      outstandingBalance: number | null | undefined,
      amountGranted: number | null | undefined,
    ) => {
      if (!productId) return;

      const current = portfolioByProduct.get(productId) || {
        totalOutstanding: 0,
        totalDisbursed: 0,
        activeLoans: 0,
      };

      current.totalOutstanding += Number(outstandingBalance || 0);
      current.totalDisbursed += Number(amountGranted || 0);
      current.activeLoans += 1;

      portfolioByProduct.set(productId, current);
    };

    individualLoans.forEach((loan) =>
      accumulatePortfolio(
        loan.loanApplication?.loanProductId,
        loan.outstandingBalance,
        loan.amountGranted,
      ),
    );

    institutionLoans.forEach((loan) =>
      accumulatePortfolio(
        loan.application?.loanProductId,
        loan.outstandingBalance,
        loan.amountGranted,
      ),
    );

    return products.map((product): LoanProductWithPortfolioMetrics => {
      const metrics = portfolioByProduct.get(product.id) || {
        totalOutstanding: 0,
        totalDisbursed: 0,
        activeLoans: 0,
      };

      return {
        ...product,
        totalOutstanding: metrics.totalOutstanding,
        totalDisbursed: metrics.totalDisbursed,
        activeLoans: metrics.activeLoans,
      };
    });
  }

  /**
   * Get all active loan products
   */
  static async getActive() {
    const count = await db.loanProduct.count();
    if (count === 0) await this.ensureDefaultCatalog();
    return await db.loanProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get a single loan product by ID
   */
  static async getById(id: string) {
    return await db.loanProduct.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
    });
  }

  static async getDetailsById(id: string, take = 50, skip = 0) {
    return await db.loanProduct.findUnique({
      where: { id },
      include: {
        ledgerAccount: true,
        interestAccount: true,
        penaltyAccount: true,
        feeAccount: true,
        loanApplications: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
            approver: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
            loan: {
              select: {
                id: true,
                amountGranted: true,
                status: true,
                disbursementDate: true,
                outstandingBalance: true,
              },
            },
          },
          orderBy: { applicationDate: "desc" },
          take,
          skip,
        },
        institutionLoanApplications: {
          include: {
            institution: {
              select: {
                institutionName: true,
                institutionNumber: true,
                user: { select: { name: true, email: true, phone: true } },
              },
            },
            institutionLoan: {
              select: {
                id: true,
                amountGranted: true,
                status: true,
                disbursementDate: true,
                outstandingBalance: true,
              },
            },
          },
          orderBy: { applicationDate: "desc" },
          take,
          skip,
        },
      },
    });
  }

  static async getStats(id: string) {
    const [
      memberTotal,
      memberApproved,
      memberRejected,
      memberPending,
      institutionTotal,
      institutionApproved,
      institutionRejected,
      institutionPending,
      totalDisbursed,
      activeLoans,
    ] = await Promise.all([
      db.loanApplication.count({ where: { loanProductId: id } }),
      db.loanApplication.count({
        where: { loanProductId: id, status: "APPROVED" },
      }),
      db.loanApplication.count({
        where: { loanProductId: id, status: "REJECTED" },
      }),
      db.loanApplication.count({
        where: { loanProductId: id, status: "PENDING" },
      }),
      db.institutionLoanApplication.count({ where: { loanProductId: id } }),
      db.institutionLoanApplication.count({
        where: { loanProductId: id, status: "APPROVED" },
      }),
      db.institutionLoanApplication.count({
        where: { loanProductId: id, status: "REJECTED" },
      }),
      db.institutionLoanApplication.count({
        where: { loanProductId: id, status: "PENDING" },
      }),
      db.loan.aggregate({
        where: { loanApplication: { loanProductId: id } },
        _sum: { amountGranted: true },
        _count: true,
      }),
      db.loan.count({
        where: {
          loanApplication: { loanProductId: id },
          status: { in: ["DISBURSED", "APPROVED"] },
        },
      }),
    ]);

    const totalApplications = memberTotal + institutionTotal;
    const approvedApplications = memberApproved + institutionApproved;
    const rejectedApplications = memberRejected + institutionRejected;
    const pendingApplications = memberPending + institutionPending;

    const outstandingBalance = await db.loan.aggregate({
      where: {
        loanApplication: {
          loanProductId: id,
        },
        status: {
          in: ["DISBURSED", "APPROVED"],
        },
      },
      _sum: { outstandingBalance: true },
    });

    return {
      totalApplications,
      approvedApplications,
      rejectedApplications,
      pendingApplications,
      totalDisbursed: totalDisbursed._sum.amountGranted || 0,
      totalLoansCount: totalDisbursed._count,
      activeLoans,
      outstandingBalance: outstandingBalance._sum.outstandingBalance || 0,
      approvalRate:
        totalApplications > 0
          ? (approvedApplications / totalApplications) * 100
          : 0,
    };
  }

  /**
   * Create a new loan product
   */
  static async create(data: LoanProductDTO) {
    return await db.loanProduct.create({
      data,
    });
  }

  /**
   * Update an existing loan product
   */
  static async update(id: string, data: Partial<LoanProductDTO>) {
    return await db.loanProduct.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a loan product
   */
  static async delete(id: string) {
    // Check for dependencies (loan applications)
    const count = await db.loanApplication.count({
      where: { loanProductId: id },
    });

    if (count > 0) {
      throw new Error(
        `Cannot delete loan product: it has ${count} associated applications.`,
      );
    }

    return await db.loanProduct.delete({
      where: { id },
    });
  }

  /**
   * Upsert multiple loan products (useful for configuration/seeding)
   */
  static async upsertMany(products: LoanProductDTO[]) {
    const results = [];
    for (const product of products) {
      const result = await db.loanProduct.upsert({
        where: { name: product.name },
        update: {
          minAmount: product.minAmount,
          maxAmount: product.maxAmount,
          interestRate: product.interestRate,
          interestType: product.interestType,
          interestPeriod: product.interestPeriod,
          repaymentPeriodDays: product.repaymentPeriodDays,
          description: product.description,
          isActive: product.isActive ?? true,
          ...(product.ledgerAccountId !== undefined && {
            ledgerAccountId: product.ledgerAccountId,
          }),
          ...(product.interestAccountId !== undefined && {
            interestAccountId: product.interestAccountId,
          }),
          ...(product.penaltyAccountId !== undefined && {
            penaltyAccountId: product.penaltyAccountId,
          }),
          ...(product.feeAccountId !== undefined && {
            feeAccountId: product.feeAccountId,
          }),
          updatedAt: new Date(),
        },
        create: product,
      });
      results.push(result);
    }
    return results;
  }
}
