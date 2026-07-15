import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import {
  isVoluntarySavingsAccountTypeName,
} from "@/lib/accounting/account-type-rules";
import { RelworxService } from "./relworx.service";
import { LoanService } from "./loan.service";
import { createMemberDepositJournalEntry } from "@/lib/journal-entries-extended";
import { createWithdrawalPrincipalJournalEntry } from "@/lib/journal-entries-extended";
import { MOBILE_MONEY_FLOAT_CODE } from "@/lib/services/asset-structure";

type InitiationResult = {
  success: boolean;
  message: string;
  reference: string;
  internal_reference?: string | null;
  transactionId: string;
  status: TransactionStatus;
};

type RelworxWebhookPayload = {
  status?: "success" | "failed" | "pending" | string;
  message?: string;
  customer_reference?: string;
  internal_reference?: string;
  msisdn?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  charge?: number;
  provider_transaction_id?: string;
  completed_at?: string;
  reference?: string;
};

type TransactionWithRelations = any;

export class RelworxPaymentService {
  private static readonly CURRENCY = "UGX";
  private static readonly RATE_LIMIT_WINDOW_MINUTES = 10;
  private static readonly RATE_LIMIT_MAX_REQUESTS = 5;

  private static normalizeMsisdn(phoneNumber: string): string {
    const trimmed = (phoneNumber || "").trim();
    if (!trimmed) {
      return "";
    }

    let digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = `256${digits.substring(1)}`;
    } else if (digits.startsWith("7") && digits.length === 9) {
      digits = `256${digits}`;
    }

