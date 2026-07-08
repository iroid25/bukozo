import { PrismaClient } from "@prisma/client";
import {
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
  isVoluntarySavingsAccountTypeName,
  isFixedDepositAccountTypeName,
} from "../lib/accounting/account-type-rules.ts";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

const VOLUNTARY_TIERS = JSON.stringify([
  { max: 50000, fee: 300 },
  { max: 200000, fee: 500 },
  { max: 500000, fee: 700 },
  { max: null, fee: 1000 },
]);

async function main() {
  console.log("Starting voluntary savings configuration backfill...");

  const accountTypes = await prisma.accountType.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let updatedCount = 0;

  for (const accountType of accountTypes) {
    if (isVoluntarySavingsAccountTypeName(accountType.name)) {
      await prisma.accountType.update({
        where: { id: accountType.id },
        data: {
          name: accountType.name === "Voluntary Savings" ? accountType.name : VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
          monthlyCharge: 500,
          withdrawalFeeTiers: VOLUNTARY_TIERS,
          flatWithdrawalFee: null,
          withdrawalFeePercentage: null,
          withdrawalFrequencyDays: null,
          hasFixedPeriod: false,
          fixedPeriodMonths: null,
          maturityTransferAccountType: null,
          isDefault: true,
          isLoanEligible: true,
          canWithdraw: true,
          isShareAccount: false,
          earnsDividends: false,
        },
      });
      updatedCount++;
      continue;
    }

    if (isFixedDepositAccountTypeName(accountType.name)) {
      await prisma.accountType.update({
        where: { id: accountType.id },
        data: {
          monthlyCharge: 0,
          withdrawalFeeTiers: null,
          flatWithdrawalFee: null,
          withdrawalFeePercentage: null,
          withdrawalFrequencyDays: null,
          hasFixedPeriod: true,
          maturityTransferAccountType: VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
          canWithdraw: false,
          isLoanEligible: false,
          isShareAccount: false,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Backfill complete. Updated ${updatedCount} account type records.`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill voluntary savings config:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
