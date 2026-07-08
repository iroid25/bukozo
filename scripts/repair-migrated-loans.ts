// scripts/repair-migrated-loans.ts
import { PrismaClient } from "@prisma/client";
import { calculateLoanSchedule } from "../lib/loan-calculations";

const prisma = new PrismaClient();

async function repairLoans() {
    console.log("🔍 Finding migrated loans missing schedules...");
    
    // Find loans that have no schedules
    const loansToRepair = await prisma.loan.findMany({
        where: {
            schedules: { none: {} },
            status: { in: ["DISBURSED", "OVERDUE", "REPAID"] }
        },
        include: {
            loanApplication: { include: { loanProduct: true } },
            member: true
        }
    });

    console.log(`📋 Found ${loansToRepair.length} loans to repair.`);

    for (const loan of loansToRepair) {
        try {
            console.log(`🛠️ Repairing loan ${loan.id} for member ${loan.member?.memberNumber || 'Unknown'}...`);
            
            const product = loan.loanApplication?.loanProduct;
            const interestPeriod = (loan.interestPeriod as any) || (loan.loanApplication?.interestPeriod as any) || product?.interestPeriod || "ANNUAL";
            const interestType = loan.interestType || product?.interestType || "FLAT_RATE";
            const periods = loan.loanApplication?.repaymentPeriodMonths || 12;
            const disbursementDate = loan.disbursementDate || loan.createdAt;

            const result = calculateLoanSchedule({
                amountGranted: loan.amountGranted,
                interestRate: loan.interestRate,
                repaymentPeriodMonths: periods,
                disbursementDate: disbursementDate,
                interestType: interestType as any,
                interestPeriod: interestPeriod as any,
                gracePeriod: 0
            });
            const schedules = result.schedule;

            if (schedules && schedules.length > 0) {
                let runningPaid = loan.amountPaid || 0;
                const schedulesToCreate = schedules.map(s => {
                    const isPaid = runningPaid >= s.totalPayment;
                    const paidAmount = isPaid ? s.totalPayment : Math.max(0, runningPaid);
                    runningPaid -= paidAmount;
                    
                    return {
                        loanId: loan.id,
                        period: s.period,
                        dueDate: s.dueDate,
                        principalPayment: s.principalPayment,
                        interestPayment: s.interestPayment,
                        totalPayment: s.totalPayment,
                        remainingBalance: s.remainingBalance,
                        paidAmount: paidAmount,
                        status: isPaid ? "PAID" : (paidAmount > 0 ? "PARTIAL" : "PENDING")
                    };
                });

                await prisma.loanRepaymentSchedule.createMany({
                    data: schedulesToCreate
                });
                
                console.log(`✅ Repaired schedules for loan ${loan.id}`);
            } else {
                console.warn(`⚠️ Could not generate schedules for loan ${loan.id}`);
            }

        } catch (err: any) {
            console.error(`❌ Error repairing loan ${loan.id}:`, err.message);
        }
    }

    console.log("🏁 Repair complete.");
}

repairLoans()
    .catch(err => console.error(err))
    .finally(() => prisma.$disconnect());
