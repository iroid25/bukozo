
import { calculateLoanSchedule } from "../lib/loan-calculations";

function verifyCalculation(principal: number, rate: number, period: number, type: "FLAT_RATE" | "REDUCING_BALANCE") {
  console.log(`\n--- Verifying ${type} Loan: ${principal} @ ${rate}% / month for ${period} months ---`);
  
  const result = calculateLoanSchedule({
    amountGranted: principal,
    interestRate: rate,
    repaymentPeriodMonths: period,
    interestType: type
  });
  
  console.log(`Expected Total Principal: ${principal}`);
  console.log(`Calculated Total Principal: ${result.totalPrincipal}`);
  
  // Flat Rate check
  if (type === "FLAT_RATE") {
      const expectedInterest = principal * (rate / 100) * period;
      console.log(`Expected Total Interest (Flat): ${expectedInterest}`);
      console.log(`Calculated Total Interest: ${result.totalInterest}`);
      if (Math.abs(result.totalInterest - expectedInterest) < 0.01) {
          console.log("✅ Total Interest Matches Expected");
      } else {
          console.error("❌ Total Interest Mismatch");
      }
  }

  // Schedule length check
  console.log(`Schedule Length: ${result.schedule.length} (Expected: ${period})`);
  if (result.schedule.length === period) {
      console.log("✅ Schedule Length Correct");
  } else {
      console.error("❌ Schedule Length Mismatch");
  }

  // Last Balance check
  const lastItem = result.schedule[result.schedule.length - 1];
  console.log(`Last Month Balance: ${lastItem.remainingBalance} (Expected: 0 or near 0)`);
  if (lastItem.remainingBalance < 1) {
       console.log("✅ Loan Fully Repaid");
  } else {
       console.error("❌ Loan Not Fully Repaid");
  }
}

async function run() {
    // Case 1: Flat Rate, 1 Million, 2% pm, 5 months
    verifyCalculation(1000000, 2, 5, "FLAT_RATE");

    // Case 2: Reducing Balance, 1 Million, 2% pm, 5 months
    verifyCalculation(1000000, 2, 5, "REDUCING_BALANCE");

    // Case 3: Long period (24 months)
    verifyCalculation(5000000, 1.5, 24, "FLAT_RATE");
}

run();
