const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding Liabilities...");

    // 1. Root Liability 200000
    let root = await prisma.chartOfAccount.findUnique({ where: { accountCode: "200000" } });
    if (!root) {
        root = await prisma.chartOfAccount.create({
            data: {
                accountCode: "200000",
                accountName: "Liabilities",
                fullCode: "200000",
                level: 1,
                currency: "UGX",
                isActive: true,
                ledgerType: "LIABILITIES"
            }
        });
        console.log("Created 200000 Liabilities");
    } else {
        console.log("200000 Liabilities exists");
    }

    // 2. Current Liabilities 201000
    let currentL = await prisma.chartOfAccount.findUnique({ where: { accountCode: "201000" } });
    if (!currentL) {
        currentL = await prisma.chartOfAccount.create({
            data: {
                accountCode: "201000",
                accountName: "Current Liabilities",
                fullCode: "201000",
                parentId: root.id,
                level: 2,
                currency: "UGX",
                isActive: true,
                ledgerType: "LIABILITIES"
            }
        });
        console.log("Created 201000 Current Liabilities");
    } else {
        console.log("201000 Current Liabilities exists");
    }

    // 3. Non-Current Liabilities 202000
    let nonCurrentL = await prisma.chartOfAccount.findUnique({ where: { accountCode: "202000" } });
    if (!nonCurrentL) {
        nonCurrentL = await prisma.chartOfAccount.create({
            data: {
                accountCode: "202000",
                accountName: "Non-current Liabilities",
                fullCode: "202000",
                parentId: root.id,
                level: 2,
                currency: "UGX",
                isActive: true,
                ledgerType: "LIABILITIES"
            }
        });
        console.log("Created 202000 Non-current Liabilities");
    } else {
        // Update its name to match user request if it already exists as something else 
        nonCurrentL = await prisma.chartOfAccount.update({
            where: { accountCode: "202000" },
            data: { accountName: "Non-current Liabilities" }
        });
        console.log("Updated 202000 Non-current Liabilities");
    }

    // Current Liabilities Sub-accounts
    const currentSubs = [
        { code: "201100", name: "Fixed Deposit Savings" },
        { code: "201200", name: "Junior Savings" },
        { code: "201300", name: "Voluntary Savings" },
        { code: "201400", name: "Compulsory Savings" },
        { code: "201500", name: "Dividends Payable" }
    ];

    for (const sub of currentSubs) {
        let node = await prisma.chartOfAccount.findUnique({ where: { accountCode: sub.code } });
        if (!node) {
            await prisma.chartOfAccount.create({
                data: {
                    accountCode: sub.code,
                    accountName: sub.name,
                    fullCode: sub.code,
                    parentId: currentL.id,
                    level: 3,
                    currency: "UGX",
                    isActive: true,
                    ledgerType: "LIABILITIES",
                    category: sub.name
                }
            });
            console.log(`Created ${sub.code} ${sub.name}`);
        }
    }

    // Non-Current Liabilities Sub-accounts
    const nonCurrentSubs = [
        { code: "202100", name: "Loan Insurance" },
        { code: "202200", name: "Accumulated Depreciation" },
        { code: "202300", name: "External Loan" },
        { code: "202400", name: "Founders Account" }
    ];

    for (const sub of nonCurrentSubs) {
        let node = await prisma.chartOfAccount.findUnique({ where: { accountCode: sub.code } });
        if (!node) {
            await prisma.chartOfAccount.create({
                data: {
                    accountCode: sub.code,
                    accountName: sub.name,
                    fullCode: sub.code,
                    parentId: nonCurrentL.id,
                    level: 3,
                    currency: "UGX",
                    isActive: true,
                    ledgerType: "LIABILITIES",
                    category: sub.name
                }
            });
            console.log(`Created ${sub.code} ${sub.name}`);
        } else {
            // Update an existing one if it's there
            await prisma.chartOfAccount.update({
                where: { accountCode: sub.code },
                data: { 
                    accountName: sub.name,
                    parentId: nonCurrentL.id, // Relink it to 202000 exactly
                    level: 3 
                }
            });
            console.log(`Updated ${sub.code} ${sub.name}`);
        }
    }

    console.log("Seeding complete.");
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => {
    prisma.$disconnect();
});
