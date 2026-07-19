import { db } from "@/prisma/db";
import { TransactionType, TransactionStatus, AccountStatus, UserRole } from "@prisma/client";
import { format } from "date-fns";
import { isVoluntarySavingsAccountTypeName } from "@/lib/accounting/account-type-rules";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

// ── GL posting helpers for fixed deposit maturity payouts ──
// These mirror the account-lookup conventions already used in
// app/api/v1/fixed-deposits/route.ts (FD opening entry) so the maturity
// payout posts a symmetric reversal: Dr FD Liability / Cr Savings Liability
// for the principal, plus an Interest Expense leg for interest — but ONLY
// if an Interest Expense chart of account is actually configured. This
// codebase has no established/used Interest Expense COA code today, so
// rather than invent one (and risk an unbalanced entry), the interest leg
// is skipped with a warning when no such account is found.

async function resolveFdLiabilityAccount(tx: any) {
  return tx.chartOfAccount.findFirst({
    where: {
      ledgerType: "LIABILITIES",
      isActive: true,
      OR: [
        { accountCode: "201003" },
        { accountCode: "201100" },
        { accountCode: "2014" },
        { accountName: { contains: "FIXED DEPOSIT", mode: "insensitive" } },
      ],
    },
  });
}

async function resolveSavingsLiabilityAccount(
  tx: any,
  destAccountType: { ledgerAccountId?: string | null } | null | undefined,
) {
  const ledgerAccountId = destAccountType?.ledgerAccountId;
  if (ledgerAccountId) {
    const acct = await tx.chartOfAccount.findUnique({ where: { id: ledgerAccountId } });
    if (acct) return acct;
  }
  return tx.chartOfAccount.findFirst({
    where: {
      ledgerType: "LIABILITIES",
      accountName: { contains: "SAVINGS", mode: "insensitive" },
      isActive: true,
    },
  });
}

async function resolveInterestExpenseAccount(tx: any) {
  return tx.chartOfAccount.findFirst({
    where: {
      ledgerType: "EXPENDITURES",
      isActive: true,
      OR: [
        { accountCode: "502001" },
        { accountName: { contains: "INTEREST EXPENSE", mode: "insensitive" } },
      ],
    },
  });
}

/**
 * Posts the GL entries for an FD maturity/rollover payout that moves
 * `principalAmount` (+ optional `interestAmount`) from the FD Liability
 * ledger account to the destination savings Liability ledger account.
 * Must be called with the transaction client (`tx`) so a partial failure
 * can't desync the GL from the Account.balance moves already made.
 */
async function postFdMaturityGlEntries(
  tx: any,
  params: {
    principalAmount: number;
    interestAmount: number;
    fdAccountNumber: string;
    destAccountNumber: string;
    destAccountType: { ledgerAccountId?: string | null } | null | undefined;
    reference: string;
    branchId: string | null;
    userId: string;
  },
) {
  const { principalAmount, interestAmount, fdAccountNumber, destAccountNumber, destAccountType, reference, branchId, userId } = params;
  if (principalAmount <= 0 && interestAmount <= 0) return;

  const fdLiabilityAccount = await resolveFdLiabilityAccount(tx);
  const savingsLiabilityAccount = await resolveSavingsLiabilityAccount(tx, destAccountType);

  if (!fdLiabilityAccount || !savingsLiabilityAccount) {
    console.warn(
      `[fixedDepositMaturity] Skipping GL posting for ${fdAccountNumber} -> ${destAccountNumber}: ` +
      `missing FD liability or savings liability chart of account.`,
    );
    return;
  }

  const entryNumber = `JE-FD-MAT-${reference}`;
  const entryDate = new Date();

  if (principalAmount > 0) {
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: fdLiabilityAccount.id,
        debitAmount: principalAmount,
        creditAmount: 0,
        description: `FD Maturity Payout - Principal: ${fdAccountNumber} -> ${destAccountNumber}`,
        reference,
        entryDate,
        branchId: branchId || null,
        createdByUserId: userId,
      },
    });
    await tx.journalEntry.create({
      data: {
        entryNumber,
        accountId: savingsLiabilityAccount.id,
        debitAmount: 0,
        creditAmount: principalAmount,
        description: `FD Maturity Payout - Principal: ${fdAccountNumber} -> ${destAccountNumber}`,
        reference,
        entryDate,
        branchId: branchId || null,
        createdByUserId: userId,
      },
    });
    await tx.chartOfAccount.update({
      where: { id: fdLiabilityAccount.id },
      data: buildAccountBalanceUpdate(fdLiabilityAccount, { debitAmount: principalAmount }),
    });
    await tx.chartOfAccount.update({
      where: { id: savingsLiabilityAccount.id },
      data: buildAccountBalanceUpdate(savingsLiabilityAccount, { creditAmount: principalAmount }),
    });
  }

  if (interestAmount > 0) {
    const interestExpenseAccount = await resolveInterestExpenseAccount(tx);
    if (interestExpenseAccount) {
      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: interestExpenseAccount.id,
          debitAmount: interestAmount,
          creditAmount: 0,
          description: `FD Maturity Payout - Interest: ${fdAccountNumber} -> ${destAccountNumber}`,
          reference,
          entryDate,
          branchId: branchId || null,
          createdByUserId: userId,
        },
      });
      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: savingsLiabilityAccount.id,
          debitAmount: 0,
          creditAmount: interestAmount,
          description: `FD Maturity Payout - Interest: ${fdAccountNumber} -> ${destAccountNumber}`,
          reference,
          entryDate,
          branchId: branchId || null,
          createdByUserId: userId,
        },
      });
      await tx.chartOfAccount.update({
        where: { id: interestExpenseAccount.id },
        data: buildAccountBalanceUpdate(interestExpenseAccount, { debitAmount: interestAmount }),
      });
      await tx.chartOfAccount.update({
        where: { id: savingsLiabilityAccount.id },
        data: buildAccountBalanceUpdate(savingsLiabilityAccount, { creditAmount: interestAmount }),
      });
    } else {
      console.warn(
        `[fixedDepositMaturity] No Interest Expense chart of account found (checked code 502001 / ` +
        `name "Interest Expense") — interest portion (${interestAmount}) of the maturity payout for ` +
        `${fdAccountNumber} -> ${destAccountNumber} was NOT posted to the GL, to avoid an unbalanced ` +
        `entry or inventing a new account code. Only the principal was posted.`,
      );
    }
  }
}

