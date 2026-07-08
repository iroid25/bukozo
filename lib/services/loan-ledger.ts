import { Prisma } from "@prisma/client";
import { db } from "@/prisma/db";

type LedgerClient = Prisma.TransactionClient;

type RepaymentLedgerInput = {
  loanId: string;
  transactionDate: Date;
  voucherNo: string;
  principalAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  initialPrincipalBalance: number;
  initialInterestBalance: number;
};

type InstitutionRepaymentLedgerInput = RepaymentLedgerInput;

function num(value: number | null | undefined) {
  return Number(value || 0);
}

export async function createNativeLoanRepaymentLedgerEntries(
  tx: LedgerClient,
  input: RepaymentLedgerInput,
) {
  const {
    loanId,
    transactionDate,
    voucherNo,
    principalAmount,
    interestAmount,
    penaltyAmount,
    initialPrincipalBalance,
    initialInterestBalance,
  } = input;

  const lastLedger = await tx.loanLedgerTransaction.findFirst({
    where: { loanId },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });

  let runningPrincipalBalance = lastLedger
    ? num(lastLedger.balancePrincipal)
    : num(initialPrincipalBalance);
  let runningInterestBalance = lastLedger
    ? num(lastLedger.balanceInterest)
    : num(initialInterestBalance);

  if (principalAmount > 0 || interestAmount > 0) {
    runningPrincipalBalance = Math.max(
      0,
      runningPrincipalBalance - num(principalAmount),
    );
    runningInterestBalance = Math.max(
      0,
      runningInterestBalance - num(interestAmount),
    );

    await tx.loanLedgerTransaction.create({
      data: {
        loanId,
        transactionType: "REPAYMENT",
        transactionDate,
        voucherNo,
        debitPrincipal: 0,
        debitInterest: 0,
        creditPrincipal: num(principalAmount),
        creditInterest: num(interestAmount),
        balancePrincipal: runningPrincipalBalance,
        balanceInterest: runningInterestBalance,
        balanceTotal: runningPrincipalBalance + runningInterestBalance,
      },
    });
  }

  if (penaltyAmount > 0) {
    runningInterestBalance = Math.max(
      0,
      runningInterestBalance - num(penaltyAmount),
    );

    await tx.loanLedgerTransaction.create({
      data: {
        loanId,
        transactionType: "PENALTY_PAYMENT",
        transactionDate: new Date(transactionDate.getTime() + 1000),
        voucherNo: `${voucherNo}-PEN`,
        debitPrincipal: 0,
        debitInterest: 0,
        creditPrincipal: 0,
        // Penalty is stored as a dedicated ledger movement but still reduces the
        // interest/penalty balance bucket used by the existing ledger schema.
        creditInterest: num(penaltyAmount),
        balancePrincipal: runningPrincipalBalance,
        balanceInterest: runningInterestBalance,
        balanceTotal: runningPrincipalBalance + runningInterestBalance,
      },
    });
  }

  return {
    balancePrincipal: runningPrincipalBalance,
    balanceInterest: runningInterestBalance,
    balanceTotal: runningPrincipalBalance + runningInterestBalance,
  };
}

export async function createNativeInstitutionLoanRepaymentLedgerEntries(
  tx: LedgerClient,
  input: InstitutionRepaymentLedgerInput,
) {
  const {
    loanId,
    transactionDate,
    voucherNo,
    principalAmount,
    interestAmount,
    penaltyAmount,
    initialPrincipalBalance,
    initialInterestBalance,
  } = input;

  const lastLedger = await tx.institutionLoanLedgerTransaction.findFirst({
    where: { loanId },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });

  let runningPrincipalBalance = lastLedger
    ? num(lastLedger.balancePrincipal)
    : num(initialPrincipalBalance);
  let runningInterestBalance = lastLedger
    ? num(lastLedger.balanceInterest)
    : num(initialInterestBalance);

  if (principalAmount > 0 || interestAmount > 0) {
    runningPrincipalBalance = Math.max(
      0,
      runningPrincipalBalance - num(principalAmount),
    );
    runningInterestBalance = Math.max(
      0,
      runningInterestBalance - num(interestAmount),
    );

    await tx.institutionLoanLedgerTransaction.create({
      data: {
        loanId,
        transactionType: "REPAYMENT",
        transactionDate,
        voucherNo,
        debitPrincipal: 0,
        debitInterest: 0,
        creditPrincipal: num(principalAmount),
        creditInterest: num(interestAmount),
        balancePrincipal: runningPrincipalBalance,
        balanceInterest: runningInterestBalance,
        balanceTotal: runningPrincipalBalance + runningInterestBalance,
      },
    });
  }

  if (penaltyAmount > 0) {
    runningInterestBalance = Math.max(
      0,
      runningInterestBalance - num(penaltyAmount),
    );

    await tx.institutionLoanLedgerTransaction.create({
      data: {
        loanId,
        transactionType: "PENALTY_PAYMENT",
        transactionDate: new Date(transactionDate.getTime() + 1000),
        voucherNo: `${voucherNo}-PEN`,
        debitPrincipal: 0,
        debitInterest: 0,
        creditPrincipal: 0,
        creditInterest: num(penaltyAmount),
        balancePrincipal: runningPrincipalBalance,
        balanceInterest: runningInterestBalance,
        balanceTotal: runningPrincipalBalance + runningInterestBalance,
      },
    });
  }

  return {
    balancePrincipal: runningPrincipalBalance,
    balanceInterest: runningInterestBalance,
    balanceTotal: runningPrincipalBalance + runningInterestBalance,
  };
}

