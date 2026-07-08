// // actions/accountTypes.ts
// "use server";

// import { db } from "@/prisma/db";
// import {
//   AccountTypeCreateDTO,
//   AccountTypeUpdateDTO,
//   normalizeAccountTypeName,
//   formatAccountTypeName,
//   isValidAccountTypeName,
// } from "@/types/accountTypes";
// import { revalidatePath } from "next/cache";

// // Fetch all account types
// export async function getAllAccountTypes() {
//   try {
//     const accountTypes = await db.accountType.findMany({
//       include: {
//         _count: {
//           select: {
//             accounts: true,
//           },
//         },
//       },
//       orderBy: {
//         createdAt: "desc",
//       },
//     });

//     // Transform the data to normalize names for display
//     return accountTypes.map((accountType: any) => ({
//       ...accountType,
//       name: normalizeAccountTypeName(accountType.name),
//     }));
//   } catch (error) {
//     console.error("Error fetching account types:", error);
//     return [];
//   }
// }

// // Fetch single account type by ID
// export async function getAccountTypeById(id: string) {
//   try {
//     const accountType = await db.accountType.findUnique({
//       where: { id },
//       include: {
//         _count: {
//           select: {
//             accounts: true,
//           },
//         },
//       },
//     });

//     if (!accountType) {
//       return null;
//     }

//     // Normalize the name for display
//     return {
//       ...accountType,
//       name: normalizeAccountTypeName(accountType.name),
//     };
//   } catch (error) {
//     console.error("Error fetching account type:", error);
//     return null;
//   }
// }

// // Create new account type
// export async function createAccountType(data: AccountTypeCreateDTO) {
//   try {
//     // Validate and format the name
//     if (!isValidAccountTypeName(data.name)) {
//       return {
//         error: "Account type name must be between 3 and 50 characters",
//         data: null,
//       };
//     }

//     const formattedName = formatAccountTypeName(data.name);

//     // Check if account type name already exists (case-insensitive)
//     const existingAccountType = await db.accountType.findFirst({
//       where: {
//         name: {
//           equals: formattedName,
//           mode: "insensitive",
//         },
//       },
//     });

//     if (existingAccountType) {
//       return {
//         error: "An account type with this name already exists",
//         data: null,
//       };
//     }

//     // Validate interest rate
//     if (data.interestRate < 0 || data.interestRate > 100) {
//       return {
//         error: "Interest rate must be between 0 and 100",
//         data: null,
//       };
//     }

//     // Validate minimum balance
//     if (data.minBalance < 0) {
//       return {
//         error: "Minimum balance cannot be negative",
//         data: null,
//       };
//     }

//     // Validate max withdrawal if provided
//     if (
//       data.maxWithdrawal !== null &&
//       data.maxWithdrawal !== undefined &&
//       data.maxWithdrawal < 0
//     ) {
//       return {
//         error: "Maximum withdrawal cannot be negative",
//         data: null,
//       };
//     }

//     const accountType = await db.accountType.create({
//       data: {
//         name: formattedName,
//         interestRate: data.interestRate,
//         minBalance: data.minBalance,
//         maxWithdrawal: data.maxWithdrawal || null,
//         isLoanEligible: data.isLoanEligible ?? true,
//         isDefault: data.isDefault ?? false,
//       },
//     });

//     revalidatePath("/dashboard/account-types");
//     return {
//       error: null,
//       data: {
//         ...accountType,
//         name: normalizeAccountTypeName(accountType.name),
//       },
//     };
//   } catch (error) {
//     console.error("Error creating account type:", error);
//     return {
//       error: "Failed to create account type. Please try again.",
//       data: null,
//     };
//   }
// }

// // Update existing account type
// export async function updateAccountType(data: AccountTypeUpdateDTO) {
//   try {
//     let formattedName;

//     // Validate and format name if it's being updated
//     if (data.name !== undefined) {
//       if (!isValidAccountTypeName(data.name)) {
//         return {
//           error: "Account type name must be between 3 and 50 characters",
//           data: null,
//         };
//       }

