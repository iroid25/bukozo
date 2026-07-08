/**
 * Share Redemption/Sale Helper
 * Validates that shares can be redeemed before allowing sale transactions
 */

import { db } from "@/prisma/db";

export async function getRedeemableShares(accountId: string): Promise<number> {
  try {
    // Get all transactions for this account
    const transactions = await db.shareTransaction.findMany({
      where: {
        accountId,
        isReversed: false,
      },
      orderBy: { transactionDate: "asc" },
    });

    let redeemableShares = 0;

    for (const txn of transactions) {
      if (txn.transactionType === "PURCHASE" || txn.transactionType === "DIVIDEND") {
        // These shares are redeemable
        redeemableShares += txn.shares;
      } else if (txn.transactionType === "TRANSFER_IN") {
        // These shares are NOT redeemable (from share accounts)
        // Don't add to redeemable count
      } else if (txn.transactionType === "SALE" || txn.transactionType === "TRANSFER_OUT") {
        // Deduct sold/transferred shares
        redeemableShares -= txn.shares;
      }
    }

    return Math.max(0, redeemableShares);
  } catch (error) {
    console.error("Error calculating redeemable shares:", error);
    return 0;
  }
}

export async function validateShareSale(
  accountId: string,
  sharesToSell: number
): Promise<{ valid: boolean; error?: string; redeemableShares?: number }> {
  try {
    const account = await db.shareAccount.findUnique({
      where: { id: accountId },
      select: { numberOfShares: true },
    });

    if (!account) {
      return { valid: false, error: "Share account not found" };
    }

    if (sharesToSell <= 0) {
      return { valid: false, error: "Number of shares must be greater than 0" };
    }

    if (sharesToSell > account.numberOfShares) {
      return {
        valid: false,
        error: `Insufficient shares. Available: ${account.numberOfShares}`,
      };
    }

    // Check redeemable shares
    const redeemableShares = await getRedeemableShares(accountId);

    if (sharesToSell > redeemableShares) {
      return {
        valid: false,
        error: `Only ${redeemableShares} shares are redeemable. You have ${
          account.numberOfShares - redeemableShares
        } shares from share account transfers that cannot be sold.`,
        redeemableShares,
      };
    }

    return { valid: true, redeemableShares };
  } catch (error) {
    console.error("Error validating share sale:", error);
    return { valid: false, error: "Failed to validate share sale" };
  }
}
