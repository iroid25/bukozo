import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { listAccountsForBalanceSheet } from "@/lib/reports/statement-of-comprehensive-balance-sheet";
import { listAccountsForIncomeExpense } from "@/lib/reports/income-expense-report";
import { db } from "@/prisma/db";
import { AccountStatus, TransactionType, TransactionStatus, UserRole } from "@prisma/client";
import { getMemberTransactEligibility } from "@/lib/member-transact-eligibility";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { CASH_AT_HAND_CODE, ensureAssetStructure } from "@/lib/services/asset-structure";
import { ensureEquityStructure } from "@/lib/services/equity-structure";

export const dynamic = "force-dynamic";

async function generateUniqueAccountNumber(): Promise<string> {
  let accountNumber = "";
  let isUnique = false;
  let attempts = 0;
  do {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    accountNumber = `ACC${timestamp}${random}`;
    const existing = await db.account.findUnique({ where: { accountNumber } });
    isUnique = !existing;
    attempts++;
  } while (!isUnique && attempts < 10);
  if (!isUnique) throw new Error("Unable to generate unique account number");
  return accountNumber;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statementType = new URL(request.url).searchParams.get("statement_type");
    const data =
      statementType === "INCOME_EXPENSE"
        ? await listAccountsForIncomeExpense(user)
        : await listAccountsForBalanceSheet(user);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Accounts lookup error:", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = {
      ...body,
      fixingStartDate: body.fixingStartDate ? new Date(body.fixingStartDate) : undefined,
      fixingEndDate: body.fixingEndDate ? new Date(body.fixingEndDate) : undefined,
      initialDeposit: body.initialDeposit !== undefined ? Number(body.initialDeposit) : 0,
      expectedInterest: body.expectedInterest !== undefined ? Number(body.expectedInterest) : undefined,
      sharesCount: body.sharesCount !== undefined ? Number(body.sharesCount) : undefined,
    };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!data.memberId && !data.institutionId) {
      return NextResponse.json({ error: "Either member or institution must be specified" }, { status: 400 });
    }
    if (data.memberId && data.institutionId) {
      return NextResponse.json({ error: "Account cannot be created for both member and institution" }, { status: 400 });
    }

    if (data.memberId) {
      const eligibility = await getMemberTransactEligibility(data.memberId);
      if (!eligibility.eligible) {
        return NextResponse.json({ error: eligibility.reason }, { status: 400 });
      }
    }

    if (data.institutionId) {
      const institution = await db.institution.findUnique({
        where: { id: data.institutionId },
        include: {
          user: true,
          signatories: { select: { id: true, status: true, signatureImage: true, phone: true } },
        },
      });
      if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
      if (!institution.isApproved) return NextResponse.json({ error: "Institution is not approved yet" }, { status: 400 });

      const hasRequiredContacts =
        !!institution.primaryContactPerson?.trim() &&
        !!institution.primaryContactPhone?.trim() &&
        !!institution.institutionPhone?.trim() &&
        !!institution.institutionEmail?.trim();
      const hasSignedDirector = institution.signatories.some(
        (s) => s.status === "ACTIVE" && !!s.signatureImage?.trim() && !!s.phone?.trim(),
      );
      if (!institution.user.isActive || !hasRequiredContacts || !hasSignedDirector) {
        return NextResponse.json(
          { error: "Institution profile is incomplete. Complete the contact details and director signatures before creating an account." },
          { status: 400 },
        );
      }
    }

    const accountType = await db.accountType.findUnique({ where: { id: data.accountTypeId } });
    if (!accountType) return NextResponse.json({ error: "Account type not found" }, { status: 404 });

    // Resolve branch — auto-fill from member's savings if not provided
    let finalBranchId = data.branchId;
    if (data.memberId) {
      const voluntarySavings = await db.account.findFirst({
        where: {
          memberId: data.memberId,
          accountType: { name: { in: ["Savings Account", "Voluntary Savings"] } },
          status: AccountStatus.ACTIVE,
        },
        select: { branchId: true },
      });
      if (voluntarySavings) finalBranchId = voluntarySavings.branchId;
    }
    if (!finalBranchId) return NextResponse.json({ error: "Branch not found or could not be determined" }, { status: 400 });
    const branch = await db.branch.findUnique({ where: { id: finalBranchId } });
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    // Duplicate account check
    const existingAccount = await db.account.findFirst({
      where: {
        ...(data.memberId ? { memberId: data.memberId } : {}),
        ...(data.institutionId ? { institutionId: data.institutionId } : {}),
        accountTypeId: data.accountTypeId,
        status: { not: AccountStatus.CLOSED },
      },
    });
    if (existingAccount && !accountType.isShareAccount && !accountType.hasFixedPeriod) {
      return NextResponse.json(
        {
          error: data.memberId
            ? "Member already has an active account of this type. Please use Deposit to add funds."
            : "Institution already has an active account of this type",
        },
        { status: 409 },
      );
    }

    const initialDeposit = data.initialDeposit ?? 0;
    if (initialDeposit < accountType.minBalance) {
      return NextResponse.json({ error: `Initial deposit must be at least ${accountType.minBalance}` }, { status: 400 });
    }

    // Float roles: only TELLER and AGENT hold a cash float; managers/admins do not
    const FLOAT_REQUIRED_ROLES = new Set<UserRole>([UserRole.TELLER, UserRole.AGENT]);
    const userIsFloatHolder = FLOAT_REQUIRED_ROLES.has(user.role as UserRole);

    // Float pre-check: teller/agent must have an active float session to receive a cash deposit
    // No balance minimum needed — receiving a deposit INCREASES the float (teller gets cash), not decreases it
    if ((data.memberId || data.institutionId) && initialDeposit > 0 && userIsFloatHolder) {
      const creatorFloat = await db.userFloat.findUnique({
        where: { userId: user.id },
        select: { id: true, balance: true, isActiveForDay: true },
      });
      if (!creatorFloat) {
        return NextResponse.json({ error: "You do not have an active float. Start your float session before creating accounts with deposits." }, { status: 400 });
      }
      if (!creatorFloat.isActiveForDay) {
        return NextResponse.json({ error: "Your float session is not active for today. Start your float session before proceeding." }, { status: 400 });
      }
    }

    // Fixed deposit: validate funding source
    let sourceAccount: any = null;
    if (accountType.hasFixedPeriod) {
      if (!data.fundingSourceAccountId) {
        return NextResponse.json({ error: "Funding source (Voluntary Savings) is required for Fixed Deposits" }, { status: 400 });
      }
      sourceAccount = await db.account.findUnique({
        where: { id: data.fundingSourceAccountId },
        include: { accountType: true },
      });
      if (!sourceAccount) return NextResponse.json({ error: "Selected funding source account not found" }, { status: 404 });
      if (sourceAccount.balance < initialDeposit) {
        return NextResponse.json({ error: `Insufficient funds in source account. Available: ${sourceAccount.balance}` }, { status: 400 });
      }
    }

    // Account number
    let accountNumber: string;
    let customNumberDetails = {};
    if (data.customAccountNumber) {
      const existing = await db.account.findUnique({ where: { accountNumber: data.customAccountNumber } });
      if (existing) return NextResponse.json({ error: `Account Number '${data.customAccountNumber}' already exists` }, { status: 409 });
      accountNumber = data.customAccountNumber;
      customNumberDetails = { isAutoGenerated: false, customNumberApprovedBy: user.id, customNumberApprovedAt: new Date() };
    } else {
      accountNumber = await generateUniqueAccountNumber();
    }

    // Pre-warm COA structure for share purchases (outside transaction to avoid deadlock)
    if (accountType.isShareAccount && initialDeposit > 0) {
      await Promise.all([ensureEquityStructure(), ensureAssetStructure()]);
    }

    // ── Main transaction ──────────────────────────────────────────────────────
    const account = await db.$transaction(async (tx) => {
      let targetAccount: any;

      if (existingAccount && accountType.isShareAccount) {
        // Top-up existing share account
        targetAccount = await tx.account.update({
          where: { id: existingAccount.id },
          data: {
            balance: { increment: initialDeposit },
            sharesCount: { increment: data.sharesCount || 0 },
          },
          include: { member: { include: { user: true } }, institution: { include: { user: true } }, accountType: true, branch: true },
        });

        if (initialDeposit > 0) {
          const txnRecord = await tx.transaction.create({
            data: {
              transactionRef: `DEP-SHARE-${Date.now()}`,
              type: TransactionType.DEPOSIT,
              amount: initialDeposit,
              status: TransactionStatus.COMPLETED,
              description: "Additional Share Purchase",
              transactionDate: new Date(),
              accountId: existingAccount.id,
              memberId: data.memberId ?? null,
              institutionId: data.institutionId ?? null,
              processedByUserId: user.id,
              branchId: finalBranchId,
              channel: "CASH",
            },
          });
          await tx.deposit.create({
            data: {
              transactionId: txnRecord.id,
              accountId: existingAccount.id,
              amount: initialDeposit,
              depositDate: new Date(),
              handlerUserId: user.id,
              channel: "CASH",
              depositorName: user.name ?? null,
              memberId: data.memberId ?? null,
              institutionId: data.institutionId ?? null,
              depositType: "DIRECT",
            },
          });
        }

        // Sync ShareAccount + ShareTransaction + GL
        if (data.memberId && initialDeposit > 0) {
          const sharePrice = Number(accountType.sharePrice || 10000);
          const additionalShares = Number(data.sharesCount || 0) ||
            Math.max(1, Math.round(initialDeposit / sharePrice));

          const existingShareAcct = await tx.shareAccount.findFirst({
            where: { memberId: data.memberId, accountTypeId: data.accountTypeId },
          });

          if (existingShareAcct) {
            const sharesBefore = Number(existingShareAcct.numberOfShares);
            await tx.shareAccount.update({
              where: { id: existingShareAcct.id },
              data: { numberOfShares: { increment: additionalShares }, totalValue: { increment: initialDeposit }, lastTransactionDate: new Date() },
            });
            await tx.shareTransaction.create({
              data: {
                accountId: existingShareAcct.id, transactionType: "PURCHASE",
                shares: additionalShares, shareValue: sharePrice, amount: initialDeposit,
                sharesBefore, sharesAfter: sharesBefore + additionalShares,
                reference: `SHR-ADD-${Date.now()}`, description: "Additional share purchase", tellerId: user.id,
              },
            });
          } else {
            const priorBalance = Number(existingAccount.balance);
            const priorShares = Number((existingAccount as any).sharesCount || 0);
            const newShareAcct = await tx.shareAccount.create({
              data: {
                accountNumber: existingAccount.accountNumber, memberId: data.memberId,
                accountTypeId: data.accountTypeId, branchId: finalBranchId,
                shareValue: sharePrice, totalValue: priorBalance + initialDeposit,
                numberOfShares: priorShares + additionalShares, lastTransactionDate: new Date(),
              },
            });
            await tx.shareTransaction.create({
              data: {
                accountId: newShareAcct.id, transactionType: "PURCHASE",
                shares: additionalShares, shareValue: sharePrice, amount: initialDeposit,
                sharesBefore: priorShares, sharesAfter: priorShares + additionalShares,
                reference: `SHR-ADD-${Date.now()}`, description: "Additional share purchase", tellerId: user.id,
              },
            });
          }

          // GL double-entry
          const [shareCapAcct, cashAcct] = await Promise.all([
            tx.chartOfAccount.findUnique({ where: { accountCode: "304000" } }),
            tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } }),
          ]);
          if (shareCapAcct && cashAcct) {
            const glRef = `SHR-GL-ADD-${Date.now()}`;
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: cashAcct.id, debitAmount: initialDeposit, creditAmount: 0, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${existingAccount.accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: shareCapAcct.id, debitAmount: 0, creditAmount: initialDeposit, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${existingAccount.accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.chartOfAccount.update({ where: { id: cashAcct.id }, data: buildAccountBalanceUpdate(cashAcct, { debitAmount: initialDeposit }) });
            await tx.chartOfAccount.update({ where: { id: shareCapAcct.id }, data: buildAccountBalanceUpdate(shareCapAcct, { creditAmount: initialDeposit }) });
          }
        }
      } else {
        // Create new account
        targetAccount = await tx.account.create({
          data: {
            accountNumber,
            ...customNumberDetails,
            ...(data.memberId ? { memberId: data.memberId } : {}),
            ...(data.institutionId ? { institutionId: data.institutionId } : {}),
            accountTypeId: data.accountTypeId,
            branchId: finalBranchId,
            balance: initialDeposit,
            status: AccountStatus.ACTIVE,
            openedAt: new Date(),
            initialDepositReceiptNo: data.initialDepositReceiptNo ?? null,
            sharesCount: data.sharesCount ?? null,
            fixingStartDate: data.fixingStartDate ?? null,
            fixingEndDate: data.fixingEndDate ?? null,
            expectedInterest: data.expectedInterest ?? null,
            fundingSourceAccountId: data.fundingSourceAccountId ?? null,
          },
          include: { member: { include: { user: true } }, institution: { include: { user: true } }, accountType: true, branch: true },
        });

        // Share account: create ShareAccount + ShareTransaction + GL entry
        if (accountType.isShareAccount && data.memberId && initialDeposit > 0) {
          const sharePrice = Number(accountType.sharePrice || 10000);
          const sharesCount = Number(data.sharesCount || 0) ||
            Math.max(1, Math.round(initialDeposit / sharePrice));
          const newShareAcct = await tx.shareAccount.create({
            data: {
              accountNumber, memberId: data.memberId, accountTypeId: data.accountTypeId,
              branchId: finalBranchId, shareValue: sharePrice,
              totalValue: initialDeposit, numberOfShares: sharesCount, lastTransactionDate: new Date(),
            },
          });
          await tx.shareTransaction.create({
            data: {
              accountId: newShareAcct.id, transactionType: "PURCHASE",
              shares: sharesCount, shareValue: sharePrice, amount: initialDeposit,
              sharesBefore: 0, sharesAfter: sharesCount,
              reference: `SHR-OPEN-${Date.now()}`, description: "Initial share purchase", tellerId: user.id,
            },
          });
          const [shareCapAcct, cashAcct] = await Promise.all([
            tx.chartOfAccount.findUnique({ where: { accountCode: "304000" } }),
            tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } }),
          ]);
          if (shareCapAcct && cashAcct) {
            const glRef = `SHR-GL-OPEN-${Date.now()}`;
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: cashAcct.id, debitAmount: initialDeposit, creditAmount: 0, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: shareCapAcct.id, debitAmount: 0, creditAmount: initialDeposit, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.chartOfAccount.update({ where: { id: cashAcct.id }, data: buildAccountBalanceUpdate(cashAcct, { debitAmount: initialDeposit }) });
            await tx.chartOfAccount.update({ where: { id: shareCapAcct.id }, data: buildAccountBalanceUpdate(shareCapAcct, { creditAmount: initialDeposit }) });
          }
        }

        // Institution share account: GL entry + Transaction audit (ShareAccount requires memberId)
        if (accountType.isShareAccount && data.institutionId && initialDeposit > 0) {
          const txnRecord = await tx.transaction.create({
            data: {
              transactionRef: `SHR-PUR-INST-${Date.now()}`,
              type: TransactionType.SHARES_PURCHASE,
              amount: initialDeposit,
              status: TransactionStatus.COMPLETED,
              description: "Institution Share Purchase",
              transactionDate: new Date(),
              accountId: targetAccount.id,
              institutionId: data.institutionId,
              processedByUserId: user.id,
              branchId: finalBranchId,
              channel: "CASH",
            },
          });
          await tx.deposit.create({
            data: {
              transactionId: txnRecord.id,
              accountId: targetAccount.id,
              amount: initialDeposit,
              depositDate: new Date(),
              handlerUserId: user.id,
              channel: "CASH",
              depositorName: null,
              institutionId: data.institutionId,
              depositType: "DIRECT",
            },
          });

          const [shareCapAcct, cashAcct] = await Promise.all([
            tx.chartOfAccount.findUnique({ where: { accountCode: "304000" } }),
            tx.chartOfAccount.findFirst({ where: { accountCode: CASH_AT_HAND_CODE, isActive: true } }),
          ]);
          if (shareCapAcct && cashAcct) {
            const glRef = `SHR-GL-OPEN-INST-${Date.now()}`;
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: cashAcct.id, debitAmount: initialDeposit, creditAmount: 0, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.journalEntry.create({ data: { entryNumber: glRef, accountId: shareCapAcct.id, debitAmount: 0, creditAmount: initialDeposit, entryDate: new Date(), branchId: finalBranchId, description: `Share purchase - ${accountNumber}`, reference: glRef, createdByUserId: user.id } });
            await tx.chartOfAccount.update({ where: { id: cashAcct.id }, data: buildAccountBalanceUpdate(cashAcct, { debitAmount: initialDeposit }) });
            await tx.chartOfAccount.update({ where: { id: shareCapAcct.id }, data: buildAccountBalanceUpdate(shareCapAcct, { creditAmount: initialDeposit }) });
          }
        }

        // Fixed deposit: debit source account
        if (sourceAccount && initialDeposit > 0) {
          await tx.account.update({ where: { id: sourceAccount.id }, data: { balance: { decrement: initialDeposit } } });
          const transactionRef = `TRF-FD-${Date.now()}`;
          const txnRecord = await tx.transaction.create({
            data: {
              transactionRef, type: TransactionType.TRANSFER, amount: initialDeposit,
              status: TransactionStatus.COMPLETED,
              description: `Initial funding for Fixed Deposit ${accountNumber} from ${sourceAccount.accountNumber}`,
              transactionDate: new Date(), accountId: targetAccount.id,
              memberId: data.memberId ?? null, institutionId: data.institutionId ?? null,
              processedByUserId: user.id, branchId: finalBranchId,
            },
          });
          await tx.deposit.create({
            data: {
              transactionId: txnRecord.id, accountId: targetAccount.id,
              amount: initialDeposit, depositDate: new Date(),
              handlerUserId: user.id, channel: "INTERNAL_TRANSFER",
              depositorName: user.name ?? null,
              memberId: data.memberId ?? null, institutionId: data.institutionId ?? null,
            },
          });
        }

        // Regular savings: opening deposit Transaction + SavingsTransaction
        if (!accountType.isShareAccount && !accountType.hasFixedPeriod && initialDeposit > 0) {
          const txnRecord = await tx.transaction.create({
            data: {
              transactionRef: `DEP-OPEN-${Date.now()}`,
              type: TransactionType.DEPOSIT, amount: initialDeposit,
              status: TransactionStatus.COMPLETED, description: "Opening Deposit",
              paymentReference: data.initialDepositReceiptNo ?? null,
              transactionDate: targetAccount.openedAt,
              accountId: targetAccount.id, memberId: data.memberId ?? null,
              processedByUserId: user.id, branchId: finalBranchId, channel: "CASH",
            },
          });
          await tx.deposit.create({
            data: {
              transactionId: txnRecord.id, accountId: targetAccount.id,
              memberId: data.memberId ?? null, amount: initialDeposit,
              depositDate: targetAccount.openedAt, handlerUserId: user.id,
              channel: "CASH", depositorName: user.name ?? null, depositType: "DIRECT",
            },
          });
          const savingsAccount = await tx.savingsAccount.findUnique({
            where: { accountNumber: targetAccount.accountNumber },
            select: { id: true },
          });
          if (savingsAccount) {
            await tx.savingsTransaction.create({
              data: {
                accountId: savingsAccount.id, transactionType: "DEPOSIT",
                amount: initialDeposit, balanceBefore: 0, balanceAfter: initialDeposit,
                transactionDate: targetAccount.openedAt,
                reference: `DEP-OPEN-${txnRecord.id}`, description: "Opening Deposit",
                tellerId: user.id,
              },
            });
          }
        }
      }

      // Float credit for cash opening deposit — teller RECEIVES cash, float goes UP
      // Skipped for ADMIN/BRANCHMANAGER/ACCOUNTANT/LOANOFFICER who do not hold a float
      if ((data.memberId || data.institutionId) && initialDeposit > 0 && userIsFloatHolder) {
        const creatorFloat = await tx.userFloat.findUnique({ where: { userId: user.id } });
        if (!creatorFloat) throw new Error("You do not have an active float.");
        if (!creatorFloat.isActiveForDay) throw new Error("Your float session is not active for today.");
        await tx.userFloat.update({ where: { id: creatorFloat.id }, data: { balance: { increment: initialDeposit } } });
        await tx.floatTransaction.create({
          data: {
            floatId: creatorFloat.id, type: TransactionType.DEPOSIT, amount: initialDeposit,
            description: `Cash received for account opening deposit — ${targetAccount.accountNumber}`,
            performedByUserId: user.id,
          },
        });
      }

      return targetAccount;
    });

    // Biometric linking
    if (data.memberId && data.fingerprintTemplate) {
      await db.member.update({
        where: { id: data.memberId },
        data: { fingerprintTemplate: normalizeFingerprintTemplate(data.fingerprintTemplate) },
      });
    }

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error: any) {
    console.error("Account creation error:", error);
    const message = error?.message ?? "Failed to create account";
    const status = message.includes("float") || message.includes("Insufficient") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
