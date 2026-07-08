// actions/incomeandexp/fees.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { serializeWithdrawalFeeTiers, WithdrawalFeeTier } from "@/lib/fees";

type ServerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Read fee-related fields from AccountType for settings UI.
 */
export async function getFeeSettings(): Promise<
  ServerResult<
    Array<{
      id: string;
      name: string;
      monthlyCharge: number | null;
      flatWithdrawalFee: number | null;
      withdrawalFeeTiers: string | null;
    }>
  >
> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const accountTypes = await db.accountType.findMany({
      select: {
        id: true,
        name: true,
        monthlyCharge: true,
        flatWithdrawalFee: true,
        withdrawalFeeTiers: true,
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: accountTypes };
  } catch (e) {
    console.error("getFeeSettings error:", e);
    return { success: false, error: "Failed to load fee settings" };
  }
}

/**
 * Update a single AccountType's fee settings.
 * You can pass any subset of fields.
 */
export async function updateFeeSettings(params: {
  accountTypeId: string;
  monthlyCharge?: number | null;
  flatWithdrawalFee?: number | null;
  withdrawalFeeTiers?: WithdrawalFeeTier[];
}): Promise<ServerResult<true>> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Unauthorized" };

    if (!["ADMIN", "ACCOUNTANT"].includes(String(user.role))) {
      return { success: false, error: "Forbidden: Admin/Accountant only" };
    }

    const payload: any = {};

    if (params.monthlyCharge !== undefined) {
      if (params.monthlyCharge !== null && params.monthlyCharge < 0) {
        return { success: false, error: "Monthly charge cannot be negative" };
      }
      payload.monthlyCharge = params.monthlyCharge;
    }

    if (params.flatWithdrawalFee !== undefined) {
      if (params.flatWithdrawalFee !== null && params.flatWithdrawalFee < 0) {
        return { success: false, error: "Flat fee cannot be negative" };
      }
      payload.flatWithdrawalFee = params.flatWithdrawalFee;
    }

    if (params.withdrawalFeeTiers !== undefined) {
      payload.withdrawalFeeTiers = serializeWithdrawalFeeTiers(
        params.withdrawalFeeTiers || []
      );
    }

    await db.accountType.update({
      where: { id: params.accountTypeId },
      data: payload,
    });

    // Revalidate spots that rely on fees
    revalidatePath("/dashboard/settings/fees");
    revalidatePath("/dashboard/withdraw-test");
    revalidatePath("/dashboard/withdrawals");
    revalidatePath("/dashboard/income");

    return { success: true, data: true };
  } catch (e) {
    console.error("updateFeeSettings error:", e);
    return { success: false, error: "Failed to update settings" };
  }
}
