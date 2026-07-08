"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, AssetStatus } from "@prisma/client";

type CreateFixedAssetInput = {
  assetName: string;
  assetType: "FIXED" | "CURRENT";
  classificationCode: string;
  description?: string;
  purchaseDate: Date;
  purchasePrice: number;
  supplier?: string;
  invoiceNumber?: string;
  depreciationRate: number;
  usefulLifeYears: number;
  salvageValue?: number;
  location?: string;
  serialNumber?: string;
  model?: string;
  branchId?: string;
  quantity?: number;
  receiptNo: string;
  paymentSourceAccountCode: string; // Account code to credit (e.g. 102001)
};

type ServerActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Create a new Asset and sync to Chart of Accounts
 */
export async function createFixedAsset(
  data: CreateFixedAssetInput
): Promise<ServerActionResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
      return {
        success: false,
        error: "You don't have permission to manage assets.",
      };
    }

    // Generate Asset Code (e.g., FA-001 or CA-001)
    const prefix = data.assetType === "FIXED" ? "FA" : "CA";
    const count = await db.fixedAsset.count({
        where: { assetType: data.assetType }
    });
    const assetCode = `${prefix}-${(count + 1).toString().padStart(5, "0")}`;

    const result = await db.$transaction(async (tx) => {
      // 1. Find the parent classification in COA
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { accountCode: data.classificationCode }
      });

      if (!parentAccount) {
        throw new Error(`Classification account (${data.classificationCode}) not found. Please verify COA.`);
      }

      const category = parentAccount.category || parentAccount.accountName;

      // 2. Create Asset
      const asset = await tx.fixedAsset.create({
        data: {
          assetCode,
          assetType: data.assetType,
          assetName: data.assetName,
          category: category,
          description: data.description,
          purchaseDate: data.purchaseDate,
          purchasePrice: data.purchasePrice,
          currentValue: data.purchasePrice, // Initial value
          supplier: data.supplier,
          invoiceNumber: data.invoiceNumber,
          depreciationRate: data.depreciationRate,
          usefulLifeYears: data.usefulLifeYears,
          salvageValue: data.salvageValue || 0,
          location: data.location,
          serialNumber: data.serialNumber,
          model: data.model,
          quantity: data.quantity || 1,
          receiptNo: data.receiptNo,
          branchId: data.branchId,
          status: AssetStatus.ACTIVE,
        },
      });

      // 3. Sync to Chart of Accounts (Hub)
      // Strategy: Place under the selected classification (Level 3 or 4)
      
      const parentCode = data.classificationCode;
      
      // Generate COA Code (e.g. 101301xx for individual assets under Boardroom Furniture)
      // Find the highest code under the parent prefix
      const latestAssetAccount = await tx.chartOfAccount.findFirst({
        where: { 
          accountCode: { startsWith: parentCode },
          level: parentAccount.level + 1
        },
        orderBy: { accountCode: "desc" }
      });

      let nextCodeInt = 1;
      if (latestAssetAccount) {
        // Extract the suffix (e.g., from 10130101 get 01)
        const suffix = latestAssetAccount.accountCode.substring(parentCode.length);
        if (suffix) {
            nextCodeInt = parseInt(suffix) + 1;
        }
      }
      const coaCode = `${parentCode}${nextCodeInt.toString().padStart(2, "0")}`;

       const coaAccount = await tx.chartOfAccount.create({
         data: {
           accountName: `${data.assetName} (${assetCode})`,
           accountCode: coaCode,
           fullCode: coaCode,
           ledgerType: "ASSETS",
           debitCredit: "DR", 
           isActive: true,
           level: parentAccount.level + 1,
           parentId: parentAccount.id,
           description: `Fixed Asset: ${data.assetName} [${category}]`,
           category: category
         }
       });

       // 4. Determine Depreciation Accounts
       let depExpCode = "502800"; // Generic Depreciation Expense
       if (parentCode.startsWith("1012")) depExpCode = "502801"; // Motorcycle/Vehicle
       else if (parentCode.startsWith("1013")) depExpCode = "502802"; // Furniture
       else if (parentCode.startsWith("1014")) depExpCode = "502804"; // Computers
       else if (parentCode.startsWith("1015")) depExpCode = "502807"; // Other equipment
       
       const depExpAccount = await tx.chartOfAccount.findFirst({ where: { accountCode: depExpCode } });

       // 5. Update Asset with Account IDs
       await tx.fixedAsset.update({
         where: { id: asset.id },
         data: {
           accountId: coaAccount.id,
           depreciationExpenseAccountId: depExpAccount?.id || null,
         }
       });

       // 6. Create Journal Entry for Purchase
       const sourceAccount = await tx.chartOfAccount.findFirst({
         where: { accountCode: data.paymentSourceAccountCode, isActive: true }
       });

       if (!sourceAccount) {
         throw new Error(`Source account (${data.paymentSourceAccountCode}) not found.`);
       }

       const entryNumber = `JE-ASSET-PURCHASE-${Date.now()}`;
       const totalCost = data.purchasePrice * (data.quantity || 1);

       // Debit: Asset Account
       await tx.journalEntry.create({
         data: {
           entryNumber,
           accountId: coaAccount.id,
           debitAmount: totalCost,
           creditAmount: 0,
           description: `Purchase of Asset: ${data.assetName} (${assetCode})`,
           reference: data.receiptNo,
           createdByUserId: user.id,
         }
       });

       // Credit: Source Account (Cash/Bank)
       await tx.journalEntry.create({
         data: {
           entryNumber,
           accountId: sourceAccount.id,
           debitAmount: 0,
           creditAmount: totalCost,
           description: `Payment for Asset: ${data.assetName} (${assetCode})`,
           reference: data.receiptNo,
           createdByUserId: user.id,
         }
       });

       // Update Balances
       await tx.chartOfAccount.update({
         where: { id: coaAccount.id },
         data: { balance: { increment: totalCost }, debitBalance: { increment: totalCost } }
       });

       await tx.chartOfAccount.update({
         where: { id: sourceAccount.id },
         data: { balance: { decrement: totalCost }, creditBalance: { increment: totalCost } }
       });

       return asset;
    });

    revalidatePath("/dashboard/accounting/chart-of-accounts");
    // revalidatePath("/dashboard/fixed-assets"); // Future route

    return { success: true, data: result };
  } catch (error) {
    console.error("Error creating fixed asset:", error);
    return { success: false, error: "Failed to create fixed asset" };
  }
}
