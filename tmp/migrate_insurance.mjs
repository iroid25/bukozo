import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function migrateInsurance() {
  try {
    const coaId = "cm1re45sc0001jz08x8m90z6y";
    const catId = "cm1re45sc0002jz08x8m90z6y";

    console.log('Migrating IDs:', { coaId, catId });

    await db.$transaction(async (tx) => {
      // Update Chart of Account
      await tx.chartOfAccount.update({
        where: { id: coaId },
        data: {
          accountName: "Loans Insurance",
          ledgerType: "LIABILITY",
          category: "LIABILITY", // Added this
          accountCode: "2105", 
          fullCode: "2105", // Also update fullCode to match accountCode
          description: "Insurance liability for loans"
        }
      });

      // Update Budget Category
      await tx.budgetCategory.update({
        where: { id: catId },
        data: {
          name: "Loans Insurance",
          kind: "LIABILITY"
        }
      });

      console.log('Migration successful!');
    });

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await db.$disconnect();
  }
}

migrateInsurance();
