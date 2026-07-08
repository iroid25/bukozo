"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/prisma/db";

// Validation schema for loan product
const loanProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  minAmount: z.number().min(0, "Minimum amount must be positive"),
  maxAmount: z.number().min(0, "Maximum amount must be positive"),
  interestRate: z
    .number()
    .min(0, "Interest rate must be positive")
    .max(300, "Interest rate cannot exceed 300%"),
  repaymentPeriodDays: z
    .number()
    .int()
    .min(1, "Repayment period must be at least 1 day"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).default("FLAT_RATE"),
  ledgerAccountId: z.string().optional().nullable(),
  interestAccountId: z.string().optional().nullable(),
  penaltyAccountId: z.string().optional().nullable(),
  feeAccountId: z.string().optional().nullable(),
});

export async function getLoanProductDetails(loanProductId: string) {
  try {
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: loanProductId },
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
          orderBy: {
            applicationDate: "desc",
          },
          take: 50, // Limit to recent 50 applications
        },
      },
    });

    if (!loanProduct) {
      notFound();
    }

    return loanProduct;
  } catch (error) {
    console.error("Error fetching loan product details:", error);
    throw new Error("Failed to fetch loan product details");
  }
}

export async function getLoanProductApplications(
  loanProductId: string,
  page: number = 1,
  limit: number = 20,
  status?: string
) {
  try {
    const skip = (page - 1) * limit;

    const whereClause: any = {
      loanProductId: loanProductId,
    };

    if (status && status !== "all") {
      whereClause.status = status;
    }

    const [applications, totalCount] = await Promise.all([
      db.loanApplication.findMany({
        where: whereClause,
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
        orderBy: {
          applicationDate: "desc",
        },
        skip,
        take: limit,
      }),
      db.loanApplication.count({
        where: whereClause,
      }),
    ]);

    return {
      applications,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    throw new Error("Failed to fetch loan applications");
  }
}

export async function getLoanProductStats(loanProductId: string) {
  try {
    const [
      totalApplications,
      approvedApplications,
      totalDisbursed,
      activeLoans,
      pendingApplications,
    ] = await Promise.all([
      db.loanApplication.count({
        where: { loanProductId },
      }),
      db.loanApplication.count({
        where: {
          loanProductId,
          status: "APPROVED",
        },
      }),
      db.loan.aggregate({
        where: {
          loanApplication: {
            loanProductId,
          },
        },
        _sum: { amountGranted: true },
        _count: true,
      }),
      db.loan.count({
        where: {
          loanApplication: {
            loanProductId,
          },
          status: {
            in: ["DISBURSED", "APPROVED"],
          },
        },
      }),
      db.loanApplication.count({
        where: {
          loanProductId,
          status: "PENDING",
        },
      }),
    ]);

    const outstandingBalance = await db.loan.aggregate({
      where: {
        loanApplication: {
          loanProductId,
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
      rejectedApplications:
        totalApplications - approvedApplications - pendingApplications,
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
  } catch (error) {
    console.error("Error fetching loan product stats:", error);
    throw new Error("Failed to fetch loan product stats");
  }
}

export async function updateLoanProduct(
  loanProductId: string,
  formData: FormData
) {
  try {
    // Extract and validate form data
    const rawData = {
      name: formData.get("name") as string,
      minAmount: parseFloat(formData.get("minAmount") as string),
      maxAmount: parseFloat(formData.get("maxAmount") as string),
      interestRate: parseFloat(formData.get("interestRate") as string),
      repaymentPeriodDays: parseInt(
        formData.get("repaymentPeriodDays") as string
      ),
      description: (formData.get("description") as string) || undefined,
      isActive: formData.get("isActive") === "true",
      interestType: (formData.get("interestType") as "FLAT_RATE" | "REDUCING_BALANCE") || "FLAT_RATE",
    };

    // Validate the data
    const validatedData = loanProductSchema.parse(rawData);

    // Additional business logic validation
    if (validatedData.maxAmount <= validatedData.minAmount) {
      throw new Error("Maximum amount must be greater than minimum amount");
    }

    // Check if name is unique (excluding current product)
    const existingProduct = await db.loanProduct.findFirst({
      where: {
        name: validatedData.name,
        id: { not: loanProductId },
      },
    });

    if (existingProduct) {
      throw new Error("A loan product with this name already exists");
    }

    // Update the loan product
    const updatedProduct = await db.loanProduct.update({
      where: { id: loanProductId },
      data: validatedData,
    });

    // Revalidate the page
    revalidatePath(`/loan-products/${loanProductId}`);
    revalidatePath("/loan-products");

    return { success: true, data: updatedProduct };
  } catch (error) {
    console.error("Error updating loan product:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation failed",
        details: error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        ),
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update loan product",
    };
  }
}

export async function toggleLoanProductStatus(loanProductId: string) {
  try {
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: loanProductId },
      select: { isActive: true },
    });

    if (!loanProduct) {
      throw new Error("Loan product not found");
    }

    const updatedProduct = await db.loanProduct.update({
      where: { id: loanProductId },
      data: { isActive: !loanProduct.isActive },
    });

    revalidatePath(`/loan-products/${loanProductId}`);
    revalidatePath("/loan-products");

    return {
      success: true,
      data: updatedProduct,
      message: `Loan product ${updatedProduct.isActive ? "activated" : "deactivated"} successfully`,
    };
  } catch (error) {
    console.error("Error toggling loan product status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

export async function deleteLoanProduct(loanProductId: string) {
  try {
    // Check if there are any loan applications
    const applicationCount = await db.loanApplication.count({
      where: { loanProductId },
    });

    if (applicationCount > 0) {
      throw new Error(
        "Cannot delete loan product with existing applications. Consider deactivating instead."
      );
    }

    await db.loanProduct.delete({
      where: { id: loanProductId },
    });

    revalidatePath("/loan-products");

    return { success: true, message: "Loan product deleted successfully" };
  } catch (error) {
    console.error("Error deleting loan product:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete loan product",
    };
  }
}

export async function createLoanProduct(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name") as string,
      minAmount: parseFloat(formData.get("minAmount") as string),
      maxAmount: parseFloat(formData.get("maxAmount") as string),
      interestRate: parseFloat(formData.get("interestRate") as string),
      repaymentPeriodDays: parseInt(
        formData.get("repaymentPeriodDays") as string
      ),
      description: (formData.get("description") as string) || undefined,
      isActive: formData.get("isActive") === "true",
      interestType: (formData.get("interestType") as "FLAT_RATE" | "REDUCING_BALANCE") || "FLAT_RATE",
    };

    const validatedData = loanProductSchema.parse(rawData);

    if (validatedData.maxAmount <= validatedData.minAmount) {
      throw new Error("Maximum amount must be greater than minimum amount");
    }

    const existingProduct = await db.loanProduct.findFirst({
      where: { name: validatedData.name },
    });

    if (existingProduct) {
      throw new Error("A loan product with this name already exists");
    }

    const newProduct = await db.loanProduct.create({
      data: validatedData,
    });

    revalidatePath("/loan-products");

    return { success: true, data: newProduct };
  } catch (error) {
    console.error("Error creating loan product:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation failed",
        details: error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        ),
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create loan product",
    };
  }
}
