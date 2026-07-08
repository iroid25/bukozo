"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

type CreateLiabilityAccountInput = {
  accountName: string;
  description?: string;
  accountCode?: string;
  openingBalance?: number;
};

type ServerActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Create a new Liability Account
 */
export async function createLiabilityAccount(
  data: CreateLiabilityAccountInput
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      return {
        success: false,
        error: "You don't have permission to create accounts.",
      };
    }

    // Generate Code if not provided (2xxxx for Liabilities)
    let accountCode = data.accountCode;
    if (!accountCode) {
        const count = await db.chartOfAccount.count({
            where: { ledgerType: "LIABILITIES" }
        });
        // Assuming 2xxxx is standard for Liabilities
        accountCode = `2${(count + 1).toString().padStart(4, "0")}`;
    }

    // Check for duplicate code
    const existing = await db.chartOfAccount.findUnique({
        where: { accountCode }
    });
    
    if (existing) {
        // If auto-generated conflicted or user provided duplicate
        if (!data.accountCode) {
             accountCode = `${accountCode}-${Date.now().toString().slice(-4)}`;
        } else {
            return { success: false, error: "Account code already exists." };
        }
    }

    const account = await db.chartOfAccount.create({
      data: {
        accountName: data.accountName,
        accountCode: accountCode!,
        fullCode: accountCode!,
        ledgerType: "LIABILITIES",
        debitCredit: "CR", // Liabilities are Credit
        isActive: true,
        level: 1, // Defaulting to Level 1
        description: data.description,
        balance: data.openingBalance || 0,
        creditBalance: data.openingBalance || 0, // Opening balance is credit 
      },
    });

    revalidatePath("/dashboard/accounts/liabilities");
    revalidatePath("/dashboard/accounting/chart-of-accounts");

    return { success: true, data: account };
  } catch (error) {
    console.error("Error creating liability account:", error);
    return { success: false, error: "Failed to create liability account" };
  }
}
