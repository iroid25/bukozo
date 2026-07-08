
"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

export type FeeConfigKey = 
  | "MOBILE_MONEY_FEES" 
  | "AGENT_WITHDRAWAL_FEES" 
  | "AGENT_DEPOSIT_FEES" 
  | "SCHOOL_FEES_COMMISSION";

export async function getFeeConfig(key: FeeConfigKey) {
  try {
    const config = await db.globalFeeConfiguration.findUnique({
      where: { key },
    });
    
    if (!config) return { success: true, data: null };
    
    return { success: true, data: config.value };
  } catch (error) {
    console.error(`Error fetching fee config for ${key}:`, error);
    return { success: false, error: "Failed to fetch configuration" };
  }
}

export async function updateFeeConfig(key: FeeConfigKey, value: any, userId: string) {
  try {
    await db.globalFeeConfiguration.upsert({
      where: { key },
      create: {
        key,
        value,
        updatedBy: userId,
      },
      update: {
        value,
        updatedBy: userId,
      },
    });

    revalidatePath("/dashboard/settings/fees");
    return { success: true };
  } catch (error) {
    console.error(`Error updating fee config for ${key}:`, error);
    return { success: false, error: "Failed to update configuration" };
  }
}
