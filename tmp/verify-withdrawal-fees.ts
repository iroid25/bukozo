
import { db } from "./prisma/db";
import { createWithdrawal } from "@/actions/withdraws";

async function main() {
  console.log("--- STARTING WITHDRAWAL FEE VERIFICATION ---");

  // 1. Find a suitable teller
  const teller = await db.user.findFirst({ where: { role: "TELLER" } });
  if (!teller) throw new Error("No Teller found");
  console.log(`Teller: ${teller.name}`);

  // 2. Find a member with account and balance
  const account = await db.account.findFirst({
    where: { 
        status: "ACTIVE",
        balance: { gt: 100000 },
        accountType: { name: { contains: "Voluntary", mode: "insensitive" } }
    },
    include: { member: true, accountType: true }
  });
  if (!account) throw new Error("No suitable Voluntary account found");
  if (!account.memberId) throw new Error("Account has no memberId");
  console.log(`Account: ${account.accountNumber} (${account.accountType.name}) - Balance: ${account.balance}`);

  // 3. Perform Withdrawal (Amount that triggers a fee)
  // Assuming 10,000 withdrawal has a fee configured or default percentage
  const amount = 10000;
  
  console.log(`Attempting withdrawal of ${amount}...`);
  
  const result = await createWithdrawal({
      accountId: account.id,
      memberId: account.memberId!,
      amount: amount,
      channel: "CASH",
      description: "Test Withdrawal for Fee Verification"
  }, teller.id);

  if (result.error || !result.data) {
      console.error("Error/No Data:", result.error);
      return;
  }
  
  const withdrawal = result.data;
  console.log("Withdrawal created ID:", withdrawal.id);

  // Fetch transaction to get the ref
  const transaction = await db.transaction.findUnique({
      where: { id: withdrawal.transactionId }
  });
  
  if (!transaction) {
      console.error("Transaction not found for withdrawal");
      return;
  }

  // 4. Check Income Record
  // We expect a recent IncomeRecord with the transaction ref
  const incomeRecord = await db.incomeRecord.findFirst({
      where: {
          description: { contains: transaction.transactionRef }
      },
      include: { category: true }
  });

  if (!incomeRecord) {
      console.log("⚠️ No Income Record found! (Maybe no fee was charged?)");
  } else {
      console.log("✅ Income Record Found!");
      console.log(`   Amount: ${incomeRecord.amount}`);
      console.log(`   Category: ${incomeRecord.category?.name} (ID: ${incomeRecord.categoryId})`);
      
      if (incomeRecord.category?.name === "Transaction Fees") {
          console.log("SUCCESS: Fee correctly linked to 'Transaction Fees' category.");
      } else {
          console.error("FAILURE: Incorrect category linked.");
      }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