function repaymentVoucherFromId(id: string) {
  return id.substring(0, 8).toUpperCase();
}

export async function getLoanLedgerPenaltySyncSnapshot() {
  const repayments = await db.loanRepayment.findMany({
    where: { penaltyPaid: { gt: 0 } },
    select: {
      id: true,
      loanId: true,
      penaltyPaid: true,
      repaymentDate: true,
      loan: {
        select: {
          member: {
            select: {
              memberNumber: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { repaymentDate: "desc" },
  });

  const repaymentIds = repayments.map((repayment) => repayment.loanId);
  const ledgerEntries =
    repaymentIds.length > 0
      ? await db.loanLedgerTransaction.findMany({
          where: {
            loanId: { in: repaymentIds },
            transactionType: "PENALTY_PAYMENT",
          },
          select: {
            id: true,
            loanId: true,
            voucherNo: true,
            creditInterest: true,
          },
        })
      : [];

  const penaltyLedgerByVoucher = new Set(
    ledgerEntries.map((entry) => entry.voucherNo?.replace(/-PEN$/, "")).filter(Boolean),
  );

  const missing = repayments
    .filter((repayment) => !penaltyLedgerByVoucher.has(repaymentVoucherFromId(repayment.id)))
    .map((repayment) => ({
      repaymentId: repayment.id,
      loanId: repayment.loanId,
      memberName: repayment.loan.member.user.name,
      memberNumber: repayment.loan.member.memberNumber,
      penaltyPaid: num(repayment.penaltyPaid),
      repaymentDate: repayment.repaymentDate,
      expectedVoucher: repaymentVoucherFromId(repayment.id),
    }));

  const totalPenaltyPaid = repayments.reduce(
    (sum, repayment) => sum + num(repayment.penaltyPaid),
    0,
  );
  const nativePenaltyTotal = ledgerEntries.reduce(
    (sum, entry) => sum + num(entry.creditInterest),
    0,
  );
  const missingPenaltyTotal = missing.reduce(
    (sum, entry) => sum + num(entry.penaltyPaid),
    0,
  );

  return {
    repaymentCount: repayments.length,
    nativeEntryCount: ledgerEntries.length,
    totalPenaltyPaid,
    nativePenaltyTotal,
    missingCount: missing.length,
    missingPenaltyTotal,
    missing: missing.slice(0, 50),
  };
}

export async function remediateMissingLoanPenaltyLedgerEntries(userId: string) {
  const snapshot = await getLoanLedgerPenaltySyncSnapshot();
  const targetRepaymentIds = snapshot.missing.map((item) => item.repaymentId);

  if (targetRepaymentIds.length === 0) {
    return {
      remediatedCount: 0,
      remediatedPenaltyTotal: 0,
    };
  }

  const repayments = await db.loanRepayment.findMany({
    where: { id: { in: targetRepaymentIds } },
    select: {
      id: true,
      loanId: true,
      penaltyPaid: true,
      repaymentDate: true,
      loan: {
        select: {
          amountGranted: true,
          interestAmount: true,
        },
      },
    },
  });

  let remediatedCount = 0;
  let remediatedPenaltyTotal = 0;

  for (const repayment of repayments) {
    await db.$transaction(async (tx) => {
      const voucherNo = repaymentVoucherFromId(repayment.id);
      const existing = await tx.loanLedgerTransaction.findFirst({
        where: {
          loanId: repayment.loanId,
          transactionType: "PENALTY_PAYMENT",
          voucherNo: `${voucherNo}-PEN`,
        },
      });

      if (existing) return;

      await createNativeLoanRepaymentLedgerEntries(tx, {
        loanId: repayment.loanId,
        transactionDate: repayment.repaymentDate,
        voucherNo,
        principalAmount: 0,
        interestAmount: 0,
        penaltyAmount: num(repayment.penaltyPaid),
        initialPrincipalBalance: num(repayment.loan.amountGranted),
        initialInterestBalance: num(repayment.loan.interestAmount),
      });
    });

    remediatedCount += 1;
    remediatedPenaltyTotal += num(repayment.penaltyPaid);
  }

  await db.auditLog.create({
    data: {
      userId,
      action: "LOAN_LEDGER_PENALTY_REMEDIATION",
      entityType: "LoanLedgerTransaction",
      entityId: "bulk-remediation",
      details: {
        remediatedCount,
        remediatedPenaltyTotal,
      },
    },
  });

  return {
    remediatedCount,
    remediatedPenaltyTotal,
  };
}
