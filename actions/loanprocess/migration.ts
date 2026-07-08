// actions/loanprocess/migration.ts
"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/config/useAuth";
import { LoanMigrationService, MigrationRow } from "@/services/loan-migration.service";

export interface MigrateLoanData {
  memberId: string;
  loanProductId: string;
  amountGranted: number;
  dateDisbursed: Date;
  outstandingBalance: number;
  repaymentPeriodMonths: number;
  interestRate: number;
  loanOfficerId?: string;
  notes?: string;
  interestPeriod?: "MONTHLY" | "ANNUAL";
}

/**
 * Legacy singular loan migration action.
 * Now refactored to use the unified LoanMigrationService.
 */
export async function migrateLegacyLoan(data: MigrateLoanData) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!["ADMIN", "MANAGER", "BRANCHMANAGER", "LOANOFFICER"].includes(user.role)) {
        return { success: false, error: "Only admins and managers can migrate loans." };
    }

    const row: MigrationRow = {
        memberId: data.memberId,
        loanProductId: data.loanProductId,
        amountGranted: data.amountGranted,
        dateDisbursed: data.dateDisbursed.toISOString(),
        outstandingBalance: data.outstandingBalance,
        repaymentPeriodMonths: data.repaymentPeriodMonths,
        interestRate: data.interestRate,
        notes: data.notes,
        interestPeriod: data.interestPeriod,
    };

    const loan = await LoanMigrationService.migrateSingleLoan(
        row,
        data.loanOfficerId || user.id,
        user.branchId
    );

    revalidatePath("/dashboard/loans");
    return { success: true, data: loan };

  } catch (error: any) {
    console.error("Error migrating loan via legacy action:", error);
    return { success: false, error: error.message || "Failed to migrate loan" };
  }
}
