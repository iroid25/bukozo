const { calculateLoanSchedule } = require("./dist/lib/loan-calculations"); // if compiled
// Actually, let's just write a mini version of the calc inside the script to verify the logic I wrote
function calculateFlatRate(principal, monthlyRate, months) {
    const totalInterest = Math.round(principal * (monthlyRate / 100) * months);
    return totalInterest;
}

const principal = 1000000;
const annualRate = 30;
const monthlyRate = annualRate / 12;
const months = 3;

console.log("Principal:", principal);
console.log("Annual Rate:", annualRate + "%");
console.log("Months:", months);
console.log("Expected Flat Interest:", calculateFlatRate(principal, monthlyRate, months));
