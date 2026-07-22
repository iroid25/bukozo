import { db } from "@/prisma/db";
import {
  TransactionType,
  TransactionStatus,
  DepositType,
  UserRole,
} from "@prisma/client";
import { WithdrawalCreateDTO } from "@/types/withdraw";
import { DepositCreateDTO } from "@/types/deposits";
import { validateStaffLimits } from "@/lib/validators";
import {
  AGENT_WITHDRAWAL_FEES,
  AGENT_DEPOSIT_FEES,
  SCHOOL_FEES_COMMISSION,
  MEMBER_WITHDRAWAL_FEES,
  INSTITUTION_WITHDRAWAL_FEES,
} from "@/config/fees";
import { calculateWithdrawalFee } from "@/lib/fees";
import { sendTransactionAlertEmail } from "@/lib/email";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { RelworxService } from "./relworx.service";
import {
  DEPOSIT_FEE_CODE,
  FEE_INCOME_CODE,
  WITHDRAWAL_FEE_CODE,
} from "@/lib/services/income-structure";
import { createMemberDepositJournalEntry } from "@/lib/journal-entries-extended";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

// Helper function to create income records with category management
async function createIncomeRecord(
  tx: any,
  code: string,
  name: string,
  amount: number,
  receivedByUserId: string,
  branchId: string,
  memberId?: string,
  accountId?: string,
  description?: string,
  channel?: string,
  parentCode = "400400",
  parentName = "Commission Income",
) {
  // Find or create the parent category for this income item
  const parentCategory = await tx.budgetCategory.upsert({
    where: { code: parentCode },
    update: {},
    create: {
      name: parentName,
      code: parentCode,
      kind: "INCOME" as const,
      description: `Income from ${parentName.toLowerCase()}`,
      isActive: true,
    },
  });

  const parentAccount = await tx.chartOfAccount.upsert({
    where: { accountCode: parentCode },
    update: {
      accountName: parentName,
      fullCode: parentCode,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: `Income from ${parentName.toLowerCase()}`,
    },
    create: {
      accountName: parentName,
      accountCode: parentCode,
      fullCode: parentCode,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: `Income from ${parentName.toLowerCase()}`,
    },
  });

  // Find or create specific category
  let category = await tx.budgetCategory.findFirst({
    where: {
      OR: [{ code: code }, { name: { equals: name, mode: "insensitive" } }],
    },
  });

  if (!category) {
    category = await tx.budgetCategory.create({
      data: {
        name: name,
        code: code,
        kind: "INCOME" as const,
        description: `Income from ${name}`,
        isActive: true,
        parentId: parentCategory.id,
      },
    });
  }

  await tx.chartOfAccount.upsert({
    where: { accountCode: code },
    update: {
      accountName: name,
      fullCode: code,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 2,
      parentId: parentAccount.id,
      category: "INCOME",
      description: `Income from ${name}`,
    },
    create: {
      accountName: name,
      accountCode: code,
      fullCode: code,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 2,
      parentId: parentAccount.id,
      category: "INCOME",
      description: `Income from ${name}`,
    },
  });

  return await tx.incomeRecord.create({
    data: {
      budgetCategoryId: category.id,
      amount: amount,
      date: new Date(),
      recordDate: new Date(),
      description: description,
      receivedByUserId: receivedByUserId,
      branchId: branchId,
      memberId: memberId || null,
      accountId: accountId || null,
      status: "COMPLETED" as const,
      paymentMethod: channel?.toUpperCase() === "CASH" ? "CASH" : "BANK",
    },
  });
}

const FLOAT_REQUIRED_ROLES = new Set<UserRole>([
  UserRole.TELLER,
  UserRole.AGENT,
]);

