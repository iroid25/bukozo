import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Equity Account Cleanup...");

    // 1. Rename 303000 to Retained earnings
    const retainedEarnings = await prisma.chartOfAccount.updateMany({
        where: { accountCode: "303000" },
        data: { accountName: "Retained earnings" }
    });
    console.log(`- Updated 303000: ${retainedEarnings.count} records`);

    // 2. Delete unwanted accounts (already verified to have 0 transactions)
    const deleted1004 = await prisma.chartOfAccount.deleteMany({
        where: { accountCode: "301004" }
    });
    console.log(`- Deleted 301004: ${deleted1004.count} records`);

    const deleted2001 = await prisma.chartOfAccount.deleteMany({
        where: { accountCode: "302001" }
    });
    console.log(`- Deleted 302001: ${deleted2001.count} records`);

    // 3. Ensure other requested accounts are correctly named
    const updates = [
        { code: "300000", name: "Equity" },
        { code: "301000", name: "Statutory reserves" },
        { code: "302000", name: "Grants and donations" },
        { code: "304000", name: "share capital" }
    ];

    for (const update of updates) {
        const res = await prisma.chartOfAccount.updateMany({
            where: { accountCode: update.code },
            data: { accountName: update.name, isActive: true }
        });
        console.log(`- Normalized ${update.code} to "${update.name}": ${res.count} records`);
    }

    console.log("\nCleanup Complete. Resulting List:");
    const finalAccounts = await prisma.chartOfAccount.findMany({
        where: { ledgerType: "EQUITY", isActive: true },
        orderBy: { accountCode: "asc" }
    });
    
    finalAccounts.forEach(acc => {
        console.log(`- ${acc.accountCode}: ${acc.accountName}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
