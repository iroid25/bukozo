import { db } from "../prisma/db.ts";

async function main() {
  const [individualAnnual, institutionAnnual, individualTotal, institutionTotal] = await Promise.all([
    db.loan.count({ where: { interestPeriod: "ANNUAL" } }),
    db.institutionLoan.count({ where: { application: { interestPeriod: "ANNUAL" } } }),
    db.loan.count(),
    db.institutionLoan.count(),
  ]);

  console.log("Individual loans total:", individualTotal, "| with interestPeriod=ANNUAL:", individualAnnual);
  console.log("Institution loans total:", institutionTotal, "| with interestPeriod=ANNUAL:", institutionAnnual);

  const annualLoans = await db.loan.findMany({
    where: { interestPeriod: "ANNUAL" },
    select: { id: true, amountGranted: true, totalAmountDue: true, interestRate: true, interestType: true, status: true, member: { select: { memberNumber: true } } },
  });
  console.log("\nIndividual ANNUAL loans:");
  for (const l of annualLoans) {
    console.log(`  ${l.id} member=${l.member.memberNumber} granted=${l.amountGranted} totalDue=${l.totalAmountDue} rate=${l.interestRate} type=${l.interestType} status=${l.status} impliedInterestRatio=${((l.totalAmountDue - l.amountGranted) / l.amountGranted * 100).toFixed(1)}%`);
  }

  const annualInstLoans = await db.institutionLoan.findMany({
    where: { application: { interestPeriod: "ANNUAL" } },
    select: { id: true, amountGranted: true, totalAmountDue: true, interestRate: true, status: true, institution: { select: { institutionName: true } }, application: { select: { interestType: true, repaymentPeriodMonths: true } } },
  });
  console.log("\nInstitution ANNUAL loans:");
  for (const l of annualInstLoans) {
    console.log(`  ${l.id} inst=${l.institution.institutionName} granted=${l.amountGranted} totalDue=${l.totalAmountDue} rate=${l.interestRate} type=${l.application.interestType} periodMonths=${l.application.repaymentPeriodMonths} status=${l.status} impliedInterestRatio=${((l.totalAmountDue - l.amountGranted) / l.amountGranted * 100).toFixed(1)}%`);
  }
}

main().then(() => db.$disconnect()).catch(async e => { console.error(e); await db.$disconnect(); process.exit(1); });
