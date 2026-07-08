
import { processMaturedFixedDeposits } from "../lib/cron/fixedDepositMaturity";
import { db } from "../prisma/db";
import { AccountStatus } from "@prisma/client";

async function run() {
  console.log("--- Starting Maturity Logic Test ---");

  // 1. Setup Test Data
  const uniqueId = Date.now().toString().slice(-6);
  const email = `test-maturity-${uniqueId}@example.com`;
  
  console.log(`Creating test user: ${email}`);

  const user = await db.user.create({
    data: {
      name: "Test Maturity User",
      email: email,
      password: "password123",
      firstName: "Test",
      lastName: "User",
      role: "MEMBER",

    }
  });

  // Ensure SYSTEM user exists
  await db.user.upsert({
      where: { id: "SYSTEM" },
      update: {},
      create: {
          id: "SYSTEM",
          name: "System Administrator",
          email: "system@example.com",
          password: "systempassword",
          role: "ADMIN",
          firstName: "System",
          lastName: "Admin"
      }
  });

  const member = await db.member.create({
    data: {
      userId: user.id,
      memberNumber: `MEM-${uniqueId}`,

    }
  });

  // Ensure Account Types exist
  let voluntaryType = await db.accountType.findFirst({ where: { name: { contains: "Voluntary" } } });
  if (!voluntaryType) {
      voluntaryType = await db.accountType.create({ data: { name: "Voluntary Savings Account", isLoanEligible: true, interestRate: 5 } });
  }
  console.log("Using Voluntary Type:", voluntaryType.name);

  let fixedType = await db.accountType.findFirst({ where: { hasFixedPeriod: true } });
  if (!fixedType) {
     fixedType = await db.accountType.create({ data: { name: "Fixed Deposit Test", hasFixedPeriod: true, minBalance: 100000, interestRate: 10 } });
  }

  // Create Branch
  let branch = await db.branch.findFirst({ where: { name: "Verification Branch" } });
  if (!branch) {
      branch = await db.branch.create({ data: { name: "Verification Branch", location: "Test Location" } });
  }


  // Create Voluntary Account
  const voluntaryAccount = await db.account.create({
    data: {
      memberId: member.id,
      branchId: branch.id,
      accountTypeId: voluntaryType.id,
      accountNumber: `VS-${uniqueId}`,
      balance: 1000,
      status: "ACTIVE"
    }
  });

  // Create Matured Fixed Deposit (Yesterday)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const fdAccount = await db.account.create({
    data: {
      memberId: member.id,
      branchId: branch.id,
      accountTypeId: fixedType.id,
      accountNumber: `FD-${uniqueId}`,
      balance: 500000,
      status: "ACTIVE",
      fixingStartDate: new Date(yesterday.getTime() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
      fixingEndDate: yesterday,
      expectedInterest: 5000 // Dummy interest
    }
  });

  console.log(`Created FD Account ${fdAccount.accountNumber} with Balance ${fdAccount.balance} and End Date ${yesterday.toISOString()}`);

  const checkVS = await db.account.findFirst({
      where: {
          memberId: member.id,
          status: "ACTIVE",
          accountType: { name: "Voluntary Savings" }
      }
  });
  console.log("PRE-CHECK VS Found:", checkVS ? checkVS.id : "No");

  // 2. Run Process
  console.log("Running processMaturedFixedDeposits...");
  const result = await processMaturedFixedDeposits();
  console.log("Result:", JSON.stringify(result, null, 2));
  const fs = require('fs');
  fs.writeFileSync('test_output.txt', JSON.stringify(result, null, 2));

  // 3. Verify
  const updatedFD = await db.account.findUnique({ where: { id: fdAccount.id } });
  const updatedVS = await db.account.findUnique({ where: { id: voluntaryAccount.id } });

  if (updatedFD?.status === "CLOSED" && updatedFD.balance === 0) {
      console.log("✅ FD Account is CLOSED and Zero Balance");
  } else {
      console.error(`❌ FD Account status: ${updatedFD?.status}, Balance: ${updatedFD?.balance}`);
  }

  const expectedVSBalance = 1000 + 500000 + 5000; // Initial + Principal + Interest
  if (updatedVS?.balance === expectedVSBalance) {
      console.log(`✅ Voluntary Savings Balance is Correct: ${updatedVS.balance}`);
  } else {
      console.error(`❌ Voluntary Savings Balance Mismatch. Expected ${expectedVSBalance}, got ${updatedVS?.balance}`);
  }

  // Cleanup
  console.log("Cleaning up...");
  await db.transaction.deleteMany({ where: { accountId: { in: [fdAccount.id, voluntaryAccount.id] } } });
  await db.account.deleteMany({ where: { memberId: member.id } });
  await db.member.delete({ where: { id: member.id } });
  await db.user.delete({ where: { id: user.id } });
  
  console.log("Done.");
}

run();
