
import { calculateLoanSchedule } from "../lib/loan-calculations";

function test(
    principal: number,
    rate: number,
    months: number,
    type: "FLAT_RATE" | "REDUCING_BALANCE",
    interestPeriod: "MONTHLY" | "ANNUAL" = "MONTHLY"
) {
    console.log(
        `\n--- Test: ${type}, Principal: ${principal}, Rate: ${rate}% ${interestPeriod.toLowerCase()}, Months: ${months} ---`
    );
    const result = calculateLoanSchedule({
        amountGranted: principal,
        interestRate: rate,
        repaymentPeriodMonths: months,
        interestType: type,
        interestPeriod,
    });
    
    console.log("Total Interest:", result.totalInterest);
    console.log("Total Amount Repaid:", result.totalAmountRepaid);
    
    console.log("Schedule Summary:");
    result.schedule.forEach(item => {
        console.log(`Month ${item.period}: Principal=${item.principalPayment.toFixed(2)}, Interest=${item.interestPayment.toFixed(2)}, Total=${item.totalPayment.toFixed(2)}, Balance=${item.remainingBalance.toFixed(2)}`);
    });

    // Verification
    if (Math.abs(result.totalAmountRepaid - (result.totalPrincipal + result.totalInterest)) > 0.01) {
        console.error("ERROR: Total Amount Repaid mismatch!");
    }
}

function main() {
    test(100000, 10, 5, "FLAT_RATE");
    test(100000, 10, 5, "REDUCING_BALANCE");
    test(100000, 30, 12, "FLAT_RATE", "ANNUAL");
}

main();
