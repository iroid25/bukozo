import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { sendTransactionAlertEmail } from "@/lib/email";
import { UserRole, TransactionType, TransactionStatus } from "@prisma/client";
import {
  calculateAgentWithdrawalFee,
  AGENT_WITHDRAWAL_FEES,
  MEMBER_WITHDRAWAL_FEES,
  INSTITUTION_WITHDRAWAL_FEES,
} from "@/config/fees";
import { getFeeConfig } from "@/actions/settings/fees";
import { rateLimit, RateLimits } from "@/lib/rate-limit";
import {
  WithdrawalSchema,
  validateData,
  formatZodErrors,
} from "@/lib/validation";
import { logger, auditFinancialTransaction } from "@/lib/logger";
import { successResponse, ApiErrors } from "@/lib/api-utils";
import { insertFingerprintLog } from "@/lib/fingerprint-db";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { FEE_INCOME_CODE, WITHDRAWAL_FEE_CODE } from "@/lib/services/income-structure";
import { COMMISSION_EXPENSE_CODE, ensureExpenditureStructure } from "@/lib/services/expenditure-structure";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

async function getDynamicAgentWithdrawalFees() {
  const result = await getFeeConfig("AGENT_WITHDRAWAL_FEES");
  return result.success && result.data ? result.data : AGENT_WITHDRAWAL_FEES;
}

// GET /api/v1/withdrawals - List Withdrawals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || user.branchId;
    const memberId = searchParams.get("memberId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");

    const whereClause: any = {
      ...(memberId && { memberId }),
      ...(!memberId && user.role !== UserRole.ADMIN && user.branchId && { account: { branchId: user.branchId } }),
      ...(!memberId && user.role === UserRole.ADMIN && branchId && { account: { branchId } }),
    };

    const withdrawals = await db.withdrawal.findMany({
      where: whereClause,
      include: {
        transaction: true,
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true, image: true } },
          },
        },
        institution: {
          include: {
            user: { select: { name: true, email: true, phone: true, image: true } },
          },
        },
        handler: { select: { name: true, role: true } },
      },
      orderBy: { withdrawalDate: "desc" },
      take: limit,
    });

    return successResponse(withdrawals);
  } catch (error: any) {
    logger.error("Error fetching withdrawals", error);
    return ApiErrors.internalError(error.message); // fixed: was ApiErrors.internal
  }
}

// Helper to generate unique transaction reference
async function generateWithdrawalRef(): Promise<string> {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `WTH${timestamp}${random}`;
}

