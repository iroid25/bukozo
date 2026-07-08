import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const codes = ["300000", "301000", "301004", "302000", "302001", "303000", "304000"];
    
    const accounts = await prisma.chartOfAccount.findMany({
        where: {
            accountCode: { in: codes }
        },
        include: {
            _count: {
                select: {
                    journalEntries: true,
                    creditTransactions: true,
                    debitTransactions: true
                }
            }
        }
    });

    console.log("Found Accounts:");
    accounts.forEach(acc => {
        console.log(`- ${acc.accountCode}: ${acc.accountName} (ID: ${acc.id})`);
        console.log(`  Journal Entries: ${acc._count.journalEntries}`);
        console.log(`  Transactions: ${acc._count.creditTransactions + acc._count.debitTransactions}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
