// @ts-nocheck
// actions/loanProducts.ts
"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

export interface LoanProductCreateDTO {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  repaymentPeriodDays: number;
  description?: string;
  isActive?: boolean;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
  interestPeriod?: "MONTHLY" | "ANNUAL";
}

export interface LoanProductUpdateDTO extends LoanProductCreateDTO {
  id: string;
}

// Fetch all loan products
export async function getAllLoanProducts() {
  try {
    const loanProducts = await db.loanProduct.findMany({
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return loanProducts;
  } catch (error) {
    console.error("Error fetching loan products:", error);
    return [];
  }
}

// Fetch active loan products only (for loan applications)
// export async function getActiveLoanProducts() {
//   try {
//     const loanProducts = await db.loanProduct.findMany({
//       where: {
//         isActive: true,
//       },
//       orderBy: {
//         name: "asc",
//       },
//     });
//     return loanProducts;
//   } catch (error) {
//     console.error("Error fetching active loan products:", error);
//     return [];
//   }
// }

// Fetch single loan product by ID
export async function getLoanProductById(id: string) {
  try {
    const loanProduct = await db.loanProduct.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
    });
    return loanProduct;
  } catch (error) {
    console.error("Error fetching loan product:", error);
    return null;
  }
}

// Create new loan product
export async function createLoanProduct(data: LoanProductCreateDTO) {
  try {
    // Check if loan product name already exists
    const existingLoanProduct = await db.loanProduct.findUnique({
      where: { name: data.name },
    });

    if (existingLoanProduct) {
      return {
        error: "A loan product with this name already exists",
        data: null,
      };
    }

    // Validate interest rate - allow up to 300% to accommodate annual rates
    if (data.interestRate < 0 || data.interestRate > 300) {
      return {
        error: "Interest rate must be between 0 and 100",
        data: null,
      };
    }

    // Validate amounts
    if (data.minAmount < 0) {
      return {
        error: "Minimum amount cannot be negative",
        data: null,
      };
    }

    if (data.maxAmount < 0) {
      return {
        error: "Maximum amount cannot be negative",
        data: null,
      };
    }

    if (data.maxAmount <= data.minAmount) {
      return {
        error: "Maximum amount must be greater than minimum amount",
        data: null,
      };
    }

    // Validate repayment period
    if (data.repaymentPeriodDays < 1) {
      return {
        error: "Repayment period must be at least 1 day",
        data: null,
      };
    }

    const loanProduct = await db.loanProduct.create({
      data: {
        name: data.name,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
        interestRate: data.interestRate,
        repaymentPeriodDays: data.repaymentPeriodDays,
        description: data.description || null,
        isActive: data.isActive ?? true,
        interestType: data.interestType || "FLAT_RATE",
        interestPeriod: data.interestPeriod || "MONTHLY",
      },
    });

    revalidatePath("/dashboard/loan-products");
    return {
      error: null,
      data: loanProduct,
    };
  } catch (error) {
    console.error("Error creating loan product:", error);
    return {
      error: "Failed to create loan product. Please try again.",
      data: null,
    };
  }
}

