import { db } from "../prisma/db";
import { AccountLedgerType } from "@prisma/client";

async function reclassifyInsurance() {
  console.log("🚀 Starting insurance re-classification...");

  try {
    // 1. Find the "Loan insurance fees" budget category
    const loanInsuranceFees = await db.budgetCategory.findFirst({
      where: { name: { contains: "Loan insurance fees", mode: "insensitive" } },
    });

    if (!loanInsuranceFees) {
      console.error("❌ Budget Category 'Loan insurance fees' not found.");
      return;
    }

    console.log(`Found 'Loan insurance fees' (ID: ${loanInsuranceFees.id})`);

    // 2. Find or create "Non-current Liabilities" parent category
    let nonCurrentLiabilities = await db.budgetCategory.findFirst({
      where: { name: { contains: "Non-current Liabilities", mode: "insensitive" } },
    });

    if (!nonCurrentLiabilities) {
      console.log("Creating 'Non-current Liabilities' category...");
      nonCurrentLiabilities = await db.budgetCategory.create({
        data: {
          name: "Non-current Liabilities",
          code: "202000", // Using a likely code for long-term liabilities
          kind: "LIABILITY" as any,
          isActive: true,
        },
      });
    }

    console.log(`Using 'Non-current Liabilities' (ID: ${nonCurrentLiabilities.id})`);

    // 3. Move and rename the category
    await db.budgetCategory.update({
      where: { id: loanInsuranceFees.id },
      data: {
        name: "Loans Insurance",
        parentId: nonCurrentLiabilities.id,
        kind: "LIABILITY" as any,
        code: "202001",
      },
    });

    console.log("✅ Updated Budget Category to 'Loans Insurance' under 'Non-current Liabilities'");

    // 4. Update the corresponding ChartOfAccount if it exists
    const coa = await db.chartOfAccount.findFirst({
      where: { accountName: { contains: "Loan insurance fees", mode: "insensitive" } },
    });

    if (coa) {
      console.log(`Updating ChartOfAccount '${coa.accountName}' (ID: ${coa.id})`);
      await db.chartOfAccount.update({
        where: { id: coa.id },
        data: {
          accountName: "Loans Insurance",
          ledgerType: AccountLedgerType.LIABILITIES,
          // We might need to move it to a different parent in COA too if there's a hierarchy
        },
      });
      console.log("✅ Updated ChartOfAccount to 'Loans Insurance'");
    } else {
      console.log("⚠️  Corresponding ChartOfAccount not found by name.");
    }

    console.log("✨ Insurance re-classification complete!");
  } catch (error) {
    console.error("❌ Error during re-classification:", error);
  }
}

reclassifyInsurance();
