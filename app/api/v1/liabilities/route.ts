import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import { bumpAccountingSyncState } from '@/lib/services/accounting-sync';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const data = await request.json();

    const result = await db.$transaction(async (tx) => {
      // 1. Find the parent classification in COA
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { accountCode: data.classificationCode }
      });

      if (!parentAccount) {
        throw new Error(`Classification account (${data.classificationCode}) not found. Please verify COA.`);
      }

      const category = parentAccount.category || parentAccount.accountName;

      // 2. Generate COA Code (e.g. 2011xx for individual liabilities under 201100)
      const parentCode = data.classificationCode;
      const baseCode = parentCode.endsWith("00") ? parentCode.slice(0, 4) : parentCode;
      
      const latestLiabilityAccount = await tx.chartOfAccount.findFirst({
        where: { 
          accountCode: { startsWith: baseCode },
          level: parentAccount.level + 1
        },
        orderBy: { accountCode: "desc" }
      });

      let nextCodeInt = 1;
      if (latestLiabilityAccount) {
        const suffix = latestLiabilityAccount.accountCode.substring(baseCode.length);
        if (suffix) {
            nextCodeInt = parseInt(suffix) + 1;
        }
      }
      const coaCode = `${baseCode}${nextCodeInt.toString().padStart(2, "0")}`;

      // Build rich description capturing the benchmark fields
      const details = [];
      if (data.creditor) details.push(`Creditor: ${data.creditor}`);
      if (data.interestRate) details.push(`Interest: ${data.interestRate}%`);
      if (data.termMonths) details.push(`Term: ${data.termMonths}m`);
      if (data.referenceNumber) details.push(`Ref: ${data.referenceNumber}`);
      if (data.receiptNo) details.push(`Receipt: ${data.receiptNo}`);
      if (data.branchId) details.push(`Branch: ${data.branchId}`);
      
      const detailsStr = details.length > 0 ? " | " + details.join(", ") : "";
      const baseDescription = data.description || `Liability under [${category}]`;
      const fullDescription = baseDescription + detailsStr;

      // 3. Create the Chart of Account for this specific Liability
       const coaAccount = await tx.chartOfAccount.create({
         data: {
           accountName: data.liabilityName,
           accountCode: coaCode,
           fullCode: coaCode,
           ledgerType: "LIABILITIES",
           debitCredit: "CR", // Liabilities reflect a Credit normal balance
           isActive: true,
           level: parentAccount.level + 1,
           parentId: parentAccount.id,
           description: fullDescription.substring(0, 255), // Prisma usually limits description string length
           category: category
         }
       });

       // 4. Create Initial Journal Entry if balance > 0
       const initialBalance = Number(data.initialBalance || 0);

       if (initialBalance > 0) {
           if (!data.counterpartyAccountCode) {
               throw new Error("Counterparty Account Code is required when an initial balance is provided.");
           }

           const counterpartyAccount = await tx.chartOfAccount.findUnique({
             where: { accountCode: data.counterpartyAccountCode }
           });

           if (!counterpartyAccount) {
             throw new Error(`Counterparty account (${data.counterpartyAccountCode}) not found.`);
           }

           const entryNumber = `JE-LIABILITY-INIT-${Date.now()}`;

           // Credit: The New Liability Account (Increases Liability)
           await tx.journalEntry.create({
             data: {
               entryNumber,
               accountId: coaAccount.id,
               debitAmount: 0,
               creditAmount: initialBalance,
               description: `Initial Balance for Liability: ${data.liabilityName}`,
               reference: `INIT-${coaCode}`,
               createdByUserId: user.id,
             }
           });

           // Debit: Counterparty Account (Increases Asset/Cash where the money was received)
           await tx.journalEntry.create({
             data: {
               entryNumber,
               accountId: counterpartyAccount.id,
               debitAmount: initialBalance,
               creditAmount: 0,
               description: `Received funds for Liability: ${data.liabilityName}`,
               reference: `INIT-${coaCode}`,
               createdByUserId: user.id,
             }
           });

           // Update Balances
           await tx.chartOfAccount.update({
             where: { id: coaAccount.id },
             data: { balance: { increment: initialBalance }, creditBalance: { increment: initialBalance } }
           });

           await tx.chartOfAccount.update({
             where: { id: counterpartyAccount.id },
             // Assuming counterparty is typically an Asset (normal debit).
             // If counterparty is Cash, Debit increases its balance.
             // Our system tracks absolute Net balance correctly usually based on ledgerType, 
             // but `increment` works generically for double-entry when tracking absolute values.
             data: { balance: { increment: initialBalance }, debitBalance: { increment: initialBalance } }
           });
       }

       return coaAccount;
    });

    void bumpAccountingSyncState("Liability entry created");
    return NextResponse.json({ success: true, account: result });
  } catch (error: any) {
    console.error("Error creating liability:", error);
    return NextResponse.json(
      { error: "Failed to create liability entry", details: error.message },
      { status: 500 }
    );
  }
}