async function ensureHandlerFloatAvailability(handlerUserId: string, skipBalanceCheck = false) {
  const handlerUser = await db.user.findUnique({
    where: { id: handlerUserId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!handlerUser) {
    return {
      ok: false,
      error: "Authenticated user not found",
    } as const;
  }

  if (!FLOAT_REQUIRED_ROLES.has(handlerUser.role)) {
    return {
      ok: true,
      handlerUser,
    } as const;
  }

  const userFloat = await db.userFloat.findUnique({
    where: { userId: handlerUserId },
    select: {
      id: true,
      balance: true,
      isActiveForDay: true,
    },
  });

  if (!userFloat) {
    return {
      ok: false,
      error:
        "No float account found for this user. Please contact administrator.",
    } as const;
  }

  if (!userFloat.isActiveForDay) {
    return {
      ok: false,
      error:
        "Your teller/agent session is not active for today. Please start your day session first.",
    } as const;
  }

  // Skip balance check for deposits — teller is RECEIVING cash, zero balance is fine
  if (!skipBalanceCheck && userFloat.balance <= 0) {
    return {
      ok: false,
      error: "Your float balance is zero. Please replenish it before continuing.",
    } as const;
  }

  return {
    ok: true,
    handlerUser,
    userFloat,
  } as const;
}

export class TransactionService {
  /**
   * Universal Withdrawal Processor
   */
  static async processWithdrawal(
    data: WithdrawalCreateDTO,
    handlerUserId: string,
  ) {
    try {
      // 1. Basic Validations
      if (data.amount <= 0)
        return { ok: false, error: "Amount must be greater than zero" };

      const floatCheck = await ensureHandlerFloatAvailability(handlerUserId);
      if (!floatCheck.ok) {
        return { ok: false, error: floatCheck.error };
      }

      const member = await db.member.findUnique({
        where: { id: data.memberId },
        include: { user: { select: { name: true, id: true, phone: true } } },
      });
      if (!member) return { ok: false, error: "Member not found" };

      const account = await db.account.findFirst({
        where: {
          id: data.accountId,
          memberId: data.memberId,
          status: "ACTIVE",
        },
        include: {
          accountType: { include: { ledgerAccount: true } },
          branch: true,
          institution: { include: { user: true } },
        },
      });
      if (!account) return { ok: false, error: "Active account not found" };

      const typeName = account.accountType.name.toUpperCase();

      // 1b. Share accounts — never directly withdrawable
      if (account.accountType.isShareAccount || typeName.includes("SHARE")) {
        return {
          ok: false,
          error: "Direct withdrawal of shares is not permitted. Only internal transfers are allowed.",
        };
      }

      // 1c. Fixed Savings / Fixed Deposits — blocked until maturity
      if (account.accountType.hasFixedPeriod || typeName.includes("FIXED")) {
        const today = new Date();
        const maturityDate = account.fixingEndDate;
        if (!maturityDate) {
          return { ok: false, error: "Fixed savings account has no maturity date. Cannot withdraw." };
        }
        if (today < maturityDate) {
          const { format } = await import("date-fns");
          return {
            ok: false,
            error: `Cannot withdraw from fixed savings before maturity (${format(maturityDate, "PPP")}). Early withdrawal forfeits interest.`,
          };
        }
      }

      // 1d. Compulsory Savings — blocked until the account is at least 12 months old
      if (typeName.includes("COMPULSORY")) {
        const openedAt = account.openedAt ? new Date(account.openedAt) : null;
        if (openedAt) {
          const twelveMonthsLater = new Date(openedAt);
          twelveMonthsLater.setFullYear(twelveMonthsLater.getFullYear() + 1);
          if (new Date() < twelveMonthsLater) {
            const { format } = await import("date-fns");
            return {
              ok: false,
              error: `Compulsory savings can only be withdrawn after 12 months from account opening (eligible from ${format(twelveMonthsLater, "PPP")}).`,
            };
          }
        }
      }

      // 1e. canWithdraw flag — final gate for any remaining non-withdrawable types
      if (!account.accountType.canWithdraw) {
        return {
          ok: false,
          error: `${account.accountType.name} accounts do not permit direct withdrawal. Please contact your branch manager.`,
        };
      }

      // 1e2. Active account hold check
      const activeHold = await db.accountHold.findFirst({
        where: { accountId: data.accountId, isActive: true },
      });
      if (activeHold) {
        return {
          ok: false,
          error: `Account has an active hold (${activeHold.reasonText || activeHold.reason}). Withdrawals are blocked until the hold is lifted.`,
        };
      }

      // 1f. Withdrawal frequency check (e.g. Junior Savings: once per 4 months)
      if (account.accountType.withdrawalFrequencyDays && account.accountType.withdrawalFrequencyDays > 0) {
        const lastWithdrawal = await db.withdrawal.findFirst({
          where: { accountId: account.id },
          orderBy: { withdrawalDate: "desc" },
          select: { withdrawalDate: true },
        });
        if (lastWithdrawal?.withdrawalDate) {
          const nextAllowed = new Date(lastWithdrawal.withdrawalDate);
          nextAllowed.setDate(nextAllowed.getDate() + account.accountType.withdrawalFrequencyDays);
          if (new Date() < nextAllowed) {
            const { format } = await import("date-fns");
            return {
              ok: false,
              error: `${account.accountType.name} only allows one withdrawal every ${account.accountType.withdrawalFrequencyDays} days. Next withdrawal allowed from ${format(nextAllowed, "PPP")}.`,
            };
          }
        }
      }

      // 5. Staff Limit Validation
      const limitCheck = await validateStaffLimits(
        handlerUserId,
        data.amount,
        TransactionType.WITHDRAWAL,
      );
      if (!limitCheck.ok) return { ok: false, error: limitCheck.error };

      // 3. Handler Context
      const handler = await db.user.findUnique({
        where: { id: handlerUserId },
        select: { role: true, branchId: true },
      });
      const isAgent = handler?.role === "AGENT";

      // 4. Fee Calculation
      let feeCharge = 0;
      let agentShare = 0;
      let saccoShare = 0;

      if (isAgent && data.channel?.toUpperCase() === "CASH") {
        const feeTiers = AGENT_WITHDRAWAL_FEES;
        const tier = (feeTiers as any[]).find(
          (t) => data.amount >= t.min && (t.max === 0 || data.amount <= t.max),
        );
        if (tier) {
          agentShare = tier.agentShare;
          saccoShare = tier.saccoShare;
          feeCharge = tier.charge;
        }
      } else {
        // Priority order (handled by calculateWithdrawalFee):
        //  1. account.customFlatWithdrawalFee / customWithdrawalFeePercentage / customWithdrawalFeeTiers
        //  2. accountType.flatWithdrawalFee
        //  3. accountType.withdrawalFeeTiers  ← BUTCS tiered fees (300/500/700/1,000)
        //  4. accountType.withdrawalFeePercentage
        //  5. fallback: system-configured tiers (MEMBER / INSTITUTION rates)

        const isInstitution = !!account.institutionId;
        const configKey = isInstitution
          ? "TELLER_WITHDRAWAL_RATES_INSTITUTION"
          : "TELLER_WITHDRAWAL_RATES_MEMBER";
        const defaultFees = isInstitution
          ? INSTITUTION_WITHDRAWAL_FEES
          : MEMBER_WITHDRAWAL_FEES;

        // Load system-config tiers as last-resort fallback
        let fallbackTiersJson: string | null = null;
        try {
          const sysConfig = await db.systemConfiguration.findUnique({
            where: { key: configKey },
          });
          fallbackTiersJson = sysConfig?.value
            ? sysConfig.value
            : JSON.stringify(defaultFees);
        } catch {
          fallbackTiersJson = JSON.stringify(defaultFees);
        }

        feeCharge = calculateWithdrawalFee(
          data.amount,
          account.accountType,
          account,
          fallbackTiersJson,
        );
        saccoShare = feeCharge;
      }

      const totalDeduction = data.amount + feeCharge;

      if (account.balance < totalDeduction) {
        return {
          ok: false,
          error: `Insufficient balance. Required: ${totalDeduction.toLocaleString()}`,
        };
      }

      if (account.balance - totalDeduction < account.accountType.minBalance) {
        return {
          ok: false,
          error: `Withdrawal violates minimum balance of ${account.accountType.minBalance.toLocaleString()}`,
        };
      }

      // 5. DB Transaction
      const result = await db.$transaction(async (tx) => {
        const transactionRef = `WTH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

        const transaction = await tx.transaction.create({
          data: {
            transactionRef,
            memberId: data.memberId,
            accountId: data.accountId,
            branchId: account.branchId,
            type: TransactionType.WITHDRAWAL,
            amount: data.amount,
            fee: feeCharge,
            status: TransactionStatus.COMPLETED,
            description:
              data.description ||
              (isAgent ? "Agent Withdrawal" : "Direct Withdrawal"),
            processedByUserId: handlerUserId,
            channel: data.channel,
          },
        });

        const withdrawal = await tx.withdrawal.create({
          data: {
            transactionId: transaction.id,
            memberId: data.memberId,
            accountId: data.accountId,
            amount: data.amount,
            fee: feeCharge,
            handlerUserId,
            channel: data.channel,
            mobileMoneyRef: data.mobileMoneyRef || null,
          },
        });

        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: { decrement: totalDeduction } },
        });

        // Principal journal entry for withdrawal (Dr Savings Liability, Cr Cash).
        // Posted for every channel, including MOBILE_MONEY — mirrors how
        // createMemberDepositJournalEntry treats all deposit channels
        // uniformly against Cash-at-Hand, so the principal always reaches
        // the GL regardless of how the member was paid out.
        {
          const savingsAccountCode = account.accountType.ledgerAccount?.accountCode;
          const savingsGl = savingsAccountCode
            ? await tx.chartOfAccount.findFirst({ where: { accountCode: savingsAccountCode, isActive: true } })
            : await tx.chartOfAccount.findFirst({ where: { ledgerType: "LIABILITIES", accountName: { contains: "SAVINGS", mode: "insensitive" }, isActive: true } });
          const cashGl = await tx.chartOfAccount.findFirst({
            where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
          });
          if (savingsGl && cashGl) {
            const wdEntryNum = `JE-WD-${Date.now()}`;
            await tx.journalEntry.create({
              data: {
                entryNumber: wdEntryNum, accountId: savingsGl.id, debitAmount: data.amount, creditAmount: 0,
                description: `Withdrawal - ${transactionRef}`, reference: transactionRef,
                transactionId: transaction.id, createdByUserId: handlerUserId, entryDate: new Date(),
                branchId: handler?.branchId || account.branchId,
              },
            });
            await tx.journalEntry.create({
              data: {
                entryNumber: wdEntryNum, accountId: cashGl.id, debitAmount: 0, creditAmount: data.amount,
                description: `Withdrawal - ${transactionRef}`, reference: transactionRef,
                transactionId: transaction.id, createdByUserId: handlerUserId, entryDate: new Date(),
                branchId: handler?.branchId || account.branchId,
              },
            });
            await tx.chartOfAccount.update({
              where: { id: savingsGl.id },
              data: buildAccountBalanceUpdate(savingsGl, { debitAmount: data.amount }),
            });
            await tx.chartOfAccount.update({
              where: { id: cashGl.id },
              data: buildAccountBalanceUpdate(cashGl, { creditAmount: data.amount }),
            });
          }
        }

        // Float updates for CASH
        if (data.channel?.toUpperCase() === "CASH") {
          const userFloat = await tx.userFloat.findUnique({
            where: { userId: handlerUserId },
          });
          if (userFloat) {
            // Float decreases when handler gives cash to member
            const floatChange = isAgent
              ? data.amount + agentShare
              : data.amount + feeCharge;
            await tx.userFloat.update({
              where: { userId: handlerUserId },
              data: {
                balance: {
                  decrement: floatChange,
                },
              },
            });

            await tx.floatTransaction.create({
              data: {
                floatId: userFloat.id,
                type: TransactionType.WITHDRAWAL,
                amount: floatChange,
                description: isAgent
                  ? `Agent Withdrawal - Payout Cash. Earned: ${agentShare}`
                  : `Teller Payout Cash. Principal: ${data.amount}, Fee: ${feeCharge}`,
                performedByUserId: handlerUserId,
                relatedTransactionId: transaction.id,
              },
            });
          }
        }

        // --- Relworx Integration: Outward Payment (Disbursement) ---
        // Restricted to Members only as per requirement: "withdraw via mobile money is only on member role side"
        if (data.channel?.toUpperCase() === "MOBILE_MONEY" && data.memberId) {
          const msisdn = data.mobileMoneyRef || member.user.phone || "";
          if (!msisdn) {
            throw new Error("Phone number (MSISDN) is required for mobile money withdrawal.");
          }

          // Float check BEFORE calling send-payment — never attempt disbursement blind.
          const walletBalance = await RelworxService.checkWalletBalance("UGX");
          if (!walletBalance.success) {
            throw new Error(walletBalance.message || "Could not verify mobile money float right now. Try again shortly.");
          }
          if (Number(walletBalance.balance ?? 0) < data.amount) {
            throw new Error("SACCO mobile money float is insufficient for this withdrawal. Contact an administrator to top up.");
          }

          const relworxResponse = await RelworxService.sendPayment({
            msisdn,
            amount: data.amount,
            currency: "UGX",
            reference: transactionRef,
            description: data.description || "Withdrawal payout",
          });

          if (!relworxResponse.success) {
            throw new Error(`Relworx Payout Failed: ${relworxResponse.message}`);
          }

          // Update withdrawal with Relworx internal reference
          await tx.withdrawal.update({
            where: { id: withdrawal.id },
            data: { mobileMoneyRef: relworxResponse.internal_reference || msisdn },
          });
        }

        // Sacco Income
        if (saccoShare > 0) {
          // Ensure fee income categories exist
          let feeCategory = await tx.budgetCategory.findFirst({
            where: {
              OR: [
                {
                  name: {
                    equals: "Withdrawal fee charged",
                    mode: "insensitive",
                  },
                },
                { code: WITHDRAWAL_FEE_CODE },
              ],
            },
          });

          if (!feeCategory) {
            const feeParent = await tx.budgetCategory.upsert({
              where: { code: FEE_INCOME_CODE },
              update: {
                name: "Fee income",
                kind: "INCOME",
                isActive: true,
              },
              create: {
                name: "Fee income",
                code: FEE_INCOME_CODE,
                kind: "INCOME",
                description: "Income from service and transaction fees",
                isActive: true,
              },
            });

            const feeParentAccount = await tx.chartOfAccount.upsert({
              where: { accountCode: FEE_INCOME_CODE },
              update: {
                accountName: "Fee income",
                fullCode: FEE_INCOME_CODE,
                ledgerType: "INCOME",
                debitCredit: "CR",
                isActive: true,
                level: 1,
                category: "INCOME",
                description: "Income from service and transaction fees",
              },
              create: {
                accountName: "Fee income",
                accountCode: FEE_INCOME_CODE,
                fullCode: FEE_INCOME_CODE,
                ledgerType: "INCOME",
                debitCredit: "CR",
                isActive: true,
                level: 1,
                category: "INCOME",
                description: "Income from service and transaction fees",
              },
            });

            feeCategory = await tx.budgetCategory.create({
              data: {
                name: "Withdrawal fee charged",
                code: WITHDRAWAL_FEE_CODE,
                kind: "INCOME",
                description: "Fees charged when processing withdrawals",
                isActive: true,
                parentId: feeParent.id,
              },
            });

            await tx.chartOfAccount.upsert({
              where: { accountCode: WITHDRAWAL_FEE_CODE },
              update: {
                accountName: "Withdrawal fee charged",
                fullCode: WITHDRAWAL_FEE_CODE,
                ledgerType: "INCOME",
                debitCredit: "CR",
                isActive: true,
                level: 2,
                parentId: feeParentAccount.id,
                category: "INCOME",
                description: "Fees charged when processing withdrawals",
              },
              create: {
                accountName: "Withdrawal fee charged",
                accountCode: WITHDRAWAL_FEE_CODE,
                fullCode: WITHDRAWAL_FEE_CODE,
                ledgerType: "INCOME",
                debitCredit: "CR",
                isActive: true,
                level: 2,
                parentId: feeParentAccount.id,
                category: "INCOME",
                description: "Fees charged when processing withdrawals",
              },
            });
          }

          const existingFeeIncome = await tx.incomeRecord.findFirst({
            where: { externalRef: transactionRef },
          });
          if (!existingFeeIncome) {
            await tx.incomeRecord.create({
              data: {
                amount: saccoShare,
                description: `Withdrawal Fee - ${transactionRef}`,
                receivedByUserId: handlerUserId,
                branchId: handler?.branchId || account.branchId,
                memberId: data.memberId,
                accountId: data.accountId,
                status: TransactionStatus.COMPLETED,
                budgetCategoryId: feeCategory.id,
                recordDate: new Date(),
                date: new Date(),
                externalRef: transactionRef,
              },
            });
          }

          // Create journal entry to update Chart of Accounts
          const { createWithdrawalFeeJournalEntry } =
            await import("@/lib/journal-entries-extended");
          await createWithdrawalFeeJournalEntry(
            {
              amount: saccoShare,
              description: `Withdrawal Fee - ${transactionRef}`,
              reference: transactionRef,
              transactionId: transaction.id,
              userId: handlerUserId,
              entryDate: new Date(),
              branchId: handler?.branchId || account.branchId,
              feeAccountCode: WITHDRAWAL_FEE_CODE,
              feeAccountName: "Withdrawal fee charged",
              debitAccountCode: (account.accountType as any).ledgerAccount?.accountCode,
            },
            tx,
          );
        }

        const withdrawalTargetUserId =
          member.userId || (account.institution as any)?.user?.id;
        if (withdrawalTargetUserId) {
          await tx.notification.create({
            data: {
              userId: withdrawalTargetUserId,
              type: "IN_APP",
              subject: "Withdrawal Successful",
              message: `Withdrawal of UGX ${data.amount.toLocaleString()} from account ${account.accountNumber} was successful. Fees: UGX ${feeCharge.toLocaleString()}. New balance: UGX ${(account.balance - totalDeduction).toLocaleString()}. Reference: ${transactionRef}`,
              targetAddress: `/dashboard/accounts`,
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }

        // Email notification
        const memberEmail = await tx.user.findUnique({
          where: { id: member.userId as string },
          select: { email: true, name: true },
        });

        if (memberEmail?.email) {
          await sendTransactionAlertEmail(
            memberEmail.email,
            memberEmail.name,
            "WITHDRAWAL",
            data.amount,
            account.balance - totalDeduction,
          );
        }

        return withdrawal;
      });

      // Get updated float balance for teller
      let floatBalance = 0;
      if (data.channel?.toUpperCase() === "CASH") {
        const updatedFloat = await db.userFloat.findUnique({
          where: { userId: handlerUserId },
        });
        floatBalance = updatedFloat?.balance || 0;
      }

      void bumpAccountingSyncState("Withdrawal processed");
      return { ok: true, data: result, floatBalance };
    } catch (error: any) {
      console.error("Withdrawal Service Error:", error);
      return {
        ok: false,
        error: error.message || "Failed to process withdrawal",
      };
    }
  }

  /**
   * Universal Deposit Processor
   */
  static async processDeposit(data: DepositCreateDTO, handlerUserId: string) {
    try {
      // 1. Basic Validations
      if (data.amount <= 0)
        return { ok: false, error: "Amount must be greater than zero" };

      // skipBalanceCheck=true: teller is RECEIVING cash, zero balance is fine for deposits
      const floatCheck = await ensureHandlerFloatAvailability(handlerUserId, true);
      if (!floatCheck.ok) {
        return { ok: false, error: floatCheck.error };
      }

      const account = await db.account.findFirst({
        where: { id: data.accountId, status: "ACTIVE" },
        include: {
          accountType: { include: { ledgerAccount: true } },
          branch: true,
          member: { include: { user: true } },
          institution: { include: { user: true } },
        },
      });
      if (!account) return { ok: false, error: "Active account not found" };

      // 1f. Share accounts — never directly depositable (mirrors the withdrawal
      // guard above). Deposits into share accounts must go through
      // /api/v1/shares/purchase so ShareAccount/ShareTransaction and the
      // Share Capital GL entry stay in sync with Account.balance.
      const depositTypeName = account.accountType.name.toUpperCase();
      if (account.accountType.isShareAccount || depositTypeName.includes("SHARE")) {
        return {
          ok: false,
          error: "Direct deposits into share accounts are not permitted. Use the Shares Purchase flow instead.",
        };
      }

      // 2. Fixed Deposit Funding Restriction (Internal Transfers only)
      if (account.accountType.hasFixedPeriod) {
        return {
          ok: false,
          error:
            "Direct deposits into Fixed Deposits are not allowed. Funding must be via internal transfer from Voluntary Savings.",
        };
      }

      // 3. Staff Limit Validation
      const limitCheck = await validateStaffLimits(
        handlerUserId,
        data.amount,
        TransactionType.DEPOSIT,
      );
      if (!limitCheck.ok) return { ok: false, error: limitCheck.error };

      const handler = await db.user.findUnique({
        where: { id: handlerUserId },
        select: { role: true, branchId: true },
      });
      const isAgent = handler?.role === "AGENT";

      // 3. DB Transaction
      const result = await db.$transaction(async (tx) => {
        const transactionRef = `DEP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        const isFeePayment = data.depositType === "FEE_PAYMENT";
        const schoolFeesConfig = SCHOOL_FEES_COMMISSION;
        const schoolFeesCommission = isFeePayment ? Number(schoolFeesConfig.total || 0) : 0;
        const schoolFeesNetAmount = Math.max(Number(data.amount) - schoolFeesCommission, 0);
        const schoolFeesAgentShare = Number(schoolFeesConfig.agentShare || 0);
        const schoolFeesSaccoShare = Number(schoolFeesConfig.saccoShare || 0);

        const transaction = await tx.transaction.create({
          data: {
            transactionRef,
            type: isFeePayment ? TransactionType.FEE : TransactionType.DEPOSIT,
            amount: data.amount,
            fee: 0,
            status: data.channel?.toUpperCase() === "MOBILE_MONEY" 
              ? TransactionStatus.PENDING 
              : TransactionStatus.COMPLETED,
            description: data.description || "Deposit",
            branchId: account.branchId,
            memberId: data.memberId || null,
            accountId: data.accountId,
            institutionId: data.institutionId || null,
            processedByUserId: handlerUserId,
            channel: data.channel,
          },
        });

        const deposit = await tx.deposit.create({
          data: {
            transactionId: transaction.id,
            memberId: data.memberId || null,
            institutionId: data.institutionId || null,
            accountId: data.accountId,
            amount: data.amount,
            channel: data.channel,
            mobileMoneyRef: data.mobileMoneyRef || null,
            depositorName: data.depositorName || null,
            institutionName: (data as any).institutionName || null,
            handlerUserId,
            depositType:
              (data.depositType as DepositType) || DepositType.DIRECT,
            feeType: (data as any).feeType || null,
            studentName: (data as any).studentName || null,
            studentClass: (data as any).studentClass || null,
            studentYear: (data as any).studentYear || null,
          },
        });

        const isMobileMoney = data.channel?.toUpperCase() === "MOBILE_MONEY";

        // MOBILE_MONEY: transaction stays PENDING; webhook recordDepositCompletion
        // handles balance/float/GL later. Skip all financial updates here.
        if (!isMobileMoney) {

        // Update balance - ALL deposits add to account balance (including fee payments)

        // For BANK fee payment - deduct from source member account first
        if (
          isFeePayment &&
          data.channel?.toUpperCase() === "BANK" &&
          (data as any).sourceAccountId
        ) {
          // Deduct from source member's account
          await tx.account.update({
            where: { id: (data as any).sourceAccountId },
            data: { balance: { decrement: data.amount } },
          });

          // Create a transfer transaction record
          await tx.transaction.create({
            data: {
              transactionRef: `TRF-${transactionRef}`,
              type: "TRANSFER",
              amount: data.amount,
              status: "COMPLETED",
              branchId: account.branchId,
              processedByUserId: handlerUserId,
              accountId: (data as any).sourceAccountId,
              description: `School fees transfer to ${(data as any).institutionName || "School"}`,
            },
          });
        }

        // Add to destination account
        await tx.account.update({
          where: { id: data.accountId },
          data: {
            balance: {
              increment: isFeePayment ? schoolFeesNetAmount : data.amount,
            },
          },
        });

        // Float updates for CASH only (MOBILE_MONEY float handled by webhook)
        const isFloatHolder = FLOAT_REQUIRED_ROLES.has(floatCheck.handlerUser.role as UserRole);
        if (isFloatHolder && data.channel?.toUpperCase() === "CASH") {
          const userFloat = await tx.userFloat.findUnique({
            where: { userId: handlerUserId },
          });

          if (!userFloat) {
            throw new Error(
              "No float account found for this user. Please contact administrator.",
            );
          }

          if (!userFloat.isActiveForDay) {
            throw new Error(
              "Your teller/agent session is not active for today. Please start your day session first.",
            );
          }

          let floatChange = data.amount;
          let feeAmount = 0;
          if (
            isAgent &&
            (data.description?.toLowerCase().includes("school") ||
              (data as any).feeType?.toLowerCase().includes("school"))
          ) {
            // School fees commission is automatically deducted from the gross amount.
            feeAmount = schoolFeesSaccoShare;
            floatChange = data.amount - schoolFeesAgentShare;
          } else if (isAgent) {
            const feeTiers = AGENT_DEPOSIT_FEES;
            const tier = (feeTiers as any[]).find(
              (t) =>
                data.amount >= t.min && (t.max === 0 || data.amount <= t.max),
            );
            if (tier) {
              feeAmount = tier.saccoShare;
              floatChange = data.amount + feeAmount;
            }
          }

          await tx.userFloat.update({
            where: { userId: handlerUserId },
            data: {
              balance: { increment: floatChange },
            },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.DEPOSIT,
              amount: floatChange,
              description: `Deposit - ${data.channel?.toUpperCase() === "MOBILE_MONEY" ? "Mobile Money" : "Cash"} Received`,
              performedByUserId: handlerUserId,
              relatedTransactionId: transaction.id,
            },
          });

          // Record transaction fee
          if (feeAmount > 0) {
            await tx.transaction.update({
              where: { id: transaction.id },
              data: { fee: feeAmount },
            });
          }

          // Record Income for Agent Fee
          if (feeAmount > 0) {
          const incomeRecord = await createIncomeRecord(
            tx,
            DEPOSIT_FEE_CODE,
            "Deposit fee charged",
            feeAmount,
            handlerUserId,
            account.branchId,
            data.memberId,
            data.accountId,
            `Agent Deposit Fee - ${transactionRef}`,
            data.channel,
            FEE_INCOME_CODE,
            "Fee income",
          );

            // Double-entry GL for deposit fee income
            const feeIncomeAccount = await tx.chartOfAccount.findFirst({
              where: { accountCode: DEPOSIT_FEE_CODE, isActive: true },
            });
            if (feeIncomeAccount) {
              const feeEntryNumber = `JE-DEPFEE-${Date.now()}`;
              const feeCashAccount = await tx.chartOfAccount.findFirst({
                where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
              });
              if (feeCashAccount) {
                await tx.journalEntry.create({
                  data: {
                    entryNumber: feeEntryNumber,
                    accountId: feeCashAccount.id,
                    debitAmount: feeAmount,
                    creditAmount: 0,
                    description: `Deposit Fee - ${transactionRef}`,
                    entryDate: new Date(),
                    reference: transactionRef,
                    branchId: account.branchId || undefined,
                    transactionId: transaction.id,
                    createdByUserId: handlerUserId,
                  },
                });
                await tx.journalEntry.create({
                  data: {
                    entryNumber: feeEntryNumber,
                    accountId: feeIncomeAccount.id,
                    debitAmount: 0,
                    creditAmount: feeAmount,
                    description: `Deposit Fee - ${transactionRef}`,
                    entryDate: new Date(),
                    reference: transactionRef,
                    branchId: account.branchId || undefined,
                    transactionId: transaction.id,
                    createdByUserId: handlerUserId,
                  },
                });
                await tx.chartOfAccount.update({
                  where: { id: feeCashAccount.id },
                  data: buildAccountBalanceUpdate(feeCashAccount, { debitAmount: feeAmount }),
                });
                await tx.chartOfAccount.update({
                  where: { id: feeIncomeAccount.id },
                  data: buildAccountBalanceUpdate(feeIncomeAccount, { creditAmount: feeAmount }),
                });
              }
            }
          }

          // Record School Fees Commission Income (for FEE_PAYMENT deposit type)
          if (isFeePayment && data.depositType === "FEE_PAYMENT") {
            if (schoolFeesSaccoShare > 0) {
              await createIncomeRecord(
                tx,
                "400401",
                "School Fees Commission",
                schoolFeesSaccoShare,
                handlerUserId,
                account.branchId,
                data.memberId,
                data.accountId,
                `School Fees Commission - ${transactionRef} - ${(data as any).feeType || "Tuition"}`,
                data.channel,
              );

              // Double-entry GL for school fees commission
              const commissionAccount = await tx.chartOfAccount.findFirst({
                where: { accountCode: "400401", isActive: true },
              });
              if (commissionAccount) {
                const commEntryNumber = `JE-COMM-${Date.now()}`;
                const commCashAccount = await tx.chartOfAccount.findFirst({
                  where: { accountCode: CASH_AT_HAND_CODE, isActive: true },
                });
                if (commCashAccount) {
                  await tx.journalEntry.create({
                    data: {
                      entryNumber: commEntryNumber,
                      accountId: commCashAccount.id,
                      debitAmount: schoolFeesSaccoShare,
                      creditAmount: 0,
                      description: `School Fees Commission - ${transactionRef}`,
                      entryDate: new Date(),
                      reference: transactionRef,
                      branchId: account.branchId || undefined,
                      transactionId: transaction.id,
                      createdByUserId: handlerUserId,
                    },
                  });
                  await tx.journalEntry.create({
                    data: {
                      entryNumber: commEntryNumber,
                      accountId: commissionAccount.id,
                      debitAmount: 0,
                      creditAmount: schoolFeesSaccoShare,
                      description: `School Fees Commission - ${transactionRef}`,
                      entryDate: new Date(),
                      reference: transactionRef,
                      branchId: account.branchId || undefined,
                      transactionId: transaction.id,
                      createdByUserId: handlerUserId,
                    },
                  });
                  await tx.chartOfAccount.update({
                    where: { id: commCashAccount.id },
                    data: buildAccountBalanceUpdate(commCashAccount, { debitAmount: schoolFeesSaccoShare }),
                  });
                  await tx.chartOfAccount.update({
                    where: { id: commissionAccount.id },
                    data: buildAccountBalanceUpdate(commissionAccount, { creditAmount: schoolFeesSaccoShare }),
                  });
                }
              }
            }
          }
        }

        // ── Double-entry GL journal entry for deposit principal ──
        {
          const cashAccountCode =
            data.channel?.toUpperCase() === "BANK" ? "102002" : CASH_AT_HAND_CODE;
          await createMemberDepositJournalEntry(
            {
              amount: isFeePayment ? schoolFeesNetAmount : data.amount,
              description: `Deposit - ${transactionRef}`,
              reference: transactionRef,
              transactionId: transaction.id,
              userId: handlerUserId,
              entryDate: new Date(),
              branchId: account.branchId,
              cashAccountCode,
              savingsLedgerAccountCode: account.accountType.ledgerAccount?.accountCode,
            },
            tx,
          );
        }

        // Write SavingsTransaction so legacy savings reports show this deposit
        const savingsAccount = await tx.savingsAccount.findUnique({
          where: { accountNumber: account.accountNumber },
          select: { id: true, balance: true },
        });
        if (savingsAccount) {
          await tx.savingsTransaction.create({
            data: {
              accountId: savingsAccount.id,
              transactionType: "DEPOSIT",
              amount: data.amount,
              balanceBefore: savingsAccount.balance,
              balanceAfter: savingsAccount.balance + data.amount,
              transactionDate: new Date(),
              reference: transactionRef,
              description: `Deposit - ${data.description || ""}`,
              tellerId: handlerUserId,
            },
          });
        }

        } // end !isMobileMoney

        // Notifications
        const ownerName =
          account.member?.user?.name ||
          account.institution?.institutionName ||
          account.institution?.user?.name ||
          "Owner";
        const ownerEmail =
          account.member?.user?.email ||
          account.institution?.institutionEmail ||
          account.institution?.user?.email;
        const userId = account.member?.userId || account.institution?.userId;

        if (userId) {
          await tx.notification.create({
            data: {
              userId,
              type: "IN_APP",
              subject: "Deposit Successful",
              message: `Deposit of UGX ${data.amount.toLocaleString()} into account ${account.accountNumber} was successful. New balance: UGX ${(account.balance + data.amount).toLocaleString()}. Reference: ${transactionRef}`,
              targetAddress: `/dashboard/accounts`,
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }

        if (ownerEmail) {
          await sendTransactionAlertEmail(
            ownerEmail,
            ownerName,
            "DEPOSIT",
            data.amount,
            account.balance + data.amount,
          );
        }

        return deposit;
      });

      // Get updated float balance for teller
      let floatBalance = 0;
      if (data.channel === "CASH" || data.channel === "MOBILE_MONEY") {
        const updatedFloat = await db.userFloat.findUnique({
          where: { userId: handlerUserId },
        });
        floatBalance = updatedFloat?.balance || 0;
      }

      void bumpAccountingSyncState("Deposit processed");
      return { ok: true, data: result, floatBalance };
    } catch (error: any) {
      console.error("Deposit Service Error:", error);
      return { ok: false, error: error.message || "Failed to process deposit" };
    }
  }

  /**
   * Internal Transfer Processor
   */
  static async processInternalTransfer(
    data: {
      sourceAccountId: string;
      targetAccountId: string;
      amount: number;
      description?: string;
    },
    handlerUserId: string,
  ) {
    try {
      if (data.amount <= 0)
        return { ok: false, error: "Amount must be greater than zero" };
      if (data.sourceAccountId === data.targetAccountId)
        return {
          ok: false,
          error: "Source and target accounts must be different",
        };

      const [sourceAccount, targetAccount] = await Promise.all([
        db.account.findUnique({
          where: { id: data.sourceAccountId },
          include: { accountType: true, member: true, institution: true },
        }),
        db.account.findUnique({
          where: { id: data.targetAccountId },
          include: { accountType: true, member: true, institution: true },
        }),
      ]);

      if (!sourceAccount || sourceAccount.status !== "ACTIVE")
        return { ok: false, error: "Active source account not found" };
      if (!targetAccount || targetAccount.status !== "ACTIVE")
        return { ok: false, error: "Active target account not found" };

      if (sourceAccount.balance < data.amount)
        return { ok: false, error: "Insufficient balance in source account" };

      // 1. Fixed Savings Funding Rule: Source MUST be Voluntary Savings
      if (targetAccount.accountType.hasFixedPeriod) {
        if (!sourceAccount.accountType.name.toLowerCase().includes("voluntary")) {
          return {
            ok: false,
            error: "Fixed Savings accounts can only be funded from a Voluntary Savings account.",
          };
        }
      }

      // 2. Shares Rule: share accounts must move through /api/v1/shares/transfer,
      // which keeps ShareAccount/ShareTransaction and the Share Capital GL
      // entry in sync with Account.balance. This generic transfer only moves
      // Account.balance, so allowing a share account through here would
      // silently desync it the same way generic deposits/withdrawals did
      // before they were guarded (see processDeposit/processWithdrawal above).
      if (sourceAccount.accountType.isShareAccount || targetAccount.accountType.isShareAccount) {
        return {
          ok: false,
          error: "Share accounts cannot be moved via internal transfer. Use the Shares Transfer flow instead.",
        };
      }

      const result = await db.$transaction(async (tx) => {
        const transferRef = `TRF-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

        // Create transaction records
        const transaction = await tx.transaction.create({
          data: {
            transactionRef: transferRef,
            type: TransactionType.TRANSFER,
            amount: data.amount,
            status: TransactionStatus.COMPLETED,
            description:
              data.description ||
              `Transfer from ${sourceAccount.accountNumber} to ${targetAccount.accountNumber}`,
            memberId: sourceAccount.memberId,
            accountId: sourceAccount.id,
            processedByUserId: handlerUserId,
            channel: "INTERNAL",
          },
        });

        // Debit Source
        await tx.account.update({
          where: { id: sourceAccount.id },
          data: { balance: { decrement: data.amount } },
        });

        // Credit Target
        await tx.account.update({
          where: { id: targetAccount.id },
          data: { balance: { increment: data.amount } },
        });

        // GL journal entry: Dr Source Savings, Cr Target Savings
        const sourceLedgerId = (sourceAccount.accountType as any)?.ledgerAccountId;
        const targetLedgerId = (targetAccount.accountType as any)?.ledgerAccountId;

        if (sourceLedgerId && targetLedgerId) {
          const [srcGL, tgtGL] = await Promise.all([
            tx.chartOfAccount.findUnique({ where: { id: sourceLedgerId } }),
            tx.chartOfAccount.findUnique({ where: { id: targetLedgerId } }),
          ]);

          if (srcGL && tgtGL) {
            const entryNumber = `JE-TRF-${Date.now()}`;

            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: srcGL.id,
                debitAmount: data.amount,
                creditAmount: 0,
                description: data.description || `Transfer from ${sourceAccount.accountNumber} to ${targetAccount.accountNumber}`,
                entryDate: new Date(),
                reference: transferRef,
                branchId: sourceAccount.branchId || targetAccount.branchId || undefined,
                createdByUserId: handlerUserId,
              },
            });

            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: tgtGL.id,
                debitAmount: 0,
                creditAmount: data.amount,
                description: data.description || `Transfer from ${sourceAccount.accountNumber} to ${targetAccount.accountNumber}`,
                entryDate: new Date(),
                reference: transferRef,
                branchId: sourceAccount.branchId || targetAccount.branchId || undefined,
                createdByUserId: handlerUserId,
              },
            });

            await tx.chartOfAccount.update({
              where: { id: srcGL.id },
              data: buildAccountBalanceUpdate(srcGL, { debitAmount: data.amount }),
            });

            await tx.chartOfAccount.update({
              where: { id: tgtGL.id },
              data: buildAccountBalanceUpdate(tgtGL, { creditAmount: data.amount }),
            });
          }
        }

        // 5. Notifications
        const sourceUserId =
          sourceAccount.member?.userId || sourceAccount.institution?.userId;
        const targetUserId =
          targetAccount.member?.userId || targetAccount.institution?.userId;

        if (sourceUserId) {
          await tx.notification.create({
            data: {
              userId: sourceUserId,
              type: "IN_APP",
              subject: "Transfer Sent",
              message: `Transfer of UGX ${data.amount.toLocaleString()} from your account ${sourceAccount.accountNumber} to ${targetAccount.accountNumber} has been processed successfully. Reference: ${transferRef}`,
              targetAddress: `/dashboard/accounts`,
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }

        if (targetUserId && targetUserId !== sourceUserId) {
          await tx.notification.create({
            data: {
              userId: targetUserId,
              type: "IN_APP",
              subject: "Transfer Received",
              message: `You have received a transfer of UGX ${data.amount.toLocaleString()} into your account ${targetAccount.accountNumber} from ${sourceAccount.accountNumber}. Reference: ${transferRef}`,
              targetAddress: `/dashboard/accounts`,
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }

        return transaction;
      });

      void bumpAccountingSyncState("Internal transfer processed");
      return { ok: true, data: result };
    } catch (error: any) {
      console.error("Transfer Service Error:", error);
      return {
        ok: false,
        error: error.message || "Failed to process transfer",
      };
    }
  }

  /**
   * Fetch Withdrawals with Role-Based Filtering
   */
  static async getWithdrawals(
    filters: {
      branchId?: string;
      memberId?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    try {
      const where: any = {};
      if (filters.branchId) where.transaction = { branchId: filters.branchId };
      if (filters.memberId) where.memberId = filters.memberId;

      const data = await db.withdrawal.findMany({
        where,
        include: {
          transaction: true,
          member: { include: { user: true } },
          account: { include: { accountType: true, branch: true } },
          handler: true,
        },
        orderBy: { withdrawalDate: "desc" },
        take: filters.take || 50,
        skip: filters.skip || 0,
      });

      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Fetch Deposits with Role-Based Filtering
   */
  static async getDeposits(
    filters: {
      branchId?: string;
      memberId?: string;
      institutionId?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    try {
      const where: any = {};
      if (filters.branchId) where.transaction = { branchId: filters.branchId };
      if (filters.memberId) where.memberId = filters.memberId;
      if (filters.institutionId) where.institutionId = filters.institutionId;

      const data = await db.deposit.findMany({
        where,
        include: {
          transaction: true,
          member: { include: { user: true } },
          institution: { include: { user: true } },
          account: { include: { accountType: true, branch: true } },
          handler: true,
        },
        orderBy: { depositDate: "desc" },
        take: filters.take || 50,
        skip: filters.skip || 0,
      });

      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Fetch All Transactions (Unified)
   */
  static async getAllTransactions(
    filters: {
      branchId?: string;
      memberId?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      take?: number;
      skip?: number;
    } = {},
  ) {
    try {
      const where: any = {};
      if (filters.branchId) where.account = { branchId: filters.branchId };
      if (filters.memberId) where.memberId = filters.memberId;
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;

      const data = await db.transaction.findMany({
        where,
        include: {
          member: { include: { user: true } },
          institution: { include: { user: true } },
          account: { include: { accountType: true, branch: true } },
          processedByUser: true,
          deposit: true,
          withdrawal: true,
        },
        orderBy: { transactionDate: "desc" },
        take: filters.take || 100,
        skip: filters.skip || 0,
      });

      return { ok: true, data };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get Transaction Statistics
   */
  static async getStatistics(
    branchId?: string,
    includeTrends: boolean = false,
  ) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const where: any = {};
      if (branchId) where.account = { branchId };

      const [totalStats, todayStats, pendingCount, failedCount, typeBreakdown] =
        await Promise.all([
          db.transaction.aggregate({
            where,
            _sum: { amount: true },
            _count: { _all: true },
          }),
          db.transaction.aggregate({
            where: { ...where, transactionDate: { gte: today } },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          db.transaction.count({
            where: { ...where, status: TransactionStatus.PENDING },
          }),
          db.transaction.count({
            where: { ...where, status: TransactionStatus.FAILED },
          }),
          db.transaction.groupBy({
            by: ["type"],
            where,
            _sum: { amount: true },
            _count: { _all: true },
          }),
        ]);

      let trends: { month: string; income: number; expenditure: number }[] = [];
      if (includeTrends) {
        trends = await this.getMonthlyTrends(branchId);
      }

      return {
        ok: true,
        data: {
          totalTransactions: totalStats._count._all,
          totalAmount: totalStats._sum.amount || 0,
          todayTransactions: todayStats._count._all,
          todayAmount: todayStats._sum.amount || 0,
          pendingTransactions: pendingCount,
          failedTransactions: failedCount,
          typeBreakdown: typeBreakdown.map((item) => ({
            type: item.type,
            count: item._count._all,
            amount: item._sum.amount || 0,
          })),
          trends,
        },
      };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get 6-month Transaction Trends
   */
  static async getMonthlyTrends(branchId?: string) {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
        label: d.toLocaleString("default", { month: "short" }),
      });
    }

    const trends = await Promise.all(
      months.map(async (month) => {
        const where: any = {
          transactionDate: {
            gte: month.start,
            lte: month.end,
          },
          status: TransactionStatus.COMPLETED,
        };
        if (branchId) where.account = { branchId };

        const stats = await db.transaction.groupBy({
          by: ["type"],
          where,
          _sum: { amount: true },
        });

        const income = stats
          .filter((s) =>
            (
              [
                TransactionType.DEPOSIT,
                TransactionType.LOAN_REPAYMENT,
              ] as TransactionType[]
            ).includes(s.type),
          )
          .reduce((sum, s) => sum + (s._sum.amount || 0), 0);

        const expenditure = stats
          .filter((s) =>
            (
              [
                TransactionType.WITHDRAWAL,
                TransactionType.LOAN_DISBURSEMENT,
                TransactionType.FEE,
              ] as TransactionType[]
            ).includes(s.type),
          )
          .reduce((sum, s) => sum + (s._sum.amount || 0), 0);

        return {
          month: month.label,
          income,
          expenditure,
        };
      }),
    );

    return trends;
  }

  /**
   * Manual Verification of Relworx Payment (Polling Fallback)
   */
  static async verifyRelworxPayment(transactionId: string) {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        account: true,
        deposit: true,
      },
    });

    if (!transaction) throw new Error("Transaction not found");
    if (transaction.status !== TransactionStatus.PENDING) {
      return { success: true, status: transaction.status, message: "Transaction already processed." };
    }

    const { RelworxService } = await import("@/services/relworx.service");
    
    // We need the internal_reference from the deposit record
    const internalRef = transaction.deposit?.mobileMoneyRef || transaction.transactionRef;

    try {
      const statusResponse = await RelworxService.getTransactionStatus(internalRef);
      
      if (statusResponse.status === "success") {
        await db.$transaction(async (tx) => {
          // Update transaction
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { 
                status: TransactionStatus.COMPLETED,
                notes: (transaction.notes ? transaction.notes + " - " : "") + "Verified manually via Polling"
            },
          });

          // Update Account Balance if it's a deposit
          if (transaction.type === "DEPOSIT" || transaction.type === "FEE") {
            await tx.account.update({
              where: { id: transaction.accountId },
              data: { balance: { increment: transaction.amount } },
            });
          }
          
          // If it's a repayment, fulfill it
          if (transaction.type === "LOAN_REPAYMENT" && transaction.loanId) {
             const { LoanService } = await import("@/services/loan.service");
             await LoanService.repay({
                loanId: transaction.loanId,
                amount: transaction.amount,
                handlerId: transaction.processedByUserId || "SYSTEM",
                channel: "RELWORX_VERIFIED",
                reference: internalRef,
                transactionId: transaction.id
             });
          }
        });

        void bumpAccountingSyncState("Relworx payment verified");
        return { success: true, status: TransactionStatus.COMPLETED, message: "Payment verified and processed successfully." };
      } 
      
      if (statusResponse.status === "failed") {
        // A MOBILE_MONEY deposit's Account.balance and float are applied
        // immediately at creation (see processDeposit), before the provider
        // confirms the payment. If the provider later reports failure, that
        // balance/float must be unwound here — otherwise the member's
        // balance and the handling teller/agent's float stay permanently
        // inflated for a deposit that never actually arrived.
        await db.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: TransactionStatus.FAILED },
          });

          if (
            (transaction.type === "DEPOSIT" || transaction.type === "FEE") &&
            transaction.deposit?.channel?.toUpperCase() === "MOBILE_MONEY"
          ) {
            await tx.account.update({
              where: { id: transaction.accountId },
              data: { balance: { decrement: transaction.amount } },
            });

            const relatedFloatTxn = await tx.floatTransaction.findFirst({
              where: { relatedTransactionId: transaction.id, type: TransactionType.DEPOSIT },
            });
            if (relatedFloatTxn) {
              const floatWasIncrement = relatedFloatTxn.amount >= 0;
              await tx.userFloat.update({
                where: { id: relatedFloatTxn.floatId },
                data: {
                  balance: {
                    [floatWasIncrement ? "decrement" : "increment"]: Math.abs(relatedFloatTxn.amount),
                  },
                },
              });
              await tx.floatTransaction.create({
                data: {
                  floatId: relatedFloatTxn.floatId,
                  type: TransactionType.DEPOSIT,
                  amount: -relatedFloatTxn.amount,
                  description: `Reversal - Mobile Money deposit failed (${transaction.transactionRef})`,
                  performedByUserId: transaction.processedByUserId || relatedFloatTxn.performedByUserId,
                  relatedTransactionId: transaction.id,
                },
              });
            }
          }
        });
        void bumpAccountingSyncState("Relworx payment failed");
        return { success: true, status: TransactionStatus.FAILED, message: "Payment failed at Relworx." };
      }

      return { success: true, status: TransactionStatus.PENDING, message: `Payment is still ${statusResponse.status}.` };

    } catch (error: any) {
      console.error("Verification Error:", error);
      throw new Error(`Failed to verify status with Relworx: ${error.message}`);
    }
  }
}
