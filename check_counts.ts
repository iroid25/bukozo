import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const count = await prisma.member.count();
    console.log(`Member count: ${count}`);
    const loanCount = await prisma.loan.count();
    console.log(`Loan count: ${loanCount}`);
    const scheduleCount = await prisma.loanRepaymentSchedule.count();
    console.log(`Schedule count: ${scheduleCount}`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