//       formattedName = formatAccountTypeName(data.name);

//       // Check if name conflicts with existing account type
//       const existingAccountType = await db.accountType.findFirst({
//         where: {
//           name: {
//             equals: formattedName,
//             mode: "insensitive",
//           },
//           NOT: { id: data.id },
//         },
//       });

//       if (existingAccountType) {
//         return {
//           error: "An account type with this name already exists",
//           data: null,
//         };
//       }
//     }

//     // Validate interest rate if provided
//     if (
//       data.interestRate !== undefined &&
//       (data.interestRate < 0 || data.interestRate > 100)
//     ) {
//       return {
//         error: "Interest rate must be between 0 and 100",
//         data: null,
//       };
//     }

//     // Validate minimum balance if provided
//     if (data.minBalance !== undefined && data.minBalance < 0) {
//       return {
//         error: "Minimum balance cannot be negative",
//         data: null,
//       };
//     }

//     // Validate max withdrawal if provided
//     if (
//       data.maxWithdrawal !== null &&
//       data.maxWithdrawal !== undefined &&
//       data.maxWithdrawal < 0
//     ) {
//       return {
//         error: "Maximum withdrawal cannot be negative",
//         data: null,
//       };
//     }

//     // Build update data
//     const updateData: any = {
//       updatedAt: new Date(),
//     };

//     if (formattedName) updateData.name = formattedName;
//     if (data.interestRate !== undefined)
//       updateData.interestRate = data.interestRate;
//     if (data.minBalance !== undefined) updateData.minBalance = data.minBalance;
//     if (data.maxWithdrawal !== undefined)
//       updateData.maxWithdrawal = data.maxWithdrawal;
//     if (data.isLoanEligible !== undefined)
//       updateData.isLoanEligible = data.isLoanEligible;
//     if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

//     const accountType = await db.accountType.update({
//       where: { id: data.id },
//       data: updateData,
//     });

//     revalidatePath("/dashboard/account-types");
//     return {
//       error: null,
//       data: {
//         ...accountType,
//         name: normalizeAccountTypeName(accountType.name),
//       },
//     };
//   } catch (error) {
//     console.error("Error updating account type:", error);
//     return {
//       error: "Failed to update account type. Please try again.",
//       data: null,
//     };
//   }
// }

// // Delete account type (check if it has dependencies)
// export async function deleteAccountType(id: string) {
//   try {
//     // Check if account type has dependencies
//     const accountType = await db.accountType.findUnique({
//       where: { id },
//       include: {
//         _count: {
//           select: {
//             accounts: true,
//           },
//         },
//       },
//     });

//     if (!accountType) {
//       return {
//         error: "Account type not found",
//         data: null,
//       };
//     }

//     // Check if account type has any associated accounts
//     if (accountType._count.accounts > 0) {
//       return {
//         error: `Cannot delete account type. It has ${accountType._count.accounts} associated accounts.`,
//         data: null,
//       };
//     }

//     await db.accountType.delete({
//       where: { id },
//     });

//     revalidatePath("/dashboard/account-types");
//     return {
//       error: null,
//       data: { message: "Account type deleted successfully" },
//     };
//   } catch (error) {
//     console.error("Error deleting account type:", error);
//     return {
//       error: "Failed to delete account type. Please try again.",
//       data: null,
//     };
//   }
// }

// // Get account types for dropdown/select components
// export async function getAccountTypesForCreation() {
//   try {
//     const accountTypes = await db.accountType.findMany({
//       select: {
//         id: true,
//         name: true,
//         interestRate: true,
//         minBalance: true,
//       },
//       orderBy: {
//         name: "asc",
//       },
//     });

//     return accountTypes.map((accountType: any) => ({
//       ...accountType,
//       name: normalizeAccountTypeName(accountType.name),
//     }));
//   } catch (error) {
//     console.error("Error fetching account types for creation:", error);
//     return [];
//   }
// }

