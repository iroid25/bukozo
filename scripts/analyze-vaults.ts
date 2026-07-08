
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    include: {
      vaults: true,
    },
  });

  console.log('Branch Vault Analysis:');
  branches.forEach(branch => {
    console.log(`\nBranch: ${branch.name} (${branch.id})`);
    if (branch.vaults.length === 0) {
      console.log('  No vaults found.');
    } else {
      branch.vaults.forEach(vault => {
        console.log(`  Vault: ${vault.name} (${vault.id})`);
        console.log(`    Active: ${vault.isActive}`);
        console.log(`    Balance: ${vault.balance}`);
        console.log(`     custodianUserId: ${vault.custodianUserId}`);
      });
      const totalBalance = branch.vaults.reduce((sum, v) => sum + v.balance, 0);
      console.log(`  TOTAL BALANCE: ${totalBalance}`);
    }
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
