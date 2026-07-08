import { db } from "./prisma/db";

async function main() {
    console.log("--- Accounting Integration Verification ---");

    // 1. Check if Journal Entries exist for recent disbursements
    const recentDisbs = await db.journalEntry.findMany({
        where: { description: { contains: "Disbursement", mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { account: true }
    });

    console.log(`\nFound ${recentDisbs.length} recent disbursement journal entry lines.`);
    
    // Group by entryNumber to check balance
    const groupedDisbs = recentDisbs.reduce((acc: any, curr) => {
        if (!acc[curr.entryNumber]) acc[curr.entryNumber] = { debits: 0, credits: 0, lines: [] };
        acc[curr.entryNumber].debits += curr.debitAmount;
        acc[curr.entryNumber].credits += curr.creditAmount;
        acc[curr.entryNumber].lines.push(curr);
        return acc;
    }, {});

    Object.keys(groupedDisbs).forEach(entry => {
        const data = groupedDisbs[entry];
        console.log(`Entry ${entry}: Dr sum: ${data.debits}, Cr sum: ${data.credits} -> ${data.debits === data.credits ? "BALANCED ✅" : "UNBALANCED ❌"}`);
        data.lines.forEach((l: any) => {
            console.log(`  - ${l.account.accountCode} (${l.account.accountName}): Dr ${l.debitAmount}, Cr ${l.creditAmount}`);
        });
    });

    // 2. Check if Journal Entries exist for recent repayments
    const recentRepays = await db.journalEntry.findMany({
        where: { description: { contains: "Repayment", mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { account: true }
    });

    console.log(`\nFound ${recentRepays.length} recent repayment journal entry lines.`);
    
    const groupedRepays = recentRepays.reduce((acc: any, curr) => {
        if (!acc[curr.entryNumber]) acc[curr.entryNumber] = { debits: 0, credits: 0, lines: [] };
        acc[curr.entryNumber].debits += curr.debitAmount;
        acc[curr.entryNumber].credits += curr.creditAmount;
        acc[curr.entryNumber].lines.push(curr);
        return acc;
    }, {});

    Object.keys(groupedRepays).forEach(entry => {
        const data = groupedRepays[entry];
         // Using epsilon check for repayments because of potential small principal portions
        const isBalanced = Math.abs(data.debits - data.credits) < 0.1;
        console.log(`Entry ${entry}: Dr sum: ${data.debits}, Cr sum: ${data.credits} -> ${isBalanced ? "BALANCED ✅" : "UNBALANCED ❌"}`);
        data.lines.forEach((l: any) => {
            console.log(`  - ${l.account.accountCode} (${l.account.accountName}): Dr ${l.debitAmount}, Cr ${l.creditAmount}`);
        });
    });
}

main().catch(console.error);
