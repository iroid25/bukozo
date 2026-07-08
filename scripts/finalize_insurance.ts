import { db } from "../prisma/db";
import { AccountLedgerType } from "@prisma/client";

async function finalizeInsurance() {
  console.log("🚀 Finalizing insurance configuration...");

  try {
    // 1. Find the new category to get its ID
    const loansInsuranceCat = await db.budgetCategory.findFirst({
      where: { name: "Loans Insurance" },
    });

    if (loansInsuranceCat) {
      console.log(`Setting up SystemConfiguration for 'LOANS_INSURANCE_ACCOUNT' with category ID: ${loansInsuranceCat.id}`);
      
      await db.systemConfiguration.upsert({
        where: { key: "LOANS_INSURANCE_ACCOUNT" },
        update: { value: loansInsuranceCat.id },
        create: {
          key: "LOANS_INSURANCE_ACCOUNT",
          value: loansInsuranceCat.id,
          description: "Default account for loan insurance contributions",
          category: "ACCOUNTS",
        },
      });
      console.log("✅ SystemConfiguration 'LOANS_INSURANCE_ACCOUNT' updated.");
    }

    // 2. Update any remaining COA that should be Liabilities
    const coa = await db.chartOfAccount.findFirst({
      where: { accountName: { contains: "insurance income", mode: "insensitive" } },
    });

    if (coa) {
      console.log(`Updating System COA '${coa.accountName}' to Liabilities...`);
      await db.chartOfAccount.update({
        where: { id: coa.id },
        data: {
          accountName: "Loans Insurance",
          ledgerType: AccountLedgerType.LIABILITIES,
          category: "NON-CURRENT LIABILITIES",
        },
      });
      console.log("✅ Updated System COA to 'Loans Insurance' and LIABILITIES.");
    }

    console.log("✨ Finalization complete!");
  } catch (error) {
    console.error("❌ Error during finalization:", error);
  }
}

finalizeInsurance();
