
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🛠️  Starting Role Data Migration...");

  try {
    // We use executeRaw because the Prisma Client enum types don't include the old values anymore,
    // so standard prisma.user.update would fail if we tried to query by the old enum value.
    
    console.log("🔄 Updating LOAN_OFFICER to LOANOFFICER...");
    const loanOfficers = await prisma.$executeRaw`
      UPDATE "User" 
      SET role = 'LOANOFFICER'::"UserRole" 
      WHERE role::text = 'LOAN_OFFICER'
    `;
    console.log(`✅ Updated ${loanOfficers} Loan Officers.`);

    console.log("🔄 Updating BRANCH_MANAGER to BRANCHMANAGER...");
    const branchManagers = await prisma.$executeRaw`
      UPDATE "User" 
      SET role = 'BRANCHMANAGER'::"UserRole" 
      WHERE role::text = 'BRANCH_MANAGER'
    `;
    console.log(`✅ Updated ${branchManagers} Branch Managers.`);

    console.log("✨ Role migration complete!");
  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
