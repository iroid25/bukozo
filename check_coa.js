const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const accounts = await prisma.chartOfAccount.findMany({
        where: { ledgerType: 'LIABILITIES' },
        select: { accountCode: true, accountName: true, level: true },
        orderBy: { accountCode: 'asc' }
    });
    console.log(accounts.slice(0, 20));
}

main().finally(() => prisma.$disconnect());
