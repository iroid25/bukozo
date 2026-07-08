
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function run() {
  console.log('--- Surgical Liability Restructuring ---');
  try {
      const assetsId = 'cmlnf0flp0000w7t4i29iuaj2';
      const currentLiabId = 'cmm0vp17t000jw7n88svd8oay';
      const nonCurrentLiabId = 'cmm0vp3x0000rw7n80ixw1wez';
      
      // 1. Activate parents
      console.log('Activating parents...');
      await db.chartOfAccount.updateMany({
        where: { id: { in: [currentLiabId, nonCurrentLiabId] } },
        data: { isActive: true }
      });

      // 2. Move Accumulated Depreciation to Assets
      console.log('Moving Accumulated Depreciation...');
      await db.chartOfAccount.update({
        where: { id: 'cmn32km9f0003uwnggao73icd' },
        data: { accountCode: '109010', ledgerType: 'ASSETS', parentId: assetsId, accountName: 'Accumulated Depreciation' }
      });

      // 3. Re-code Loans Insurance (418000 -> 201020) and parent it
      console.log('Fixing Loans Insurance code...');
      await db.chartOfAccount.update({
        where: { id: 'cmmkap8im000vw7lo76i8koai' },
        data: { accountCode: '201020', parentId: currentLiabId, accountName: 'Loans Insurance' }
      });

      // 4. Move External Loan (202030) to Non-current
      console.log('Moving External Loan to Non-current...');
      await db.chartOfAccount.updateMany({
        where: { accountCode: '202030' },
        data: { parentId: nonCurrentLiabId, accountName: 'External Loan (Long Term)' }
      });

      // 5. Move savings and other current items under parent
      console.log('Moving savings accounts...');
      await db.chartOfAccount.updateMany({
        where: { accountCode: { in: ['201010', '201100', '201200', '201300', '201400', '201500'] } },
        data: { parentId: currentLiabId }
      });

      console.log('Surgical Restructuring Complete');
  } catch (err) {
      console.error('FAILED:', err);
      process.exit(1);
  } finally {
      await db.$disconnect();
  }
}
run();
