import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { AccountStatus, TransactionStatus, TransactionType } from "@prisma/client";

/**
 * Break a Fixed Deposit account prematurely
 * Transfer principal back to voluntary savings and close account without interest
 */
export async function breakFixedDeposit(accountId: string) {
  try {
    const user = await getAuthUser();
    if (!user) return { error: "Unauthorized", data: null };

    // Find the fixed deposit account
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: true,
        institution: true,
      },
    });

    if (!account) return { error: "Account not found", data: null };
    if (!account.accountType.hasFixedPeriod) return { error: "This is not a fixed deposit account", data: null };
    if (account.status !== AccountStatus.ACTIVE) return { error: "Account is not active", data: null };

    // Find target account (Funding source or any voluntary savings)
    let targetAccountId = account.fundingSourceAccountId;
    
    if (!targetAccountId) {
      const voluntarySavings = await db.account.findFirst({
        where: {
          ...(account.memberId ? { memberId: account.memberId } : {}),
          ...(account.institutionId ? { institutionId: account.institutionId } : {}),
          accountType: { name: { in: ["VOLUNTARY_SAVINGS", "Voluntary Savings", "Savings Account"] } },
          status: AccountStatus.ACTIVE,
        },
      });
      if (!voluntarySavings) return { error: "No active voluntary savings account found to return funds to", data: null };
      targetAccountId = voluntarySavings.id;
    }

    const targetAccount = await db.account.findUnique({ where: { id: targetAccountId! } });
    if (!targetAccount) return { error: "Target savings account not found", data: null };

    const principalAmount = account.balance;

    // Transaction to move funds and close account
    const result = await db.$transaction(async (tx) => {
      // 1. Debit Fixed Deposit and Close
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: 0,
          status: AccountStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      // 2. Credit Target Account
      await tx.account.update({
        where: { id: targetAccountId! },
        data: { balance: { increment: principalAmount } },
      });

      const transactionRef = `BRK-FD-${Date.now()}`;

      // 3. Create Transaction Records
      await tx.transaction.create({
        data: {
          transactionRef,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Premature Break: Transfer from Fixed Deposit ${account.accountNumber} to ${targetAccount.accountNumber}. Interest forfeited.`,
          accountId: targetAccountId!,
          memberId: account.memberId,
          institutionId: account.institutionId,
          processedByUserId: user.id,
          channel: "INTERNAL",
        },
      });

      await tx.transaction.create({
        data: {
          transactionRef: `${transactionRef}-SRC`,
          type: TransactionType.TRANSFER,
          amount: principalAmount,
          status: TransactionStatus.COMPLETED,
          description: `Premature Break: Transfer to ${targetAccount.accountNumber}. Interest forfeited.`,
          accountId: account.id,
          memberId: account.memberId,
          institutionId: account.institutionId,
          processedByUserId: user.id,
          channel: "INTERNAL",
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "BREAK_FIXED_DEPOSIT",
          entityType: "Account",
          entityId: account.id,
          details: `Fixed deposit ${account.accountNumber} broken prematurely by ${user.name}. Principal ${principalAmount.toLocaleString()} transferred to ${targetAccount.accountNumber}.`,
        },
      });

      return account;
    });

    revalidatePath("/dashboard/accounts");
    revalidatePath(`/dashboard/accounts/${accountId}`);
    
    return { error: null, data: result };
  } catch (error) {
    console.error("Error breaking fixed deposit:", error);
    return { error: "Failed to break fixed deposit", data: null };
  }
}