// POST /api/v1/withdrawals - Process Member Withdrawal
export async function POST(request: NextRequest) {
  let handlerUserId: string | undefined;
  try {
    // 1. Rate Limiting
    const rateLimitResult = await rateLimit(RateLimits.financial)(request);
    if (rateLimitResult) return rateLimitResult;

    // 2. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn("Unauthorized withdrawal attempt", {
        ip: request.headers.get("x-forwarded-for") || "unknown",
        path: request.nextUrl.pathname,
      });
      return ApiErrors.unauthorized();
    }
    handlerUserId = (session.user as any).id;

    // 3. Input Validation
    const body = await request.json();
    const validation = validateData(WithdrawalSchema, body);

    if (!validation.success) {
      logger.warn("Invalid withdrawal request", {
        userId: handlerUserId,
        errors: formatZodErrors(validation.errors!),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: formatZodErrors(validation.errors!),
        },
        { status: 400 },
      );
    }

    const {
      memberId,
      accountId,
      amount,
      channel,
      mobileMoneyRef,
      description,
      fingerprintVerified,
      fingerprintMatchScore,
    } = validation.data;

    // 1. Fetch Account & Validations
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        accountType: true,
        member: true,
        institution: { include: { user: true } },
      },
    });

    if (!account)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (account.memberId) {
      try {
        await assertMemberCanTransact(account.memberId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    if (account.status !== "ACTIVE")
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 400 },
      );

    // Enforce Share Account / Withdrawal Restrictions
    if (account.accountType.isShareAccount) {
      return NextResponse.json(
        {
          error:
            "Direct withdrawals from Share Accounts are not permitted. Please use the Transfer functionality to liquidate shares to a savings account first.",
        },
        { status: 400 },
      );
    }

    if (!account.accountType.canWithdraw) {
      return NextResponse.json(
        {
          error: "Withdrawals are restricted for this account type.",
        },
        { status: 400 },
      );
    }

    const requiresFingerprint = Boolean(account.member?.fingerprintTemplate);
    const fingerprintMemberId = memberId || account.memberId || undefined;
    const fingerprintIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";
    if (
      requiresFingerprint &&
      (!fingerprintVerified || (fingerprintMatchScore ?? 0) < 40)
    ) {
      if (fingerprintMemberId) {
        await insertFingerprintLog({
          memberId: fingerprintMemberId,
          action: "VERIFY_FAIL",
          score: fingerprintMatchScore ?? null,
          ipAddress: fingerprintIp,
        });
      }
      return NextResponse.json(
        {
          error:
            "Fingerprint verification is required for this member before withdrawal can be processed.",
        },
        { status: 403 },
      );
    }

    // Fetch Handler Role
    const user = await db.user.findUnique({
      where: { id: handlerUserId! },
      select: { role: true },
    });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 401 });

    const handlerRole = user.role;

    // Calculate Fees (Dynamic for Agents)
    let totalDeduction = amount;
    let fee = 0;
    let saccoShare = 0;
    let agentShare = 0;

    if (handlerRole === "AGENT" && channel?.toUpperCase() === "CASH") {
      const feeTiers = await getDynamicAgentWithdrawalFees();
      const tiers = feeTiers as any[];
      const tier = tiers.find(
        (t) => amount >= t.min && (t.max === 0 || amount <= t.max),
      );

      if (tier) {
        fee = tier.charge;
        saccoShare = tier.saccoShare;
        agentShare = tier.agentShare;
      }
    } else {
      // Standard Withdrawal Fee
      if (account.customFlatWithdrawalFee !== null) {
        fee = account.customFlatWithdrawalFee;
      } else if (account.customWithdrawalFeePercentage !== null) {
        fee = (account.customWithdrawalFeePercentage / 100) * amount;
      } else if (account.accountType.flatWithdrawalFee !== null) {
        fee = account.accountType.flatWithdrawalFee;
      } else if (account.accountType.withdrawalFeePercentage !== null) {
        fee = (account.accountType.withdrawalFeePercentage / 100) * amount;
      } else {
        // Determine if Institution or Member
        const isInstitution = !!account.institutionId;
        const configKey = isInstitution
          ? "TELLER_WITHDRAWAL_RATES_INSTITUTION"
          : "TELLER_WITHDRAWAL_RATES_MEMBER";
        const defaultFees = isInstitution
          ? INSTITUTION_WITHDRAWAL_FEES
          : MEMBER_WITHDRAWAL_FEES;

        // Check System Configuration Tiers
        const sysConfig = await db.systemConfiguration.findUnique({
          where: { key: configKey },
        });

        // Use DB config if available, otherwise use defaults from code
        const tiers =
          sysConfig && sysConfig.value
            ? JSON.parse(sysConfig.value)
            : defaultFees;

        try {
          const match = (tiers as any[]).find(
            (t: any) =>
              amount >= t.min &&
              (t.max === null || t.max === 0 || amount <= t.max),
          );

          if (match) {
            fee = match.fee;
          }
        } catch (e) {
          console.error("Error processing withdrawal rates", e);
        }
      }
      saccoShare = fee;
    }
    totalDeduction = amount + fee;

    if (account.balance < totalDeduction) {
      return NextResponse.json(
        {
          error: `Insufficient member funds. Required: ${totalDeduction.toLocaleString()} (Principal: ${amount.toLocaleString()} + Fee: ${fee.toLocaleString()})`,
        },
        { status: 400 },
      );
    }
    // Check min balance
    if (
      account.balance - totalDeduction <
      (account.accountType.minBalance || 0)
    ) {
      return NextResponse.json(
        {
          error: `Withdrawal violates minimum balance of ${(account.accountType.minBalance || 0).toLocaleString()}`,
        },
        { status: 400 },
      );
    }

    // 2. Fetch Chart of Accounts (GL)
    const resolvedLiabilityAccountId = account.accountType.ledgerAccountId;
    const isBankChannel = channel?.toLowerCase() === "bank";
    const defaultCashCode = isBankChannel ? "102002" : "102001";
    const [cashAccount, savingsLiabilityAccount] = await Promise.all([
      db.chartOfAccount.findFirst({
        where: { accountCode: defaultCashCode, isActive: true },
      }),
      resolvedLiabilityAccountId
        ? db.chartOfAccount.findUnique({
            where: { id: resolvedLiabilityAccountId },
          })
        : db.chartOfAccount.findFirst({
            where: {
              ledgerType: "LIABILITIES",
              accountName: { contains: "SAVINGS", mode: "insensitive" },
            },
          }),
    ]);

    if (!savingsLiabilityAccount) {
      return NextResponse.json(
        {
          error:
            "System configuration error: No mapped Liability Account found for this Savings product.",
        },
        { status: 500 },
      );
    }

    // 3. Transaction
    // Ensure expenditure COA accounts exist before transaction
    await ensureExpenditureStructure();
    const result = await db.$transaction(async (tx) => {
      // Transaction Ref
      const transactionRef = `WTH${Date.now()}`;
      const entryNumber = `JE-WTH-${Date.now()}`;

      // A. Check & Update Handler Float (If CASH)
      if (channel?.toUpperCase() === "CASH") {
        const userFloat = await tx.userFloat.findUnique({
          where: { userId: handlerUserId! },
        });
        if (!userFloat) throw new Error("Handler Float not found");

        if (handlerRole === "AGENT") {
          // AGENT WITHDRAWAL:
          // Agent Gives Cash.
          // Agent Receives Float (Amount + AgentShare).
          const floatIncrement = amount + agentShare;

          await tx.userFloat.update({
            where: { userId: handlerUserId! },
            data: { balance: { increment: floatIncrement } },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.WITHDRAWAL,
              amount: floatIncrement,
              description: `Agent Withdrawal - ${transactionRef}. Earned: ${agentShare}`,
              performedByUserId: handlerUserId!,
            },
          });
        } else {
          // TELLER WITHDRAWAL:
          // Teller Gives Cash (amount + fee).
          // Float Decrements by total (principal + fee collected for SACCO).
          const tellerFloatDeduction = amount + fee;
          if (userFloat.balance < tellerFloatDeduction)
            throw new Error(
              `Insufficient Teller Float. Available: ${userFloat.balance}. Required: ${tellerFloatDeduction}`,
            );

          await tx.userFloat.update({
            where: { userId: handlerUserId! },
            data: { balance: { decrement: tellerFloatDeduction } },
          });

          await tx.floatTransaction.create({
            data: {
              floatId: userFloat.id,
              type: TransactionType.WITHDRAWAL,
              amount: -tellerFloatDeduction,
              description: `Cash Withdrawal - ${transactionRef}. Principal: ${amount}, Fee: ${fee}`,
              performedByUserId: handlerUserId!,
            },
          });
        }
      }

      // B. Create Transaction Record
      const transaction = await tx.transaction.create({
        data: {
          transactionRef,
          memberId: memberId || account.memberId,
          institutionId: account.institutionId || null,
          accountId: accountId,
          type: TransactionType.WITHDRAWAL,
          amount: amount,
          fee: fee,
          status: "COMPLETED",
          branchId: account.branchId,
          description:
            description ||
            (handlerRole === "AGENT"
              ? `Agent Withdrawal: UGX ${amount}. Fee: ${fee} (Sacco: ${saccoShare}, Agent: ${agentShare})`
              : `Withdrawal via ${channel}. Fee: ${fee}`),
          processedByUserId: handlerUserId!,
          channel: channel || "CASH",
        },
      });

      // C. Create Withdrawal Record
      const withdrawal = await tx.withdrawal.create({
        data: {
          transactionId: transaction.id,
          memberId: memberId || account.memberId,
          institutionId: account.institutionId || null,
          accountId: accountId,
          amount: amount,
          fee: fee,
          handlerUserId: handlerUserId!,
          channel: channel || "CASH",
          mobileMoneyRef: mobileMoneyRef || null,
        },
      });

      if (requiresFingerprint && fingerprintMemberId && (fingerprintMatchScore ?? 0) >= 40) {
        await tx.$executeRaw`
          INSERT INTO "FingerprintLog" (
            "memberId",
            "action",
            "quality",
            "score",
            "ipAddress",
            "createdAt"
          ) VALUES (
            ${fingerprintMemberId},
            ${"VERIFY_SUCCESS"},
            ${null},
            ${fingerprintMatchScore ?? null},
            ${fingerprintIp},
            ${new Date()}
          )
        `;
      }

      // D. Update Member Account Balance
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: totalDeduction } },
      });

      // E. Consolidated GL Entries
      if (savingsLiabilityAccount) {
        // For agent withdrawals, the cash impact includes agentShare (agent float increases)
        const cashCreditAmount = handlerRole === "AGENT" ? amount + agentShare : amount;
        const cashCode = isBankChannel ? "102002" : "102001";

        const resolvedCashAccount = cashAccount?.id
          ? cashAccount
          : await tx.chartOfAccount.findFirst({
              where: { accountCode: cashCode, isActive: true },
            });

        if (!resolvedCashAccount) {
          throw new Error("Cash GL account not found for withdrawal");
        }

        const journalEntries = [
          {
            entryNumber,
            accountId: savingsLiabilityAccount.id,
            debitAmount: totalDeduction,
            creditAmount: 0,
            description: `Withdrawal from ${account.accountNumber} (Principal: ${amount}, Fee: ${fee})`,
            entryDate: new Date(),
            reference: transactionRef,
            transactionId: transaction.id,
            createdByUserId: handlerUserId!,
            branchId: account.branchId,
          },
          {
            entryNumber,
            accountId: resolvedCashAccount.id,
            debitAmount: 0,
            creditAmount: cashCreditAmount,
            description: `Cash Out - Withdrawal Ref: ${transactionRef}`,
            entryDate: new Date(),
            reference: transactionRef,
            transactionId: transaction.id,
            createdByUserId: handlerUserId!,
            branchId: account.branchId,
          },
        ];

        await tx.chartOfAccount.update({
          where: { id: savingsLiabilityAccount.id },
          data: buildAccountBalanceUpdate(savingsLiabilityAccount, { debitAmount: totalDeduction }),
        });

        await tx.chartOfAccount.update({
          where: { id: resolvedCashAccount.id },
          data: buildAccountBalanceUpdate(resolvedCashAccount, { creditAmount: cashCreditAmount }),
        });

        if (saccoShare > 0) {
          const feeIncomeAccount =
            (await tx.chartOfAccount.findFirst({
              where: {
                accountCode: WITHDRAWAL_FEE_CODE,
                ledgerType: "INCOME",
                isActive: true,
              },
            })) ||
            (await tx.chartOfAccount.findFirst({
              where: {
                accountCode: FEE_INCOME_CODE,
                ledgerType: "INCOME",
                isActive: true,
              },
            }));

          const feeBudgetCategory = await tx.budgetCategory.findFirst({
            where: { code: WITHDRAWAL_FEE_CODE, kind: "INCOME", isActive: true },
          });

          if (feeIncomeAccount) {
            journalEntries.push({
              entryNumber,
              accountId: feeIncomeAccount.id,
              debitAmount: 0,
              creditAmount: saccoShare,
              description: `Sacco Share of Withdrawal Fee - ${transactionRef}`,
              transactionId: transaction.id,
              createdByUserId: handlerUserId!,
              entryDate: new Date(),
              reference: transactionRef,
              branchId: account.branchId,
            });

            await tx.chartOfAccount.update({
              where: { id: feeIncomeAccount.id },
              data: buildAccountBalanceUpdate(feeIncomeAccount, { creditAmount: saccoShare }),
            });

            await tx.incomeRecord.create({
              data: {
                amount: saccoShare,
                description: `Withdrawal Fee (Sacco Share) - ${transactionRef}`,
                receivedByUserId: handlerUserId!,
                branchId: account.branchId,
                memberId: memberId || account.memberId,
                accountId: accountId,
                status: TransactionStatus.COMPLETED,
                recordDate: new Date(),
                budgetCategoryId: feeBudgetCategory?.id,
              },
            });
          }
        }

        if (handlerRole === "AGENT" && agentShare > 0) {
          // Record agent commission as expense: Dr Commission Expense, Cr Cash
          const commissionAccount = await tx.chartOfAccount.findFirst({
            where: { accountCode: COMMISSION_EXPENSE_CODE, isActive: true },
          });
          if (commissionAccount) {
            journalEntries.push({
              entryNumber,
              accountId: commissionAccount.id,
              debitAmount: agentShare,
              creditAmount: 0,
              description: `Agent Commission - Withdrawal Ref: ${transactionRef}`,
              entryDate: new Date(),
              reference: transactionRef,
              transactionId: transaction.id,
              createdByUserId: handlerUserId!,
              branchId: account.branchId,
            });

            await tx.chartOfAccount.update({
              where: { id: commissionAccount.id },
              data: buildAccountBalanceUpdate(commissionAccount, { debitAmount: agentShare }),
            });
          }
        }

        await tx.journalEntry.createMany({ data: journalEntries });
      }

      // 5. Send In-App Notification
      const targetUserId =
        account.member?.userId || account.institution?.user?.id;
      if (targetUserId) {
        await tx.notification.create({
          data: {
            userId: targetUserId,
            type: "IN_APP",
            subject: "Withdrawal Successful",
            message: `Withdrawal of UGX ${amount.toLocaleString()} from account ${account.accountNumber} was successful. Fees: UGX ${fee.toLocaleString()}. New balance: UGX ${(account.balance - totalDeduction).toLocaleString()}. Reference: ${transactionRef}`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }

      return {
        ...withdrawal,
        transactionRef,
      };
    });

    // 4. Log Success & Audit Trail
    logger.info("Withdrawal processed successfully", {
      userId: handlerUserId,
      accountId,
      amount,
      transactionRef: result.transactionRef,
      fee,
    });

    await auditFinancialTransaction({
      action: "WITHDRAWAL",
      userId: handlerUserId!,
      amount,
      accountId,
      transactionRef: result.transactionRef,
      details: {
        channel,
        fee,
        totalDeduction,
        mobileMoneyRef,
      },
      ip: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Send email notification to member
    const memberIdForEmail = result.memberId || account.memberId;
    if (memberIdForEmail) {
      const memberUser = await db.member.findUnique({
        where: { id: memberIdForEmail },
        select: { user: { select: { email: true, name: true } } },
      });

      if (memberUser?.user.email) {
        await sendTransactionAlertEmail(
          memberUser.user.email,
          memberUser.user.name,
          "WITHDRAWAL",
          amount,
          account.balance - totalDeduction,
        );
      }
    }

    // Get updated float balance for teller/agent
    let floatBalance = 0;
    if (channel?.toUpperCase() === "CASH") {
      const updatedFloat = await db.userFloat.findUnique({
        where: { userId: handlerUserId! },
      });
      floatBalance = updatedFloat?.balance || 0;
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        fees: {
          principal: amount,
          fee: fee,
          totalDeduction: totalDeduction,
        },
        floatBalance,
      },
      { status: 201 },
    );
  } catch (error: any) {
    logger.critical("Unexpected error in withdrawal API", error, {
      userId: handlerUserId,
      path: request.nextUrl.pathname,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to process withdrawal"
            : error.message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