// // Toggle account type default status
// export async function toggleAccountTypeDefault(id: string, isDefault: boolean) {
//   try {
//     const accountType = await db.accountType.update({
//       where: { id },
//       data: { isDefault },
//     });

//     revalidatePath("/dashboard/account-types");
//     return {
//       error: null,
//       data: {
//         ...accountType,
//         name: normalizeAccountTypeName(accountType.name),
//       },
//     };
//   } catch (error) {
//     console.error("Error updating account type default status:", error);
//     return {
//       error: "Failed to update account type default status",
//       data: null,
//     };
//   }
// }
// action/account-type.ts
"use server";

import { db } from "@/prisma/db";
import {
  AccountTypeCreateDTO,
  AccountTypeUpdateDTO,
  normalizeAccountTypeName,
  formatAccountTypeName,
  isValidAccountTypeName,
} from "@/types/accountTypes";
import { revalidatePath } from "next/cache";
import {
  FIXED_DEPOSIT_ACCOUNT_TYPE_NAME,
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
  getFixedDepositAccountTypeDefaults,
  getVoluntarySavingsAccountTypeDefaults,
  isFixedDepositAccountTypeName,
  isVoluntarySavingsAccountTypeName,
} from "@/lib/accounting/account-type-rules";

const REVALIDATE_PATH = "/dashboard/configurations/accounts";

