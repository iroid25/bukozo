
import { db } from "../prisma/db";
import { TransactionService } from "../services/transaction.service";

async function run() {
  console.log("--- Starting Early Withdrawal Test ---");

  // 1. Setup Data
  const uniqueId = Date.now().toString().slice(-6);
  const email = `test-early-${uniqueId}@example.com`;

  console.log(`Creating test user: ${email}`);

  // Create User
  const user = await db.user.create({
    data: {
      name: "Test Early User",
      email: email,
      password: "password123",
      firstName: "Early",
      lastName: "Tester",
      role: "MEMBER",
    }
  });

  // Ensure SYSTEM user exists (for logging)
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

  // Create Branch
  let branch = await db.branch.findFirst({ where: { name: "Verification Branch" } });
  if (!branch) {
      branch = await db.branch.create({ data: { name: "Verification Branch", location: "Test Location" } });
  }

  // Ensure Account Types
  let voluntaryType = await db.accountType.findFirst({ where: { name: "Voluntary Savings Account" } });
  if (!voluntaryType) {
      // Fallback or create
      voluntaryType = await db.accountType.findFirst({ where: { name: { contains: "Voluntary" } } });
      if (!voluntaryType) {
          voluntaryType = await db.accountType.create({ data: { name: "Voluntary Savings Account", isLoanEligible: true, interestRate: 5 } });
      }
  }

  let fixedType = await db.accountType.findFirst({ where: { hasFixedPeriod: true } });
  if (!fixedType) {
     fixedType = await db.accountType.create({ data: { name: "Fixed Deposit Test", hasFixedPeriod: true, minBalance: 100000, interestRate: 10 } });
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

  // Create FD Account (Terms: 1 year, started 1 month ago)
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const fdAccount = await db.account.create({
    data: {
      memberId: member.id,
      branchId: branch.id,
      accountTypeId: fixedType.id,
      accountNumber: `FD-${uniqueId}`,
      balance: 500000,
      status: "ACTIVE",
      fixingStartDate: startDate,
      fixingEndDate: endDate,
      expectedInterest: 50000 
    }
  });

  console.log(`Created FD ${fdAccount.accountNumber} with Balance ${fdAccount.balance}. Maturity: ${endDate.toISOString()}`);

  // 2. Perform Early Withdrawal (Transfer to VS)
  console.log("Attempting Early Withdrawal (Transfer 500,000 to VS)...");

  // We need a handler ID. We can use the user.id or SYSTEM.
  // TransactionService.processInternalTransfer(data, handlerUserId)
  
  const result = await TransactionService.processInternalTransfer({
      sourceAccountId: fdAccount.id,
      targetAccountId: voluntaryAccount.id,
      amount: 500000,
      description: "Early Withdrawal Test"
  }, user.id);

  console.log("Transfer Result:", JSON.stringify(result, null, 2));

  // 3. Verify
  const updatedFD = await db.account.findUnique({ where: { id: fdAccount.id } });
  const updatedVS = await db.account.findUnique({ where: { id: voluntaryAccount.id } });

  if (updatedFD?.balance === 0) {
      console.log("✅ FD Balance is 0 (Principal withdrawn)");
  } else {
      console.error(`❌ FD Balance mismatch: ${updatedFD?.balance}`);
  }

  // Interest Check: Did we get interest? 
  // expectedVS = 1000 + 500000 = 501000. 
  // If we got interest, it would be more (but processInternalTransfer doesn't touch interest).
  if (updatedVS?.balance === 501000) {
      console.log("✅ VS Balance correct (Only Principal received)");
  } else {
      console.error(`❌ VS Balance mismatch: ${updatedVS?.balance}`);
  }

  // Status Check
  console.log(`FD Status: ${updatedFD?.status}`); // Likely ACTIVE

  // Cleanup
  console.log("Cleaning up...");
  await db.transaction.deleteMany({ where: { accountId: { in: [fdAccount.id, voluntaryAccount.id] } } });
  await db.account.deleteMany({ where: { memberId: member.id } });
  await db.member.delete({ where: { id: member.id } });
  await db.user.delete({ where: { id: user.id } });
  
  console.log("Done.");
}

run();