/**
 * Process matured fixed deposit accounts
 * This function should be called daily by a cron job
 */
export async function processMaturedFixedDeposits() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Resolve a real user id to attribute system-posted journal entries to
    // (JournalEntry.createdByUserId is a required FK to User — "SYSTEM" used
    // elsewhere in this file for Transaction.processedByUserId is not a valid
    // user id). Mirrors the fallback pattern in
    // lib/cron/voluntarySavingsMonthlyCharges.ts.
    const postingUser = await db.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    // Find all matured fixed deposits that haven't been processed
    const maturedAccounts = await db.account.findMany({
      where: {
        accountType: { hasFixedPeriod: true },
        fixingEndDate: { lte: today },
        status: AccountStatus.ACTIVE,
        balance: { gt: 0 }, // Only process accounts with balance
      },
      include: {
        accountType: true,
        member: {
          select: {
            id: true,
            userId: true,
            memberNumber: true,
          },
        },
        institution: {
          select: {
            id: true,
            institutionNumber: true,
          },
        },
      },
    });

    console.log(`Found ${maturedAccounts.length} matured fixed deposit accounts to process`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const account of maturedAccounts) {
      try {
        await db.$transaction(async (tx) => {
          // 1. Calculate total amount (principal + interest)
          const principalAmount = account.balance;
          const interestAmount = account.expectedInterest || 0;
          const totalAmount = principalAmount + interestAmount;

          // 2. Find voluntary savings account
          const savingsCandidates = await tx.account.findMany({
            where: {
              status: AccountStatus.ACTIVE,
              ...(account.memberId ? { memberId: account.memberId } : {}),
              ...(account.institutionId ? { institutionId: account.institutionId } : {}),
            },
            include: {
              accountType: true,
            },
            orderBy: {
              openedAt: "asc",
            },
          });

          const voluntarySavings = savingsCandidates.find((candidate) =>
            isVoluntarySavingsAccountTypeName(candidate.accountType?.name),
          );

          console.log(
            `Processing FD ${account.accountNumber} (Member: ${account.memberId}). Found voluntary savings candidate: ${voluntarySavings?.accountNumber ?? "none"}`,
          );

          if (!voluntarySavings) {
            throw new Error(`No voluntary savings account found for ${account.accountNumber}`);
          }

          // 3. Transfer funds
          // Debit fixed deposit
          await tx.account.update({
            where: { id: account.id },
            data: {
              balance: 0,
              status: AccountStatus.CLOSED,
              closedAt: new Date(),
            },
          });

          // Credit voluntary savings
          await tx.account.update({
            where: { id: voluntarySavings.id },
            data: {
              balance: { increment: totalAmount },
            },
          });

          // 4. Create transaction records
          const timestamp = Date.now().toString(36).toUpperCase();
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const transactionRef = `MAT-${timestamp}-${random}`;

          // Credit transaction for voluntary savings
          await tx.transaction.create({
            data: {
              transactionRef,
              type: TransactionType.TRANSFER,
              amount: totalAmount,
              status: TransactionStatus.COMPLETED,
              description: `Maturity Transfer from Fixed Deposit ${account.accountNumber}. Principal: ${principalAmount.toLocaleString()}, Interest: ${interestAmount.toLocaleString()}`,
              currency: "UGX",
              branchId: account.branchId,
              memberId: account.memberId,
              institutionId: account.institutionId,
              accountId: voluntarySavings.id,
              processedByUserId: "SYSTEM", // System-initiated
              channel: "INTERNAL",
            },
          });

          // Debit transaction for fixed deposit
          await tx.transaction.create({
            data: {
              transactionRef: `${transactionRef}-SRC`,
              type: TransactionType.TRANSFER,
              amount: totalAmount,
              status: TransactionStatus.COMPLETED,
              description: `Maturity Transfer to ${voluntarySavings.accountNumber}. Principal: ${principalAmount.toLocaleString()}, Interest: ${interestAmount.toLocaleString()}`,
              currency: "UGX",
              branchId: account.branchId,
              memberId: account.memberId,
              institutionId: account.institutionId,
              accountId: account.id,
              processedByUserId: "SYSTEM",
              channel: "INTERNAL",
            },
          });

          // 4b. Post GL entries for the payout (Dr FD Liability, Cr Savings Liability,
          // plus an Interest Expense leg if configured) so the GL doesn't silently
          // diverge from the Account.balance moves made above. Same transaction as
          // the balance updates, so a partial failure can't desync them.
          if (postingUser) {
            await postFdMaturityGlEntries(tx, {
              principalAmount,
              interestAmount,
              fdAccountNumber: account.accountNumber,
              destAccountNumber: voluntarySavings.accountNumber,
              destAccountType: voluntarySavings.accountType,
              reference: transactionRef,
              branchId: account.branchId,
              userId: postingUser.id,
            });
          } else {
            console.warn(
              `[fixedDepositMaturity] No ADMIN user found to attribute GL postings to — skipping GL entries for FD ${account.accountNumber} maturity payout.`,
            );
          }

          // 5. Create audit log
          await tx.auditLog.create({
            data: {
              userId: "SYSTEM",
              action: "AUTO_MATURITY_TRANSFER",
              entityType: "Account",
              entityId: account.id,
              details: `Auto-maturity transfer for fixed deposit ${account.accountNumber}. Total transferred: ${totalAmount.toLocaleString()} (Principal: ${principalAmount.toLocaleString()}, Interest: ${interestAmount.toLocaleString()}) to ${voluntarySavings.accountNumber}. Maturity date: ${format(account.fixingEndDate!, "PPP")}`,
            },
          });

          // 6. Send notification
          if (account.memberId && account.member?.userId) {
            await tx.notification.create({
              data: {
                userId: account.member.userId,
                type: "IN_APP",
                subject: "Fixed Deposit Matured",
                message: `Your fixed deposit account ${account.accountNumber} has matured!\n\nPrincipal: ${principalAmount.toLocaleString()}\nInterest Earned: ${interestAmount.toLocaleString()}\nTotal Amount: ${totalAmount.toLocaleString()}\n\nFunds have been transferred to your voluntary savings account ${voluntarySavings.accountNumber}.\n\nReference: ${transactionRef}`,
              },
            });
          }

          console.log(`✓ Processed maturity for account ${account.accountNumber}: ${totalAmount.toLocaleString()}`);
        });

        results.processed++;
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process ${account.accountNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`Maturity processing complete: ${results.processed} processed, ${results.failed} failed`);

    // ---- Process FixedDeposit TABLE records (new model) ----
    const maturedFDs = await db.fixedDeposit.findMany({
      where: {
        maturityDate: { lte: today },
        status: "ACTIVE",
      },
      include: {
        member: { select: { id: true, userId: true, memberNumber: true } },
        institution: { select: { id: true, userId: true, institutionNumber: true } },
      },
    });

    console.log(`Found ${maturedFDs.length} matured FixedDeposit records to process`);

    for (const fd of maturedFDs) {
      try {
        await db.$transaction(async (tx) => {
          const amountToReturn = fd.maturityAmount;
          const interestEarned = fd.maturityAmount - fd.principalAmount;

          // Resolve destination account — prefer the funding source, fall back to voluntary savings
          let destAccount: any = null;
          if (fd.fundingSourceAccountId) {
            destAccount = await tx.account.findUnique({
              where: { id: fd.fundingSourceAccountId },
              include: { accountType: true },
            });
            if (destAccount?.status !== "ACTIVE") destAccount = null;
          }

          if (!destAccount) {
            const candidates = await tx.account.findMany({
              where: {
                status: AccountStatus.ACTIVE,
                ...(fd.memberId ? { memberId: fd.memberId } : {}),
                ...(fd.institutionId ? { institutionId: fd.institutionId } : {}),
              },
              include: { accountType: true },
              orderBy: { openedAt: "asc" },
            });
            destAccount = candidates.find((c) =>
              isVoluntarySavingsAccountTypeName(c.accountType?.name),
            ) ?? null;
          }

          if (!destAccount) {
            throw new Error(`No active savings account found for FD ${fd.accountNumber}`);
          }

          // Mark FD as matured
          await tx.fixedDeposit.update({
            where: { id: fd.id },
            data: {
              status: "MATURED",
              isWithdrawn: true,
              withdrawnDate: new Date(),
              withdrawnAmount: amountToReturn,
              totalInterestRealized: interestEarned,
            },
          });

          // Credit destination savings account
          await tx.account.update({
            where: { id: destAccount.id },
            data: { balance: { increment: amountToReturn } },
          });

          const timestamp = Date.now().toString(36).toUpperCase();
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const transactionRef = `MAT-FD-${timestamp}-${random}`;

          await tx.transaction.create({
            data: {
              transactionRef,
              type: TransactionType.TRANSFER,
              amount: amountToReturn,
              status: TransactionStatus.COMPLETED,
              description: `Maturity payout from FD ${fd.accountNumber}. Principal: ${fd.principalAmount.toLocaleString()}, Interest: ${interestEarned.toLocaleString()}`,
              currency: "UGX",
              branchId: fd.branchId,
              memberId: fd.memberId,
              institutionId: fd.institutionId,
              accountId: destAccount.id,
              processedByUserId: "SYSTEM",
              channel: "INTERNAL",
            },
          });

          // Post GL entries for the payout (Dr FD Liability, Cr Savings Liability,
          // plus an Interest Expense leg if configured) so the GL doesn't silently
          // diverge from the Account.balance move made above. Same transaction as
          // the balance update, so a partial failure can't desync them.
          if (postingUser) {
            await postFdMaturityGlEntries(tx, {
              principalAmount: fd.principalAmount,
              interestAmount: interestEarned,
              fdAccountNumber: fd.accountNumber,
              destAccountNumber: destAccount.accountNumber,
              destAccountType: destAccount.accountType,
              reference: transactionRef,
              branchId: fd.branchId,
              userId: postingUser.id,
            });
          } else {
            console.warn(
              `[fixedDepositMaturity] No ADMIN user found to attribute GL postings to — skipping GL entries for FD ${fd.accountNumber} maturity payout.`,
            );
          }

          await tx.auditLog.create({
            data: {
              userId: "SYSTEM",
              action: "AUTO_MATURITY_TRANSFER",
              entityType: "FixedDeposit",
              entityId: fd.id,
              details: `Auto-maturity payout for FD ${fd.accountNumber}. Total: ${amountToReturn.toLocaleString()} (Principal: ${fd.principalAmount.toLocaleString()}, Interest: ${interestEarned.toLocaleString()}) to ${destAccount.accountNumber}. Maturity date: ${format(fd.maturityDate, "PPP")}`,
            },
          });

          const notifyUserId = fd.member?.userId || fd.institution?.userId;
          if (notifyUserId) {
            await tx.notification.create({
              data: {
                userId: notifyUserId,
                type: "IN_APP",
                subject: "Fixed Deposit Matured",
                message: `Your fixed deposit ${fd.accountNumber} has matured!\n\nPrincipal: ${fd.principalAmount.toLocaleString()}\nInterest Earned: ${interestEarned.toLocaleString()}\nTotal Amount: ${amountToReturn.toLocaleString()}\n\nFunds transferred to: ${destAccount.accountNumber}\nReference: ${transactionRef}`,
              },
            });
          }

          console.log(`✓ Maturity payout for FD ${fd.accountNumber}: ${amountToReturn.toLocaleString()}`);
        });

        results.processed++;
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to process FD ${fd.accountNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`Total maturity processing complete: ${results.processed} processed, ${results.failed} failed`);
    return results;
  } catch (error) {
    console.error("Error in processMaturedFixedDeposits:", error);
    throw error;
  }
}