export async function getAllAccountTypes() {
  try {
    const rows = await db.accountType.findMany({
      include: { _count: { select: { accounts: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((x) => ({ ...x, name: normalizeAccountTypeName(x.name) }));
  } catch (e) {
    console.error("getAllAccountTypes error:", e);
    return [];
  }
}

export async function getAccountTypeById(id: string) {
  try {
    const x = await db.accountType.findUnique({
      where: { id },
      include: { _count: { select: { accounts: true } } },
    });
    if (!x) return null;
    return { ...x, name: normalizeAccountTypeName(x.name) };
  } catch (e) {
    console.error("getAccountTypeById error:", e);
    return null;
  }
}

export async function createAccountType(data: AccountTypeCreateDTO) {
  try {
    // Validate & format name
    if (!isValidAccountTypeName(data.name))
      return { error: "Account type name must be 3–50 chars", data: null };

    const name = formatAccountTypeName(data.name);
    const isVoluntarySavings = isVoluntarySavingsAccountTypeName(name);
    const isFixedDeposit = isFixedDepositAccountTypeName(name);
    const productDefaults = isVoluntarySavings
      ? getVoluntarySavingsAccountTypeDefaults(
          data.withdrawalFeeTiers ?? null,
        )
      : isFixedDeposit
        ? getFixedDepositAccountTypeDefaults()
        : null;
    const effectiveName = isVoluntarySavings
      ? VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME
      : isFixedDeposit
        ? FIXED_DEPOSIT_ACCOUNT_TYPE_NAME
        : name;

    const dupe = await db.accountType.findFirst({
      where: { name: { equals: effectiveName, mode: "insensitive" } },
    });
    if (dupe) return { error: "Account type already exists", data: null };

    // Core validations
    if (data.interestRate < 0 || data.interestRate > 100)
      return { error: "Interest must be 0–100%", data: null };

    if (data.minBalance < 0)
      return { error: "Minimum balance cannot be negative", data: null };

    if (data.maxWithdrawal != null && data.maxWithdrawal < 0)
      return { error: "Max withdrawal cannot be negative", data: null };

    // Charges / fees validations
    if (data.monthlyCharge != null && data.monthlyCharge < 0)
      return { error: "Monthly charge cannot be negative", data: null };

    if (data.flatWithdrawalFee != null && data.flatWithdrawalFee < 0)
      return { error: "Flat withdrawal fee cannot be negative", data: null };

    if (
      data.withdrawalFrequencyDays != null &&
      data.withdrawalFrequencyDays < 0
    )
      return { error: "Cooldown (days) cannot be negative", data: null };

    if (data.maxWithdrawalsPerDay != null && data.maxWithdrawalsPerDay < 0)
      return {
        error: "Max withdrawals per day cannot be negative",
        data: null,
      };

    if (data.fixedPeriodMonths != null && data.fixedPeriodMonths < 0)
      return { error: "Fixed period (months) cannot be negative", data: null };

    // Create Account Type and sync to COA
    const result = await db.$transaction(async (tx) => {
      const created = await tx.accountType.create({
        data: {
          name: effectiveName,
          interestRate: data.interestRate,
          minBalance: data.minBalance,
          maxWithdrawal: data.maxWithdrawal ?? null,
          isLoanEligible: data.isLoanEligible ?? true,
          isDefault: data.isDefault ?? false,

          // extra fields (all match Prisma)
          monthlyCharge: productDefaults?.monthlyCharge ?? data.monthlyCharge ?? null,
          flatWithdrawalFee:
            productDefaults?.flatWithdrawalFee ?? data.flatWithdrawalFee ?? null,
          withdrawalFeePercentage:
            productDefaults?.withdrawalFeePercentage ??
            data.withdrawalFeePercentage ??
            null,
          withdrawalFeeTiers:
            productDefaults?.withdrawalFeeTiers ?? data.withdrawalFeeTiers ?? null,


          withdrawalFrequencyDays:
            productDefaults?.withdrawalFrequencyDays ??
            data.withdrawalFrequencyDays ??
            null,
          maxWithdrawalsPerDay: data.maxWithdrawalsPerDay ?? null,

          hasFixedPeriod: productDefaults?.hasFixedPeriod ?? data.hasFixedPeriod ?? false,
          fixedPeriodMonths:
            productDefaults?.fixedPeriodMonths ?? data.fixedPeriodMonths ?? null,
          maturityTransferAccountType: (
            productDefaults?.maturityTransferAccountType ??
            data.maturityTransferAccountType ??
            null
          ) as string | null,

          isShareAccount: productDefaults?.isShareAccount ?? data.isShareAccount ?? false,
          canWithdraw: productDefaults?.canWithdraw ?? data.canWithdraw ?? true,
          earnsDividends: productDefaults?.earnsDividends ?? data.earnsDividends ?? false,
        },
      });

      // Sync to Chart of Accounts (Hub)
      // Liability (Savings) or Equity (Shares)
      // Shares -> EQUITY, Savings -> LIABILITIES
      const isEquity = data.isShareAccount;
      const ledgerType = isEquity ? "EQUITY" : "LIABILITIES";
      const debitCredit = "CR"; // Both are Credit nature

      // Generate COA Code
      // Liabilities: 2xxxx, Equity: 3xxxx
      const prefix = isEquity ? "3" : "2"; 
      
      const count = await tx.chartOfAccount.count({
        where: { ledgerType }
      });
      const nextNum = (count + 1).toString().padStart(4, '0');
      const generatedCode = `${prefix}${nextNum}`;

      await tx.chartOfAccount.create({
        data: {
          accountName: `Control Account - ${created.name}`, // Clarity that this is a control account
          accountCode: generatedCode,
          fullCode: generatedCode,
          ledgerType: ledgerType,
          debitCredit: debitCredit, // Liabilities/Equity are naturally Credit
          isActive: true, // Account Types usually active upon creation
          level: 1,
          description: `Auto-generated Control Account for ${created.name}`,
          category: isEquity ? "Share Capital" : "Member Deposits", // Logical grouping
          product: created.name // Link to product name
        }
      });
      
      return created;
    });

    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/dashboard/accounting/chart-of-accounts");

    return {
      error: null,
      data: { ...result, name: normalizeAccountTypeName(result.name) },
    };
  } catch (e) {
    console.error("createAccountType error:", e);
    return { error: "Failed to create account type", data: null };
  }
}

export async function updateAccountType(data: AccountTypeUpdateDTO) {
  try {
    let formattedName: string | undefined;

    const existing = await db.accountType.findUnique({
      where: { id: data.id },
    });

    if (!existing) {
      return { error: "Account type not found", data: null };
    }

    if (data.name !== undefined) {
      if (!isValidAccountTypeName(data.name)) {
        return { error: "Account type name must be 3–50 chars", data: null };
      }
      formattedName = formatAccountTypeName(data.name);

    }

    const targetName = formattedName ?? existing.name;
    const isVoluntarySavings = isVoluntarySavingsAccountTypeName(targetName);
    const isFixedDeposit = isFixedDepositAccountTypeName(targetName);
    const productDefaults = isVoluntarySavings
      ? getVoluntarySavingsAccountTypeDefaults(
          data.withdrawalFeeTiers ?? existing.withdrawalFeeTiers ?? null,
        )
      : isFixedDeposit
        ? getFixedDepositAccountTypeDefaults()
        : null;
    const canonicalName = isVoluntarySavings
      ? VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME
      : isFixedDeposit
        ? FIXED_DEPOSIT_ACCOUNT_TYPE_NAME
        : formattedName;

    if (data.name !== undefined) {
      const dupe = await db.accountType.findFirst({
        where: {
          name: { equals: canonicalName ?? formattedName, mode: "insensitive" },
          NOT: { id: data.id },
        },
      });
      if (dupe)
        return { error: "Account type with this name exists", data: null };
    }

    // Validations
    if (
      data.interestRate != null &&
      (data.interestRate < 0 || data.interestRate > 100)
    )
      return { error: "Interest must be 0–100%", data: null };

    if (data.minBalance != null && data.minBalance < 0)
      return { error: "Minimum balance cannot be negative", data: null };

    if (data.maxWithdrawal != null && data.maxWithdrawal < 0)
      return { error: "Max withdrawal cannot be negative", data: null };

    if (data.monthlyCharge != null && data.monthlyCharge < 0)
      return { error: "Monthly charge cannot be negative", data: null };

    if (data.flatWithdrawalFee != null && data.flatWithdrawalFee < 0)
      return { error: "Flat withdrawal fee cannot be negative", data: null };

    if (
      data.withdrawalFrequencyDays != null &&
      data.withdrawalFrequencyDays < 0
    )
      return { error: "Cooldown (days) cannot be negative", data: null };

    if (data.maxWithdrawalsPerDay != null && data.maxWithdrawalsPerDay < 0)
      return {
        error: "Max withdrawals per day cannot be negative",
        data: null,
      };

    if (
      data.withdrawalFeePercentage != null &&
      (data.withdrawalFeePercentage < 0 || data.withdrawalFeePercentage > 100)
    )
      return { error: "Withdrawal fee percentage must be 0–100%", data: null };

    if (data.fixedPeriodMonths != null && data.fixedPeriodMonths < 0)
      return { error: "Fixed period (months) cannot be negative", data: null };

    // Build update shape
    const updateData: any = { updatedAt: new Date() };

    if (canonicalName !== undefined) updateData.name = canonicalName;
    if (data.interestRate !== undefined)
      updateData.interestRate = data.interestRate;
    if (data.minBalance !== undefined) updateData.minBalance = data.minBalance;
    if (data.maxWithdrawal !== undefined)
      updateData.maxWithdrawal = data.maxWithdrawal;
    if (data.isLoanEligible !== undefined)
      updateData.isLoanEligible = data.isLoanEligible;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    if (productDefaults) {
      updateData.monthlyCharge = productDefaults.monthlyCharge;
      updateData.flatWithdrawalFee = productDefaults.flatWithdrawalFee;
      updateData.withdrawalFeePercentage =
        productDefaults.withdrawalFeePercentage;
      updateData.withdrawalFeeTiers = productDefaults.withdrawalFeeTiers;
      updateData.withdrawalFrequencyDays =
        productDefaults.withdrawalFrequencyDays;
      updateData.hasFixedPeriod = productDefaults.hasFixedPeriod;
      updateData.fixedPeriodMonths = productDefaults.fixedPeriodMonths;
      updateData.maturityTransferAccountType =
        productDefaults.maturityTransferAccountType;
      updateData.isShareAccount = productDefaults.isShareAccount;
      updateData.canWithdraw = productDefaults.canWithdraw;
      updateData.earnsDividends = productDefaults.earnsDividends;
    } else {
      if (data.monthlyCharge !== undefined)
        updateData.monthlyCharge = data.monthlyCharge;
      if (data.flatWithdrawalFee !== undefined)
        updateData.flatWithdrawalFee = data.flatWithdrawalFee;
      if (data.withdrawalFeePercentage !== undefined)
        updateData.withdrawalFeePercentage = data.withdrawalFeePercentage;
      if (data.withdrawalFeeTiers !== undefined)
        updateData.withdrawalFeeTiers = data.withdrawalFeeTiers;

      if (data.withdrawalFrequencyDays !== undefined)
        updateData.withdrawalFrequencyDays = data.withdrawalFrequencyDays ?? null;
      if (data.maxWithdrawalsPerDay !== undefined)
        updateData.maxWithdrawalsPerDay = data.maxWithdrawalsPerDay ?? null;

      if (data.hasFixedPeriod !== undefined)
        updateData.hasFixedPeriod = !!data.hasFixedPeriod;
      if (data.fixedPeriodMonths !== undefined)
        updateData.fixedPeriodMonths = data.fixedPeriodMonths ?? null;
      if (data.maturityTransferAccountType !== undefined)
        updateData.maturityTransferAccountType =
          (data.maturityTransferAccountType || null) as string | null;

      if (data.isShareAccount !== undefined)
        updateData.isShareAccount = !!data.isShareAccount;
      if (data.canWithdraw !== undefined)
        updateData.canWithdraw = !!data.canWithdraw;
      if (data.earnsDividends !== undefined)
        updateData.earnsDividends = !!data.earnsDividends;
    }

    if (data.ledgerAccountId !== undefined)
      updateData.ledgerAccountId = data.ledgerAccountId || null;

    const updated = await db.accountType.update({
      where: { id: data.id },
      data: updateData,
    });

    revalidatePath(REVALIDATE_PATH);
    return {
      error: null,
      data: { ...updated, name: normalizeAccountTypeName(updated.name) },
    };
  } catch (e) {
    console.error("updateAccountType error:", e);
    return { error: "Failed to update account type", data: null };
  }
}

export async function deleteAccountType(id: string) {
  try {
    const withCount = await db.accountType.findUnique({
      where: { id },
      include: { _count: { select: { accounts: true } } },
    });
    if (!withCount) return { error: "Not found", data: null };
    if (withCount._count.accounts > 0)
      return {
        error: `Has ${withCount._count.accounts} accounts; cannot delete.`,
        data: null,
      };

    await db.accountType.delete({ where: { id } });
    revalidatePath(REVALIDATE_PATH);
    return { error: null, data: { ok: true } };
  } catch (e) {
    console.error("deleteAccountType error:", e);
    return { error: "Failed to delete", data: null };
  }
}

export async function getAccountTypesForCreation() {
  try {
    const rows = await db.accountType.findMany({
      select: {
        id: true,
        name: true,
        interestRate: true,
        minBalance: true,
      },
      orderBy: { name: "asc" },
    });
    return rows.map((x) => ({ ...x, name: normalizeAccountTypeName(x.name) }));
  } catch (e) {
    console.error("getAccountTypesForCreation error:", e);
    return [];
  }
}

export async function toggleAccountTypeDefault(id: string, isDefault: boolean) {
  try {
    const updated = await db.accountType.update({
      where: { id },
      data: { isDefault },
    });
    revalidatePath(REVALIDATE_PATH);
    return {
      error: null,
      data: { ...updated, name: normalizeAccountTypeName(updated.name) },
    };
  } catch (e) {
    console.error("toggleAccountTypeDefault error:", e);
    return { error: "Failed to update default", data: null };
  }
}
