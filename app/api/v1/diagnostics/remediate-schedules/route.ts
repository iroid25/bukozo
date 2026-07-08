import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { calculateLoanSchedule } from "@/lib/loan-calculations";
import { InterestType, InterestPeriod, LoanStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const specificLoanId = searchParams.get("loanId");

    // 1. Identify affected loans
    const loans = await db.loan.findMany({
      where: specificLoanId ? { id: specificLoanId } : {
        status: { in: ["DISBURSED", "OVERDUE"] }
      },
      include: {
        loanApplication: {
          include: {
            loanProduct: true
          }
        },
        schedules: { orderBy: { period: "asc" } },
        ledgerTransactions: { orderBy: { transactionDate: "asc" } },
        repayments: { orderBy: { repaymentDate: "asc" } }
      }
    });

    const results = [];

    for (const loan of loans) {
      const remediation: any = { loanId: loan.id, changes: [] };
      
      // A. Remediate Schedules
      let currentSchedules = loan.schedules;
      if (currentSchedules.length === 0) {
        const app = loan.loanApplication;
        const amount = loan.amountGranted;
        const rate = loan.interestRate;
        const periodMonths = app.repaymentPeriodMonths || 1;
        const interestType = (loan.interestType as "FLAT_RATE" | "REDUCING_BALANCE") || "FLAT_RATE";
        const interestPeriod = (loan.interestPeriod as "MONTHLY" | "ANNUAL") || "MONTHLY";
        const startDate = app.repaymentStartDate || loan.disbursementDate || new Date();
        const gracePeriod = app.gracePeriod || 0;

        const result = calculateLoanSchedule({
          amountGranted: amount,
          interestRate: rate,
          repaymentPeriodMonths: periodMonths,
          interestType: interestType,
          gracePeriod: gracePeriod,
          disbursementDate: startDate,
          interestPeriod: interestPeriod
        });
        
        const scheduleData = result.schedule.map(s => ({
            loanId: loan.id,
            period: s.period,
            dueDate: s.dueDate,
            principalPayment: s.principalPayment,
            interestPayment: s.interestPayment,
            totalPayment: s.totalPayment,
            remainingBalance: s.remainingBalance,
            paidAmount: 0,
            status: "PENDING"
        }));

        await db.loanRepaymentSchedule.createMany({
          data: scheduleData
        });
        
        // Refresh schedules for ledger calculation
        currentSchedules = await db.loanRepaymentSchedule.findMany({
            where: { loanId: loan.id },
            orderBy: { period: "asc" }
        });
        
        remediation.changes.push(`Created ${scheduleData.length} schedules`);
      }

      // B. Remediate Ledger Transactions
      if (loan.ledgerTransactions.length === 0) {
        // 1. Initial Disbursement
        const totalInterest = currentSchedules.length > 0 
           ? currentSchedules.reduce((sum, s) => sum + s.interestPayment, 0)
           : (loan.interestAmount || 0);

        let currentPrincipal = loan.amountGranted;
        let currentInterest = totalInterest;

        await db.loanLedgerTransaction.create({
          data: {
            loanId: loan.id,
            transactionType: "DISBURSEMENT",
            transactionDate: loan.disbursementDate || loan.createdAt,
            voucherNo: loan.id.substring(0, 8).toUpperCase(),
            debitPrincipal: loan.amountGranted,
            debitInterest: totalInterest,
            creditPrincipal: 0,
            creditInterest: 0,
            balancePrincipal: currentPrincipal,
            balanceInterest: currentInterest,
            balanceTotal: currentPrincipal + currentInterest
          }
        });
        remediation.changes.push("Created initial DISBURSEMENT ledger entry");

        // 2. Reconstruct Repayment History
        for (const rep of loan.repayments) {
            currentPrincipal -= rep.principalPaid;
            currentInterest -= rep.interestPaid;

            await db.loanLedgerTransaction.create({
              data: {
                loanId: loan.id,
                transactionType: "REPAYMENT",
                transactionDate: rep.repaymentDate,
                voucherNo: rep.id.substring(0, 8).toUpperCase(),
                debitPrincipal: 0,
                debitInterest: 0,
                creditPrincipal: rep.principalPaid,
                creditInterest: rep.interestPaid,
                balancePrincipal: currentPrincipal,
                balanceInterest: currentInterest,
                balanceTotal: currentPrincipal + currentInterest
              }
            });
            remediation.changes.push(`Created REPAYMENT ledger entry for ${rep.amount}`);
        }
      }

      if (remediation.changes.length > 0) {
        results.push(remediation);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Remediated ${results.length} loans`,
      details: results
    });
  } catch (error: any) {
    console.error("Remediation error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
