import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { VaultTransactionType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const results: any[] = [];
    
    // 1. Get all branches with active vaults
    const branches = await db.branch.findMany({
      include: {
        vaults: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    for (const branch of branches) {
      if (branch.vaults.length > 1) {
        // We have a problem!
        const [primary, ...duplicates] = branch.vaults;
        let totalMergedAmount = 0;

        await db.$transaction(async (tx) => {
          for (const duplicate of duplicates) {
            totalMergedAmount += duplicate.balance;

            // Deactivate duplicate
            await tx.vault.update({
              where: { id: duplicate.id },
              data: { 
                isActive: false
              }
            });

            // Create "Return" record for duplicate (audit trail)
            await tx.vaultTransaction.create({
              data: {
                vaultId: duplicate.id,
                type: VaultTransactionType.VAULT_TRANSFER,
                amount: -duplicate.balance,
                balanceBefore: duplicate.balance,
                balanceAfter: 0,
                description: `Balance merged into primary vault ${primary.name}`,
                performedByUserId: "SYSTEM_REMEDIATION",
              }
            });
          }

          // Update primary vault
          const newPrimaryBalance = primary.balance + totalMergedAmount;
          await tx.vault.update({
            where: { id: primary.id },
            data: { 
              balance: newPrimaryBalance,
              physicalCash: { increment: totalMergedAmount }
            }
          });

          // Create "Inflow" record for primary
          await tx.vaultTransaction.create({
            data: {
              vaultId: primary.id,
              type: VaultTransactionType.VAULT_TRANSFER,
              amount: totalMergedAmount,
              balanceBefore: primary.balance,
              balanceAfter: newPrimaryBalance,
              description: `Merged balances from ${duplicates.length} duplicate vaults`,
              performedByUserId: "SYSTEM_REMEDIATION",
            }
          });
        });

        results.push({
          branch: branch.name,
          mergedCount: duplicates.length,
          mergedAmount: totalMergedAmount,
          primaryVault: primary.name,
          newBalance: primary.balance + totalMergedAmount
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: results.length > 0 
        ? `Remediated ${results.length} branches with duplicate vaults.` 
        : "No duplicate vaults found."
    });

  } catch (error) {
    console.error("Vault Remediation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