// Update existing loan product
export async function updateLoanProduct(data: LoanProductUpdateDTO) {
  try {
    // Check if name is being updated and if it conflicts with existing loan product
    if (data.name) {
      const existingLoanProduct = await db.loanProduct.findFirst({
        where: {
          name: data.name,
          NOT: { id: data.id },
        },
      });

      if (existingLoanProduct) {
        return {
          error: "A loan product with this name already exists",
          data: null,
        };
      }
    }

    // Validate interest rate if provided
    if (
      data.interestRate !== undefined &&
      (data.interestRate < 0 || data.interestRate > 300)
    ) {
      return {
        error: "Interest rate must be between 0 and 100",
        data: null,
      };
    }

    // Validate amounts if provided
    if (data.minAmount !== undefined && data.minAmount < 0) {
      return {
        error: "Minimum amount cannot be negative",
        data: null,
      };
    }

    if (data.maxAmount !== undefined && data.maxAmount < 0) {
      return {
        error: "Maximum amount cannot be negative",
        data: null,
      };
    }

    if (
      data.minAmount !== undefined &&
      data.maxAmount !== undefined &&
      data.maxAmount <= data.minAmount
    ) {
      return {
        error: "Maximum amount must be greater than minimum amount",
        data: null,
      };
    }

    // Validate repayment period if provided
    if (
      data.repaymentPeriodDays !== undefined &&
      data.repaymentPeriodDays < 1
    ) {
      return {
        error: "Repayment period must be at least 1 day",
        data: null,
      };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.minAmount !== undefined) updateData.minAmount = data.minAmount;
    if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount;
    if (data.interestRate !== undefined)
      updateData.interestRate = data.interestRate;
    if (data.repaymentPeriodDays !== undefined)
      updateData.repaymentPeriodDays = data.repaymentPeriodDays;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.interestType !== undefined) updateData.interestType = data.interestType;
    if (data.interestPeriod !== undefined) updateData.interestPeriod = data.interestPeriod;

    const loanProduct = await db.loanProduct.update({
      where: { id: data.id },
      data: updateData,
    });

    revalidatePath("/dashboard/loan-products");
    return {
      error: null,
      data: loanProduct,
    };
  } catch (error) {
    console.error("Error updating loan product:", error);
    return {
      error: "Failed to update loan product. Please try again.",
      data: null,
    };
  }
}

// Delete loan product (check if it has dependencies)
export async function deleteLoanProduct(id: string) {
  try {
    // Check if loan product has dependencies
    const loanProduct = await db.loanProduct.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            loanApplications: true,
          },
        },
      },
    });

    if (!loanProduct) {
      return {
        error: "Loan product not found",
        data: null,
      };
    }

    // Check if loan product has any associated loan applications
    if (loanProduct._count.loanApplications > 0) {
      return {
        error: `Cannot delete loan product. It has ${loanProduct._count.loanApplications} associated loan applications.`,
        data: null,
      };
    }

    await db.loanProduct.delete({
      where: { id },
    });

    revalidatePath("/dashboard/loan-products");
    return {
      error: null,
      data: { message: "Loan product deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting loan product:", error);
    return {
      error: "Failed to delete loan product. Please try again.",
      data: null,
    };
  }
}

