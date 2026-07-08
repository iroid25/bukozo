"use server";

import { db } from "@/prisma/db";

/**
 * Fetch child accounts for a given parent COA code or ID
 */
export async function getCoaChildren(parentIdOrCode: string) {
  try {
    const parent = await db.chartOfAccount.findFirst({
      where: {
        OR: [
          { id: parentIdOrCode },
          { accountCode: parentIdOrCode }
        ]
      }
    });

    if (!parent) return [];

    const children = await db.chartOfAccount.findMany({
      where: {
        parentId: parent.id,
        isActive: true,
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    return children;
  } catch (error) {
    console.error("Error fetching COA children:", error);
    return [];
  }
}

/**
 * Fetch sub-accounts for categorization based on asset type
 */
export async function getAssetClassifications(type: "FIXED" | "CURRENT") {
  try {
    const prefix = type === "FIXED" ? ["101", "104"] : ["102", "106"];
    
    const accounts = await db.chartOfAccount.findMany({
      where: {
        OR: prefix.map(p => ({ accountCode: { startsWith: p } })),
        level: { in: [2, 3, 4] },
        isActive: true,
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    return accounts;
  } catch (error) {
    console.error(`Error fetching ${type} asset classifications:`, error);
    return [];
  }
}

/**
 * Fetch accounts suitable for making payments (Cash/Bank)
 */
export async function getPaymentAccounts() {
  try {
    const accounts = await db.chartOfAccount.findMany({
      where: {
        accountCode: { startsWith: "102" }, // Cash & Bank
        level: { gte: 3 },
        isActive: true,
      },
      orderBy: { accountCode: "asc" },
    });
    return accounts;
  } catch (error) {
    console.error("Error fetching payment accounts:", error);
    return [];
  }
}