    return digits.startsWith("256") ? `+${digits}` : trimmed;
  }

  private static randomSuffix(): string {
    return Math.random().toString(36).slice(2, 6);
  }

  private static buildReference(prefix: string, entityId: string): string {
    // Keep this well under Relworx's 36-char cap WITHOUT truncating — a naive
    // slice(0, 36) on a long cuid entityId chops off the timestamp/random suffix
    // entirely, making every retry produce the same (colliding) string.
    const shortId = entityId.slice(-8);
    return `${prefix}-${shortId}-${Date.now().toString(36)}-${this.randomSuffix()}`;
  }

  private static async generateUniqueReference(
    prefix: string,
    entityId: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const reference = this.buildReference(prefix, entityId);
      const existing = await db.transaction.findUnique({
        where: { transactionRef: reference },
        select: { id: true },
      });

      if (!existing) {
        return reference;
      }
    }

    throw new Error("Unable to generate a unique mobile money reference");
  }

  private static async getMemberAccount(memberId: string) {
    const account = await db.account.findFirst({
      where: {
        memberId,
        status: "ACTIVE",
      },
      include: {
        accountType: true,
        member: {
          include: {
            user: true,
          },
        },
        branch: true,
      },
      orderBy: [
        {
          openedAt: "asc",
        },
      ],
    });

    if (!account) {
      throw new Error("No active member account found");
    }

    return account;
  }

  private static async getMemberSavingsAccount(memberId: string) {
    const activeAccounts = await db.account.findMany({
      where: {
        memberId,
        status: "ACTIVE",
      },
      include: {
        accountType: true,
        member: {
          include: {
            user: true,
          },
        },
        branch: true,
      },
      orderBy: [
        {
          openedAt: "asc",
        },
      ],
    });

    if (!activeAccounts.length) {
      throw new Error("Member does not have an active account");
    }

    const preferredAccount = activeAccounts.find((account) =>
      isVoluntarySavingsAccountTypeName(account.accountType.name),
    );

    return preferredAccount || activeAccounts[0];
  }

  private static async getLoanForMember(loanId: string, memberId: string) {
    const loan = await db.loan.findFirst({
      where: {
        id: loanId,
        memberId,
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        schedules: {
          orderBy: {
            period: "asc",
          },
        },
        repayments: true,
      },
    });

    if (!loan) {
      throw new Error("Loan not found for this member");
    }

    return loan;
  }

  private static async enforceRateLimit(msisdn: string, type: TransactionType) {
    if (!msisdn) {
      throw new Error("Phone number is required");
    }

    const windowStart = new Date(
      Date.now() - this.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    );

    const recentCount = await db.transaction.count({
      where: {
        customerId: msisdn,
        type: {
          in: [TransactionType.DEPOSIT, TransactionType.LOAN_REPAYMENT],
        },
        channel: "MOBILE_MONEY",
        transactionDate: {
          gte: windowStart,
        },
      },
    });

    if (recentCount >= this.RATE_LIMIT_MAX_REQUESTS) {
      throw new Error(
        `Rate limit exceeded. Please wait before sending another ${type.toLowerCase().replace("_", " ")} request for this phone number.`,
      );
    }
  }

  private static async createPendingTransaction(params: {
    reference: string;
    memberId: string;
    accountId: string;
    loanId?: string | null;
    amount: number;
    description: string;
    msisdn: string;
    type: TransactionType;
    processedByUserId?: string;
  }) {
    return db.transaction.create({
      data: {
        transactionRef: params.reference,
        memberId: params.memberId,
        accountId: params.accountId,
        loanId: params.loanId || undefined,
        type: params.type,
        amount: params.amount,
        currency: this.CURRENCY,
        status: TransactionStatus.PENDING,
        description: params.description,
        channel: "MOBILE_MONEY",
        customerId: params.msisdn,
        paymentMethod: "RELWORX",
        processedByUserId: params.processedByUserId,
      },
    });
  }

  private static async updateTransactionWithRelworxMeta(
    transactionId: string,
    payload: {
      internalReference?: string | null;
      provider?: string | null;
      providerTransactionId?: string | null;
      charge?: number | null;
      completedAt?: string | null;
      notes?: string | null;
      status?: TransactionStatus;
    },
  ) {
    return db.transaction.update({
      where: { id: transactionId },
      data: {
        externalReference: payload.internalReference || undefined,
        paymentReference: payload.providerTransactionId || undefined,
        paymentMethod: payload.provider || undefined,
        fee: payload.charge ?? undefined,
        valueDate: payload.completedAt ? new Date(payload.completedAt) : undefined,
        notes: payload.notes || undefined,
        status: payload.status || undefined,
      },
    });
  }

  private static async recordDepositCompletion(
    tx: any,
    transaction: NonNullable<TransactionWithRelations>,
    payload: RelworxWebhookPayload,
  ) {
    const account = await tx.account.findUnique({
      where: { id: transaction.accountId },
      include: {
        accountType: true,
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!account) {
      throw new Error("Deposit account not found");
    }

    const existingDeposit = await tx.deposit.findUnique({
      where: { transactionId: transaction.id },
    });

    if (!existingDeposit) {
      await tx.deposit.create({
        data: {
          transactionId: transaction.id,
          memberId: transaction.memberId,
          accountId: transaction.accountId,
          amount: transaction.amount,
          depositDate: payload.completed_at
            ? new Date(payload.completed_at)
            : new Date(),
          handlerUserId: transaction.processedByUserId || account.member.userId,
          channel: "MOBILE_MONEY",
          mobileMoneyRef: payload.internal_reference || transaction.externalReference,
          depositorName: transaction.member?.user?.name || account.member?.user?.name || null,
          depositType: "DIRECT",
        },
      });
    } else {
      await tx.deposit.update({
        where: { id: existingDeposit.id },
        data: {
          mobileMoneyRef: payload.internal_reference || transaction.externalReference || existingDeposit.mobileMoneyRef,
        },
      });
    }

    await tx.account.update({
      where: { id: transaction.accountId },
      data: {
        balance: {
          increment: transaction.amount,
        },
      },
    });

    await createMemberDepositJournalEntry({
      amount: transaction.amount,
      description: `Mobile Money Deposit - ${transaction.transactionRef}`,
      reference: transaction.transactionRef,
      transactionId: transaction.id,
      userId: transaction.processedByUserId || transaction.member?.user?.id || "system",
      entryDate: transaction.transactionDate || new Date(),
      branchId: transaction.branchId || account.branchId,
      cashAccountCode: MOBILE_MONEY_FLOAT_CODE,
    }, tx);

    const mmDepositSavingsAccount = await tx.savingsAccount.findUnique({
      where: { accountNumber: account.accountNumber },
      select: { id: true, balance: true },
    });
    if (mmDepositSavingsAccount) {
      await tx.savingsTransaction.create({
        data: {
          accountId: mmDepositSavingsAccount.id,
          transactionType: "DEPOSIT",
          amount: transaction.amount,
          balanceBefore: mmDepositSavingsAccount.balance,
          balanceAfter: mmDepositSavingsAccount.balance + transaction.amount,
          transactionDate: payload.completed_at ? new Date(payload.completed_at) : new Date(),
          reference: transaction.transactionRef,
          description: `Mobile Money Deposit - ${transaction.transactionRef}`,
          tellerId: transaction.processedByUserId || undefined,
        },
      });
      await tx.savingsAccount.update({
        where: { id: mmDepositSavingsAccount.id },
        data: { balance: { increment: transaction.amount } },
      });
    }
  }

  private static async recordWithdrawalCompletion(
    tx: any,
    transaction: NonNullable<TransactionWithRelations>,
    payload: RelworxWebhookPayload,
  ) {
    const account = await tx.account.findUnique({
      where: { id: transaction.accountId },
      include: {
        accountType: true,
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!account) {
      throw new Error("Withdrawal account not found");
    }

    const existingWithdrawal = await tx.withdrawal.findUnique({
      where: { transactionId: transaction.id },
    });

    if (!existingWithdrawal) {
      await tx.withdrawal.create({
        data: {
          transactionId: transaction.id,
          memberId: transaction.memberId,
          accountId: transaction.accountId,
          amount: transaction.amount,
          withdrawalDate: payload.completed_at
            ? new Date(payload.completed_at)
            : new Date(),
          handlerUserId: transaction.processedByUserId || account.member.userId,
          channel: "MOBILE_MONEY",
          mobileMoneyRef: payload.internal_reference || transaction.externalReference,
        },
      });
    } else {
      await tx.withdrawal.update({
        where: { id: existingWithdrawal.id },
        data: {
          mobileMoneyRef: payload.internal_reference || transaction.externalReference || existingWithdrawal.mobileMoneyRef,
        },
      });
    }

    await tx.account.update({
      where: { id: transaction.accountId },
      data: {
        balance: {
          decrement: transaction.amount,
        },
      },
    });

    await createWithdrawalPrincipalJournalEntry({
      amount: transaction.amount,
      description: `Mobile Money Withdrawal - ${transaction.transactionRef}`,
      reference: transaction.transactionRef,
      transactionId: transaction.id,
      userId: transaction.processedByUserId || transaction.member?.user?.id || "system",
      entryDate: transaction.transactionDate || new Date(),
      branchId: transaction.branchId || account.branchId,
      cashAccountCode: MOBILE_MONEY_FLOAT_CODE,
      debitAccountCode: transaction.account?.accountType?.ledgerAccount?.accountCode || undefined,
    }, tx);

    const mmWithdrawalSavingsAccount = await tx.savingsAccount.findUnique({
      where: { accountNumber: account.accountNumber },
      select: { id: true, balance: true },
    });
    if (mmWithdrawalSavingsAccount) {
      await tx.savingsTransaction.create({
        data: {
          accountId: mmWithdrawalSavingsAccount.id,
          transactionType: "WITHDRAWAL",
          amount: transaction.amount,
          balanceBefore: mmWithdrawalSavingsAccount.balance,
          balanceAfter: mmWithdrawalSavingsAccount.balance - transaction.amount,
          transactionDate: payload.completed_at ? new Date(payload.completed_at) : new Date(),
          reference: transaction.transactionRef,
          description: `Mobile Money Withdrawal - ${transaction.transactionRef}`,
          tellerId: transaction.processedByUserId || undefined,
        },
      });
      await tx.savingsAccount.update({
        where: { id: mmWithdrawalSavingsAccount.id },
        data: { balance: { decrement: transaction.amount } },
      });
    }
  }

  private static async recordLoanRepaymentCompletion(
    tx: any,
    transaction: NonNullable<TransactionWithRelations>,
    payload: RelworxWebhookPayload,
  ) {
    if (!transaction.loanId) {
      throw new Error("Loan repayment transaction is missing loan ID");
    }

    const loan = await tx.loan.findFirst({
      where: {
        id: transaction.loanId,
        memberId: transaction.memberId,
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        schedules: {
          orderBy: {
            period: "asc",
          },
        },
        repayments: true,
      },
    });

    if (!loan) {
      throw new Error("Loan not found for this member");
    }

    const repaymentAlreadyExists = await tx.loanRepayment.findUnique({
      where: { transactionId: transaction.id },
    });

    const { interest, penalty, principal } =
      await LoanService.calculateRepaymentSplit(loan, transaction.amount);

    if (!repaymentAlreadyExists) {
      const repayment = await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          memberId: transaction.memberId as string,
          amount: transaction.amount,
          repaymentDate: payload.completed_at
            ? new Date(payload.completed_at)
            : new Date(),
          handlerUserId:
            transaction.processedByUserId || loan.member.userId,
          channel: "MOBILE_MONEY",
          mobileMoneyRef: payload.internal_reference || transaction.externalReference,
          interestPaid: interest,
          penaltyPaid: penalty,
          principalPaid: principal,
          transactionId: transaction.id,
        },
      });

      let amountToAllocate = transaction.amount;
      const schedules = await tx.loanRepaymentSchedule.findMany({
        where: {
          loanId: loan.id,
          status: { in: ["PENDING", "PARTIAL"] },
        },
        orderBy: { period: "asc" },
      });

      for (const schedule of schedules) {
        if (amountToAllocate <= 0) {
          break;
        }

        const canPay = schedule.totalPayment - schedule.paidAmount;
        const pay = Math.min(amountToAllocate, canPay);
        if (pay > 0) {
          await tx.loanRepaymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmount: { increment: pay },
              status:
                schedule.paidAmount + pay >= schedule.totalPayment
                  ? "PAID"
                  : "PARTIAL",
            },
          });
          amountToAllocate -= pay;
        }
      }

      const lastLedger = await tx.loanLedgerTransaction.findFirst({
        where: { loanId: loan.id },
        orderBy: { transactionDate: "desc" },
      });

      const prevPrincipal =
        lastLedger?.balancePrincipal ?? loan.amountGranted;
      const prevInterest =
        lastLedger?.balanceInterest ?? (loan.interestAmount || 0);

      await tx.loanLedgerTransaction.create({
        data: {
          loanId: loan.id,
          transactionType: "REPAYMENT",
          transactionDate: payload.completed_at
            ? new Date(payload.completed_at)
            : new Date(),
          voucherNo: repayment.id.substring(0, 8).toUpperCase(),
          debitPrincipal: 0,
          debitInterest: 0,
          creditPrincipal: principal,
          creditInterest: interest,
          balancePrincipal: Math.max(0, prevPrincipal - principal),
          balanceInterest: Math.max(0, prevInterest - interest),
          balanceTotal:
            Math.max(0, prevPrincipal - principal) +
            Math.max(0, prevInterest - interest),
        },
      });
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        outstandingBalance: {
          decrement: transaction.amount,
        },
        amountPaid: {
          increment: transaction.amount,
        },
        interestPaid: {
          increment: interest,
        },
        penaltyPaid: {
          increment: penalty,
        },
        principalPaid: {
          increment: principal,
        },
        status:
          loan.outstandingBalance - transaction.amount <= 0.01
            ? "REPAID"
            : undefined,
      },
    });
  }

  public static async initiateDeposit(
    memberId: string,
    phoneNumber: string,
    amount: number,
    description?: string,
  ): Promise<InitiationResult> {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    await assertMemberCanTransact(memberId);

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    const account = await this.getMemberSavingsAccount(memberId);
    const msisdn = this.normalizeMsisdn(phoneNumber || member.user.phone || "");

    if (!msisdn) {
      throw new Error("Phone number is required for mobile money deposit");
    }

    await this.enforceRateLimit(msisdn, TransactionType.DEPOSIT);

    const reference = await this.generateUniqueReference("DEP", memberId);
    const transaction = await this.createPendingTransaction({
      reference,
      memberId,
      accountId: account.id,
      amount,
      description: description || "SACCO Deposit",
      msisdn,
      type: TransactionType.DEPOSIT,
      processedByUserId: member.userId,
    });

    try {
      const relworxResponse = await RelworxService.requestPayment({
        msisdn,
        amount,
        currency: this.CURRENCY,
        reference,
        description: description || "SACCO Deposit",
      });

      if (!relworxResponse.success) {
        throw new Error(relworxResponse.message || "Relworx rejected the request");
      }

      await this.updateTransactionWithRelworxMeta(transaction.id, {
        internalReference: relworxResponse.internal_reference || null,
        provider: "RELWORX",
      });

      return {
        success: true,
        message: relworxResponse.message || "Deposit initiated successfully",
        reference,
        internal_reference: relworxResponse.internal_reference || null,
        transactionId: transaction.id,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          notes: error instanceof Error ? error.message : "Deposit initiation failed",
        },
      });

      console.error("Relworx deposit initiation failed", {
        memberId,
        reference,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        error instanceof Error ? error.message : "Failed to initiate deposit",
      );
    }
  }

  public static async initiateLoanRepayment(
    memberId: string,
    loanId: string,
    phoneNumber: string,
    amount: number,
    description?: string,
  ): Promise<InitiationResult> {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    await assertMemberCanTransact(memberId);

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    const loan = await this.getLoanForMember(loanId, memberId);
    if (amount > loan.outstandingBalance + 0.01) {
      throw new Error(
        `Amount exceeds outstanding balance of UGX ${loan.outstandingBalance.toLocaleString()}`,
      );
    }

    const account = await this.getMemberSavingsAccount(memberId);
    const msisdn = this.normalizeMsisdn(phoneNumber || member.user.phone || "");
    if (!msisdn) {
      throw new Error("Phone number is required for mobile money repayment");
    }

    await this.enforceRateLimit(msisdn, TransactionType.LOAN_REPAYMENT);

    const reference = await this.generateUniqueReference("LOAN", loanId);
    const transaction = await this.createPendingTransaction({
      reference,
      memberId,
      accountId: account.id,
      loanId,
      amount,
      description: description || `Loan Repayment #${loanId}`,
      msisdn,
      type: TransactionType.LOAN_REPAYMENT,
      processedByUserId: member.userId,
    });

    try {
      const relworxResponse = await RelworxService.requestPayment({
        msisdn,
        amount,
        currency: this.CURRENCY,
        reference,
        description: description || `Loan Repayment #${loanId}`,
      });

      if (!relworxResponse.success) {
        throw new Error(relworxResponse.message || "Relworx rejected the request");
      }

      await this.updateTransactionWithRelworxMeta(transaction.id, {
        internalReference: relworxResponse.internal_reference || null,
        provider: "RELWORX",
      });

      return {
        success: true,
        message: relworxResponse.message || "Loan repayment initiated successfully",
        reference,
        internal_reference: relworxResponse.internal_reference || null,
        transactionId: transaction.id,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          notes:
            error instanceof Error
              ? error.message
              : "Loan repayment initiation failed",
        },
      });

      console.error("Relworx loan repayment initiation failed", {
        memberId,
        loanId,
        reference,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to initiate loan repayment",
      );
    }
  }

  public static async initiateWithdrawal(
    memberId: string,
    phoneNumber: string,
    amount: number,
    description?: string,
  ): Promise<InitiationResult> {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    await assertMemberCanTransact(memberId);

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    const account = await this.getMemberSavingsAccount(memberId);
    const msisdn = this.normalizeMsisdn(phoneNumber || member.user.phone || "");
    if (!msisdn) {
      throw new Error("Phone number is required for mobile money withdrawal");
    }

    const pendingWithdrawalTotal = await db.transaction.aggregate({
      where: {
        accountId: account.id,
        type: TransactionType.WITHDRAWAL,
        channel: "MOBILE_MONEY",
        status: TransactionStatus.PENDING,
      },
      _sum: {
        amount: true,
      },
    });

    const reserved = Number(pendingWithdrawalTotal._sum.amount || 0);
    const availableBalance = account.balance - reserved;

    if (availableBalance < amount) {
      throw new Error(
        `Insufficient balance. Available for withdrawal: UGX ${availableBalance.toLocaleString()}`,
      );
    }

    if (availableBalance - amount < (account.accountType.minBalance || 0)) {
      throw new Error(
        `Withdrawal would violate minimum balance requirement of UGX ${account.accountType.minBalance.toLocaleString()}`,
      );
    }

    const reference = await this.generateUniqueReference("WDR", memberId);
    const transaction = await this.createPendingTransaction({
      reference,
      memberId,
      accountId: account.id,
      amount,
      description: description || "SACCO Withdrawal",
      msisdn,
      type: TransactionType.WITHDRAWAL,
      processedByUserId: member.userId,
    });

    // Float check BEFORE calling send-payment — never attempt disbursement blind.
    try {
      const walletBalance = await RelworxService.checkWalletBalance(this.CURRENCY);
      if (!walletBalance.success) {
        throw new Error(walletBalance.message || "Could not verify mobile money float");
      }
      if (Number(walletBalance.balance ?? 0) < amount) {
        throw new Error(
          "SACCO mobile money float is insufficient for this withdrawal. Contact an administrator to top up.",
        );
      }
    } catch (error: any) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          notes: error instanceof Error ? error.message : "Float check failed before withdrawal",
        },
      });

      console.error("Relworx withdrawal float check failed", {
        memberId,
        reference,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        error instanceof Error ? error.message : "Could not verify mobile money float right now. Try again shortly.",
      );
    }

    try {
      const relworxResponse = await RelworxService.sendPayment({
        msisdn,
        amount,
        currency: this.CURRENCY,
        reference,
        description: description || "SACCO Withdrawal",
      });

      if (!relworxResponse.success) {
        throw new Error(relworxResponse.message || "Relworx rejected the request");
      }

      await this.updateTransactionWithRelworxMeta(transaction.id, {
        internalReference: relworxResponse.internal_reference || null,
        provider: "RELWORX",
      });

      return {
        success: true,
        message: relworxResponse.message || "Withdrawal initiated successfully",
        reference,
        internal_reference: relworxResponse.internal_reference || null,
        transactionId: transaction.id,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          notes:
            error instanceof Error
              ? error.message
              : "Withdrawal initiation failed",
        },
      });

      console.error("Relworx withdrawal initiation failed", {
        memberId,
        reference,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(
        error instanceof Error ? error.message : "Failed to initiate withdrawal",
      );
    }
  }

  public static async checkTransactionStatus(internalReference: string) {
    const statusResponse = await RelworxService.checkTransactionStatus(
      internalReference,
    );

    const result = await this.handleWebhook({
      status: statusResponse.status,
      message: statusResponse.message,
      customer_reference: statusResponse.customer_reference,
      internal_reference: statusResponse.internal_reference,
      msisdn: statusResponse.msisdn,
      amount: statusResponse.amount,
      currency: statusResponse.currency,
      provider: statusResponse.provider,
      charge: statusResponse.charge,
      provider_transaction_id: statusResponse.provider_transaction_id,
      completed_at: statusResponse.completed_at,
      reference: statusResponse.customer_reference,
    });

    return {
      success: true,
      status: statusResponse.status,
      relworx: statusResponse,
      processed: result,
    };
  }

  public static async handleWebhook(payload: RelworxWebhookPayload) {
    const customerReference =
      payload.customer_reference || payload.reference || null;
    const internalReference = payload.internal_reference || null;

    const transaction = await db.transaction.findFirst({
      where: {
        OR: [
          customerReference
            ? { transactionRef: customerReference }
            : undefined,
          internalReference ? { externalReference: internalReference } : undefined,
          internalReference ? { paymentReference: internalReference } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        account: {
          include: {
            accountType: true,
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        deposit: true,
        withdrawal: true,
      },
    });

    if (!transaction) {
      console.warn("Relworx webhook ignored - transaction not found", {
        customerReference,
        internalReference,
        status: payload.status,
      });
      return {
        ok: false,
        ignored: true,
        message: "Transaction not found",
      };
    }

    if (
      transaction.status === TransactionStatus.COMPLETED &&
      payload.status === "success"
    ) {
      return {
        ok: true,
        alreadyProcessed: true,
        transactionId: transaction.id,
      };
    }

    if (
      transaction.status === TransactionStatus.FAILED &&
      payload.status === "failed"
    ) {
      return {
        ok: true,
        alreadyProcessed: true,
        transactionId: transaction.id,
      };
    }

    if (payload.status === "pending" || !payload.status) {
      await this.updateTransactionWithRelworxMeta(transaction.id, {
        internalReference,
        provider: payload.provider || transaction.paymentMethod || "RELWORX",
        providerTransactionId: payload.provider_transaction_id || null,
        charge: payload.charge ?? undefined,
        completedAt: payload.completed_at || null,
        notes: payload.message || null,
        status: TransactionStatus.PENDING,
      });

      return {
        ok: true,
        transactionId: transaction.id,
        status: "pending",
      };
    }

    if (payload.status === "failed") {
      await db.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.FAILED,
            externalReference: internalReference || undefined,
            paymentReference: payload.provider_transaction_id || undefined,
            paymentMethod: payload.provider || transaction.paymentMethod || "RELWORX",
            fee: payload.charge ?? undefined,
            valueDate: payload.completed_at ? new Date(payload.completed_at) : undefined,
            notes: payload.message || undefined,
          },
        });
      });

      return {
        ok: true,
        transactionId: transaction.id,
        status: "failed",
      };
    }

    try {
      await db.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.COMPLETED,
            externalReference: internalReference || undefined,
            paymentReference: payload.provider_transaction_id || undefined,
            paymentMethod: payload.provider || transaction.paymentMethod || "RELWORX",
            fee: payload.charge ?? undefined,
            valueDate: payload.completed_at ? new Date(payload.completed_at) : new Date(),
            notes: payload.message || undefined,
          },
        });

        if (transaction.type === TransactionType.DEPOSIT) {
          await this.recordDepositCompletion(tx, transaction, payload);
        } else if (transaction.type === TransactionType.WITHDRAWAL) {
          await this.recordWithdrawalCompletion(tx, transaction, payload);
        } else if (transaction.type === TransactionType.LOAN_REPAYMENT) {
          await this.recordLoanRepaymentCompletion(tx, transaction, payload);
        }
      });

      return {
        ok: true,
        transactionId: transaction.id,
        status: "success",
      };
    } catch (error: any) {
      console.error("Relworx webhook processing failed", {
        transactionId: transaction.id,
        reference: transaction.transactionRef,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
