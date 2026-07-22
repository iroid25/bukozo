import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";
import { WRITTEN_OFF_LOANS_CODE, ensureExpenditureStructure } from "@/lib/services/expenditure-structure";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    if (!["BRANCHMANAGER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Only managers can approve write-off requests" }, { status: 403 });
    }

    const { id: writeOffId } = await params;
    const { targetAccountId } = await request.json().catch(() => ({}));

    const writeOff = await db.loanWriteOff.findUnique({
      where: { id: writeOffId },
      include: {
        loan: {
          include: {
            member: { include: { user: true, accounts: true } },
            loanApplication: { include: { loanProduct: { include: { ledgerAccount: true } } } },
          },
        },
        institutionLoan: {
          include: {
            institution: { include: { user: true, accounts: true } },
            application: { include: { loanProduct: { include: { ledgerAccount: true } } } },
          },
        },
        requestedBy: true,
      },
    });

    if (!writeOff) return NextResponse.json({ success: false, error: "Write-off request not found" }, { status: 404 });
    if (writeOff.status !== "PENDING") return NextResponse.json({ success: false, error: "This write-off has already been processed" }, { status: 400 });

    const isInstitution = !!writeOff.institutionLoan;
    const ownerAccounts = isInstitution
      ? writeOff.institutionLoan!.institution.accounts
      : writeOff.loan!.member.accounts;
    const ownerName = isInstitution
      ? writeOff.institutionLoan!.institution.institutionName
      : writeOff.loan!.member.user.name;
    const branchId = isInstitution
      ? writeOff.institutionLoan!.institution.user.branchId || undefined
      : writeOff.loan!.branchId || undefined;

    let accountIdToUse = targetAccountId;
    if (accountIdToUse) {
      const accountExists = ownerAccounts.find((a: any) => a.id === accountIdToUse);
      if (!accountExists) return NextResponse.json({ success: false, error: "Selected account does not belong to the borrower" }, { status: 400 });
    } else if (ownerAccounts.length > 0) {
      accountIdToUse = ownerAccounts[0].id;
    }

    await ensureExpenditureStructure();

    await db.$transaction(async (tx) => {
      await tx.loanWriteOff.update({
        where: { id: writeOffId },
        data: { status: "APPROVED", approvedByUserId: user.id, approvedAt: new Date(), dateWrittenOff: new Date() },
      });

      if (isInstitution) {
        await tx.institutionLoan.update({ where: { id: writeOff.institutionLoanId! }, data: { status: "WRITTEN_OFF", outstandingBalance: 0 } });
        await tx.institutionLoanRepaymentSchedule.updateMany({
          where: { loanId: writeOff.institutionLoanId!, status: { not: "PAID" } },
          data: { status: "WRITTEN_OFF" },
        });
      } else {
        await tx.loan.update({ where: { id: writeOff.loanId! }, data: { status: "WRITTEN_OFF", outstandingBalance: 0 } });
        // Mark all remaining non-PAID repayment schedules as WRITTEN_OFF
        await tx.loanRepaymentSchedule.updateMany({
          where: { loanId: writeOff.loanId!, status: { not: "PAID" } },
          data: { status: "WRITTEN_OFF" },
        });
      }

      if (accountIdToUse) {
        await tx.transaction.create({
          data: {
            transactionRef: `WO-${writeOffId.slice(0, 8)}`,
            memberId: isInstitution ? undefined : writeOff.loan!.memberId,
            institutionId: isInstitution ? writeOff.institutionLoan!.institutionId : undefined,
            accountId: accountIdToUse, type: "OTHER", amount: writeOff.totalBalance,
            status: "COMPLETED", description: `Loan write-off approved - ${writeOff.reason}`,
            transactionDate: new Date(), processedByUserId: user.id, channel: "WRITE_OFF",
            loanId: isInstitution ? writeOff.institutionLoanId! : writeOff.loanId!,
          },
        });
      }

      // GL journal entry: Dr Bad Debt Expense (Written Off Loans), Cr Loan Receivable
      // Prefer the loan's own product ledger account (its specific sub-portfolio)
      // and only fall back to a generic 107-prefix match if the product has no
      // ledger account configured, so we don't misbook against another product's
      // sub-portfolio.
      const productLedgerAccount = isInstitution
        ? writeOff.institutionLoan?.application?.loanProduct?.ledgerAccount
        : writeOff.loan?.loanApplication?.loanProduct?.ledgerAccount;
      const [loanPortfolioFallback, badDebtExpense] = await Promise.all([
        productLedgerAccount && productLedgerAccount.isActive
          ? Promise.resolve(null)
          : tx.chartOfAccount.findFirst({
              where: { accountCode: { startsWith: "107" }, isActive: true },
            }),
        tx.chartOfAccount.findFirst({
          where: { accountCode: WRITTEN_OFF_LOANS_CODE, isActive: true },
        }),
      ]);
      const loanPortfolio =
        productLedgerAccount && productLedgerAccount.isActive
          ? productLedgerAccount
          : loanPortfolioFallback;

      if (loanPortfolio && badDebtExpense && writeOff.totalBalance > 0) {
        const entryNumber = `JE-WO-${Date.now()}`;

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: badDebtExpense.id,
            debitAmount: writeOff.totalBalance,
            creditAmount: 0,
            description: `Loan write-off - ${writeOff.reason}`,
            entryDate: new Date(),
            reference: `WO-${writeOffId.slice(0, 8)}`,
            branchId,
            createdByUserId: user.id,
          },
        });

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: loanPortfolio.id,
            debitAmount: 0,
            creditAmount: writeOff.totalBalance,
            description: `Loan write-off - ${writeOff.reason}`,
            entryDate: new Date(),
            reference: `WO-${writeOffId.slice(0, 8)}`,
            branchId,
            createdByUserId: user.id,
          },
        });

        await tx.chartOfAccount.update({
          where: { id: badDebtExpense.id },
          data: buildAccountBalanceUpdate(badDebtExpense, { debitAmount: writeOff.totalBalance }),
        });

        await tx.chartOfAccount.update({
          where: { id: loanPortfolio.id },
          data: buildAccountBalanceUpdate(loanPortfolio, { creditAmount: writeOff.totalBalance }),
        });
      }
    });

    await db.notification.create({
      data: {
        userId: writeOff.requestedByUserId, type: "IN_APP", subject: "Write-Off Request Approved",
        message: `Your write-off request for ${ownerName}'s loan has been approved by ${user.name}`,
        targetAddress: `/dashboard/loan-write-offs`, sentAt: new Date(), isRead: false, status: "SENT",
      },
    });

    return NextResponse.json({ success: true, message: "Write-off approved successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
