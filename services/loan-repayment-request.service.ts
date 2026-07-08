// services/loan-repayment-request.service.ts
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { LoanService } from "./loan.service";
import {
  createNativeInstitutionLoanRepaymentLedgerEntries,
  createNativeLoanRepaymentLedgerEntries,
} from "@/lib/services/loan-ledger";
import { createSplitLoanRepaymentJournalEntry } from "@/lib/journal-entries-extended";

export class LoanRepaymentRequestService {
  static async processRepaymentTransaction(
    requestId: string,
    userId: string,
    loanId: string | undefined,
    memberId: string | undefined,
    accountId: string,
    amount: number,
    loan: any,
    isAutoApproval: boolean = false,
    breakdown?: {
      interestAmount?: number;
      penaltyAmount?: number;
      principalAmount?: number;
    },
    institutionLoanId?: string,
    institutionId?: string,
  ) {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("en-UG", {
        style: "currency",
        currency: "UGX",
        minimumFractionDigits: 0,
      }).format(amount);

    const isInstitution = !!institutionLoanId;

    return await db.$transaction(async (tx) => {
      // 1. Initial Validation inside transaction
      let currentLoan;
      if (isInstitution) {
        currentLoan = await tx.institutionLoan.findUnique({
          where: { id: institutionLoanId },
          select: {
            outstandingBalance: true,
            amountPaid: true,
            status: true,
            institutionId: true,
          },
        });
      } else {
        currentLoan = await tx.loan.findUnique({
          where: { id: loanId as string },
          select: {
            outstandingBalance: true,
            amountPaid: true,
            status: true,
            memberId: true,
          },
        });
      }

      const currentAccount = await tx.account.findUnique({
        where: { id: accountId },
        select: { balance: true },
      });

      if (!currentLoan) throw new Error("Loan not found during processing");
      if (!currentAccount)
        throw new Error("Account not found during processing");

      if (amount > Number((currentLoan.outstandingBalance + 0.1).toFixed(2))) {
        throw new Error(
          `Amount (${formatCurrency(amount)}) exceeds outstanding balance (${formatCurrency(currentLoan.outstandingBalance)})`,
        );
      }

      if (amount > currentAccount.balance) {
        throw new Error(
          `Insufficient funds. Available: ${formatCurrency(currentAccount.balance)}, Required: ${formatCurrency(amount)}`,
        );
      }

      // 1. Update Request Status
      await tx.loanRepaymentRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      // 1.5 Calculate Split Breakdown
      const {
        interest: interestAmount,
        penalty: penaltyAmount,
        principal: principalAmount,
      } = await LoanService.calculateRepaymentSplit(loan, amount, breakdown);

      // 2. Create Repayment Record
      let repayment;
      if (isInstitution) {
        repayment = await tx.institutionLoanRepayment.create({
          data: {
            loanId: institutionLoanId as string,
            institutionId: institutionId as string,
            amount,
            repaymentDate: new Date(),
            channel: "AUTOMATIC_DEDUCTION",
            mobileMoneyRef: `REQ-${requestId.slice(0, 8)}`,
            interestPaid: interestAmount,
            principalPaid: principalAmount,
            description: `Automatic internal deduction from institution account`,
          },
        });
      } else {
        repayment = await tx.loanRepayment.create({
          data: {
            loanId: loanId as string,
            memberId: memberId as string,
            amount,
            repaymentDate: new Date(),
            handlerUserId: userId,
            channel: "AUTOMATIC_DEDUCTION",
            mobileMoneyRef: `REQ-${requestId.slice(0, 8)}`,
            interestPaid: interestAmount,
            penaltyPaid: penaltyAmount,
            principalPaid: principalAmount,
          },
        });
      }

      // 3. Update Loan Balance
      const newOutstanding = currentLoan.outstandingBalance - amount;
      const newPaid = currentLoan.amountPaid + amount;

      if (isInstitution) {
        await tx.institutionLoan.update({
          where: { id: institutionLoanId as string },
          data: {
            outstandingBalance: Math.max(0, newOutstanding),
            amountPaid: newPaid,
            interestPaid: { increment: interestAmount },
            penaltyPaid: { increment: penaltyAmount },
            principalPaid: { increment: principalAmount },
            status: newOutstanding <= 0 ? "REPAID" : currentLoan.status,
          },
        });
      } else {
        await tx.loan.update({
          where: { id: loanId as string },
          data: {
            outstandingBalance: Math.max(0, newOutstanding),
            amountPaid: newPaid,
            interestPaid: { increment: interestAmount },
            penaltyPaid: { increment: penaltyAmount },
            principalPaid: { increment: principalAmount },
            status: newOutstanding <= 0 ? "REPAID" : currentLoan.status,
          },
        });
      }

      // 4. Deduct from Account
      await tx.account.update({
        where: { id: accountId },
        data: {
          balance: { decrement: amount },
        },
      });

      // 5. Create Transaction Record
      const product = isInstitution
        ? loan.application?.loanProduct || loan.loanProduct
        : loan.loanApplication?.loanProduct || loan.loanProduct;
      const userName = isInstitution
        ? loan.institution?.institutionName || "Institution"
        : loan.member?.user?.name || "Member";

      if (!product)
        throw new Error(
          "Loan product consistency error: No product associated with this loan.",
        );

      await tx.transaction.create({
        data: {
          transactionRef: `LR-AUTO-${repayment.id}`,
          memberId: isInstitution ? undefined : memberId,
          institutionId: isInstitution ? institutionId : undefined,
          accountId,
          type: "LOAN_REPAYMENT",
          amount,
          status: "COMPLETED",
          description: `Automatic loan repayment - ${product.name} (P: ${formatCurrency(principalAmount)}, I: ${formatCurrency(interestAmount)}, Pen: ${formatCurrency(penaltyAmount)})`,
          transactionDate: new Date(),
          processedByUserId: userId,
          channel: "AUTOMATIC_DEDUCTION",
          loanId: isInstitution ? institutionLoanId : loanId,
        },
      });

      // 6. Create native loan ledger transactions
      if (isInstitution) {
        await createNativeInstitutionLoanRepaymentLedgerEntries(tx, {
          loanId: institutionLoanId as string,
          transactionDate: repayment.repaymentDate,
          voucherNo: repayment.id.substring(0, 8).toUpperCase(),
          principalAmount,
          interestAmount,
          penaltyAmount,
          initialPrincipalBalance: loan.amountGranted,
          initialInterestBalance:
            (loan.totalAmountDue || 0) - (loan.amountGranted || 0),
        });
      } else {
        await createNativeLoanRepaymentLedgerEntries(tx, {
          loanId: loanId as string,
          transactionDate: repayment.repaymentDate,
          voucherNo: repayment.id.substring(0, 8).toUpperCase(),
          principalAmount,
          interestAmount,
          penaltyAmount,
          initialPrincipalBalance: loan.amountGranted,
          initialInterestBalance: loan.interestAmount || 0,
        });
      }

      // 6.5 Record Interest as Income
      if (interestAmount > 0) {
        let loanParentCategory = await tx.budgetCategory.upsert({
          where: { code: "401000" },
          update: { name: "Loan related income" },
          create: {
            name: "Loan related income",
            code: "401000",
            kind: "INCOME",
            description:
              "Loan related income including fees, interest and penalties",
            isActive: true,
          },
        });

        // ✅ Standardized: Use code 401001 (under 401000 parent)
        let interestCategory = await tx.budgetCategory.upsert({
          where: { code: "401001" },
          update: {
            parentId: loanParentCategory.id,
            name: "Interest paid",
            kind: "INCOME",
          },
          create: {
            name: "Interest paid",
            code: "401001",
            kind: "INCOME",
            description: "Interest earned from loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: interestCategory.id,
            amount: interestAmount,
            date: new Date(),
            recordDate: new Date(),
            description: `Loan Interest (Internal) - ${userName} - ${loanId?.slice(0, 8) || institutionLoanId?.slice(0, 8)}`,
            receivedByUserId: userId,
            branchId: isInstitution
              ? loan.institution?.branchId || loan.branchId
              : loan.branchId || loan.member?.branchId,
            memberId: isInstitution ? undefined : memberId,
            status: "COMPLETED",
            paymentMethod: "CASH",
            referenceNumber: `INT-${repayment.id.substring(0, 8).toUpperCase()}`,
            notes: isInstitution
              ? `Automated entry from institution loan repayment. Institution: ${institutionId}`
              : `Automated entry from internal loan repayment.`,
          },
        });
      }

      // 6.6 Record Penalty as Income
      if (penaltyAmount > 0) {
        let loanParentCategory = await tx.budgetCategory.upsert({
          where: { code: "401000" },
          update: { name: "Loan related income" },
          create: {
            name: "Loan related income",
            code: "401000",
            kind: "INCOME",
            description: "Loan related income including fees and penalties",
            isActive: true,
          },
        });

        // ✅ Standardized: Use code instead of compound key
        let penaltyCategory = await tx.budgetCategory.upsert({
          where: { code: "401005" },
          update: {
            parentId: loanParentCategory.id,
            name: "Loan penalty paid",
            kind: "INCOME",
          },
          create: {
            name: "Loan penalty paid",
            code: "401005",
            kind: "INCOME",
            description: "Penalties paid on overdue loans",
            isActive: true,
            parentId: loanParentCategory.id,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: penaltyCategory.id,
            amount: penaltyAmount,
            date: new Date(),
            recordDate: new Date(),
            description: `Loan Penalty Paid - ${userName} - ${loanId?.slice(0, 8) || institutionLoanId?.slice(0, 8)}`,
            receivedByUserId: userId,
            branchId: isInstitution
              ? loan.institution?.branchId || loan.branchId
              : loan.branchId || loan.member?.branchId,
            memberId: isInstitution ? undefined : memberId,
            status: "COMPLETED",
            paymentMethod: "CASH",
            referenceNumber: `PEN-${repayment.id.substring(0, 8).toUpperCase()}`,
            notes: isInstitution
              ? `Automated penalty income from institution loan repayment. Institution: ${institutionId}`
              : `Automated penalty income from internal loan repayment.`,
          },
        });
      }

      // 7. Create Split Journal Entry
      await createSplitLoanRepaymentJournalEntry(
        {
          principalAmount: principalAmount,
          interestAmount: interestAmount,
          penaltyAmount: penaltyAmount,
          description: `Loan Repayment (Internal) - ${userName} - ${loanId?.slice(0, 8) || institutionLoanId?.slice(0, 8)}`,
          reference: repayment.id.substring(0, 8).toUpperCase(),
          transactionId: isInstitution
            ? (institutionLoanId as string)
            : (loanId as string),
          userId: userId,
          entryDate: new Date(),
          branchId: loan.branchId,
          debitAccountCode: "201001", // Member Savings Control Account
          ledgerAccountId: product.ledgerAccountId || undefined,
          interestAccountId: product.interestAccountId || undefined,
          penaltyAccountId: product.penaltyAccountId || undefined,
        },
        tx,
      );

      // 8. Notification
      if (!isInstitution && loan.member?.user?.id) {
        const message = isAutoApproval
          ? `Money has been transferred from your savings account to your loan account.`
          : `Your loan repayment of ${formatCurrency(amount)} has been processed successfully.`;

        await tx.notification.create({
          data: {
            userId: loan.member.user.id,
            type: "IN_APP",
            subject: isAutoApproval
              ? "Loan Repayment Transfer"
              : "Loan Repayment Processed",
            message,
            targetAddress: `/dashboard/my-loans`,
            sentAt: new Date(),
            isRead: false,
            status: "SENT",
          },
        });
      }

      return { repayment, newOutstanding };
    });
  }
}