// Toggle loan product active status
export async function toggleLoanProductStatus(id: string, isActive: boolean) {
  try {
    const loanProduct = await db.loanProduct.update({
      where: { id },
      data: {
        isActive,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/loan-products");
    return {
      error: null,
      data: loanProduct,
    };
  } catch (error) {
    console.error("Error toggling loan product status:", error);
    return {
      error: "Failed to update loan product status. Please try again.",
      data: null,
    };
  }
}

// Get loan products statistics
export async function getLoanProductsStats() {
  try {
    const [totalProducts, activeProducts, totalApplications] =
      await Promise.all([
        db.loanProduct.count(),
        db.loanProduct.count({ where: { isActive: true } }),
        db.loanApplication.count(),
      ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      totalApplications,
    };
  } catch (error) {
    console.error("Error fetching loan products statistics:", error);
    return {
      totalProducts: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      totalApplications: 0,
    };
  }
}

// Get all loan applications with related data
export async function getAllLoanApplications() {
  try {
    const applications = await db.loanApplication.findMany({
      include: {
        member: {
          include: {
            user: true,
            // @ts-ignore
            account: true,
          },
        },
        loanProduct: true,
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        loan: {
          select: {
            id: true,
            amountGranted: true,
            totalAmountDue: true,
            outstandingBalance: true,
            disbursementDate: true,
            dueDate: true,
          },
        },
      },
      orderBy: {
        applicationDate: "desc",
      },
    });

    return applications;
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    return [];
  }
}

// Get active loan products for application form
export async function getActiveLoanProducts() {
  try {
    const products = await db.loanProduct.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return products;
  } catch (error) {
    console.error("Error fetching active loan products:", error);
    return [];
  }
}

// Get loan application statistics
export async function getLoanApplicationStatistics() {
  try {
    const [pending, approved, rejected, disbursed, totalAmountResult] =
      await Promise.all([
        db.loanApplication.count({
          where: { status: "PENDING" },
        }),
        db.loanApplication.count({
          where: { status: "APPROVED" },
        }),
        db.loanApplication.count({
          where: { status: "REJECTED" },
        }),
        db.loan.count({
          where: { status: "ACTIVE" },
        }),
        db.loan.aggregate({
          _sum: {
            amountGranted: true,
          },
        }),
      ]);

    return {
      pending,
      approved,
      rejected,
      disbursed,
      totalAmount: totalAmountResult._sum.amountGranted || 0,
    };
  } catch (error) {
    console.error("Error fetching loan application statistics:", error);
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      disbursed: 0,
      totalAmount: 0,
    };
  }
}
// ("use server");

// import { db } from "@/prisma/db";
// import { revalidatePath } from "next/cache";
// import {
//   createAccountType,
//   deleteAccountType,
//   getAllAccountTypes,
//   updateAccountType,
// } from "@/actions/accountType";

// export async function getAllLoanProducts() {
//   try {
//     const items = await db.loanProduct.findMany({
//       orderBy: { createdAt: "desc" },
//     });
//     return items;
//   } catch (e) {
//     console.error("getAllLoanProducts error", e);
//     return [];
//   }
// }

// export async function createLoanProduct(data: {
//   name: string;
//   minAmount: number;
//   maxAmount: number;
//   interestRate: number;
//   repaymentPeriodDays: number;
//   description?: string;
//   isActive?: boolean;
// }) {
//   try {
//     if (!data.name || data.name.length < 3)
//       return { error: "Name must be at least 3 characters", data: null };
//     if (data.interestRate < 0 || data.interestRate > 100)
//       return { error: "Interest must be 0 - 100%", data: null };
//     if (data.minAmount < 0 || data.maxAmount < data.minAmount)
//       return { error: "Amount limits are invalid", data: null };

//     const created = await db.loanProduct.create({
//       data: {
//         name: data.name.trim(),
//         minAmount: Number(data.minAmount),
//         maxAmount: Number(data.maxAmount),
//         interestRate: Number(data.interestRate),
//         repaymentPeriodDays: Number(data.repaymentPeriodDays),
//         description: data.description?.trim() || null,
//         isActive: data.isActive ?? true,
//       },
//     });
//     revalidatePath("/dashboard/configurations/accounts");
//     return { error: null, data: created };
//   } catch (e) {
//     console.error("createLoanProduct error", e);
//     return { error: "Failed to create loan product", data: null };
//   }
// }

// export async function updateLoanProduct(data: {
//   id: string;
//   name?: string;
//   minAmount?: number;
//   maxAmount?: number;
//   interestRate?: number;
//   repaymentPeriodDays?: number;
//   description?: string;
//   isActive?: boolean;
// }) {
//   try {
//     const update: any = { updatedAt: new Date() };
//     if (data.name !== undefined) update.name = data.name.trim();
//     if (data.minAmount !== undefined) update.minAmount = Number(data.minAmount);
//     if (data.maxAmount !== undefined) update.maxAmount = Number(data.maxAmount);
//     if (data.interestRate !== undefined)
//       update.interestRate = Number(data.interestRate);
//     if (data.repaymentPeriodDays !== undefined)
//       update.repaymentPeriodDays = Number(data.repaymentPeriodDays);
//     if (data.description !== undefined)
//       update.description = data.description?.trim() || null;
//     if (data.isActive !== undefined) update.isActive = data.isActive;

//     const updated = await db.loanProduct.update({
//       where: { id: data.id },
//       data: update,
//     });
//     revalidatePath("/dashboard/configurations/accounts");
//     return { error: null, data: updated };
//   } catch (e) {
//     console.error("updateLoanProduct error", e);
//     return { error: "Failed to update loan product", data: null };
//   }
// }

// export async function deleteLoanProduct(id: string) {
//   try {
//     await db.loanProduct.delete({ where: { id } });
//     revalidatePath("/dashboard/configurations/accounts");
//     return { error: null, data: { id } };
//   } catch (e) {
//     console.error("deleteLoanProduct error", e);
//     return { error: "Failed to delete loan product", data: null };
//   }
// }// skksks?
