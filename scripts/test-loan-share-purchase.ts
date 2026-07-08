
import { db } from "../prisma/db";

async function main() {
  const email = `sharetest-${Date.now()}@example.com`;
  
  console.log("1. Creating User and Member...");
  const user = await db.user.create({
    data: {
      name: "Share Test User",
      email: email,
      password: "password123",
      role: "MEMBER",
      firstName: "Share",
      lastName: "Test"
    }
  });

  const member = await db.member.create({
    data: {
      userId: user.id,
      memberNumber: `MEM-SHR-${Date.now()}`,
      status: "ACTIVE",
      isApproved: true
    }
  });

  console.log("2. Creating Accounts...");
  // Branch
  let branch = await db.branch.findFirst();
  if (!branch) {
      branch = await db.branch.create({ data: { name: "Test Branch", location: "Test" } });
  }

  // Savings Account
  const savingsType = await db.accountType.findFirst({ where: { name: { contains: "Savings" } } });
  if (!savingsType) throw new Error("No Savings Account Type found");

  await db.account.create({
    data: {
      memberId: member.id,
      branchId: branch.id,
      accountTypeId: savingsType.id,
      accountNumber: `SAV-${Date.now()}`,
      balance: 1000000, // Sufficient balance
      status: "ACTIVE"
    }
  });

  // Shares Account (Simulating EXISTING SHARES)
  const shareType = await db.accountType.findFirst({ where: { isShareAccount: true } });
  if (!shareType) {
      // Create if missing for test
      const type = await db.accountType.create({
          data: {
              name: "Share Capital",
              isShareAccount: true,
              minBalance: 0,
              interestRate: 0,
              canWithdraw: false
          }
      });
  }
  const existingShareType = await db.accountType.findFirst({ where: { isShareAccount: true } });
  
  await db.account.create({
    data: {
      memberId: member.id,
      branchId: branch.id,
      accountTypeId: existingShareType!.id,
      accountNumber: `SHR-${Date.now()}`,
      balance: 50000, // Existing shares
      status: "ACTIVE"
    }
  });

  console.log("3. Fetching Loan Product...");
  const product = await db.loanProduct.findFirst({ where: { isActive: true } });
  if (!product) throw new Error("No active loan product found");

  console.log("4. Simulating Loan Application API Call...");
  // calling logic similar to API route
  
  // Validation Logic from API Route (Manual simulation)
  const memberCheck = await db.member.findUnique({
      where: { id: member.id },
      include: { loans: true, accounts: true }
  });

  const activeLoansCount = memberCheck!.loans.length;
  const hasOverdue = memberCheck!.loans.some(l => l.status === "OVERDUE");

  if (hasOverdue) console.error("FAIL: Has Overdue Loans");
  if (activeLoansCount >= 3) console.error("FAIL: Too many loans");

  // Attempt to create Loan Application with applyShareDeduction = true
  try {
      const app = await db.loanApplication.create({
          data: {
              memberId: member.id,
              loanProductId: product.id,
              amountApplied: 500000,
              applicantId: user.id,
              status: "PENDING",
              stage: "SUBMITTED",
              applyShareDeduction: true, // REQUESTING SHARE DEDUCTION
              shareAmount: 20000
          }
      });
      console.log("SUCCESS: Loan Application Created with Share Deduction!", app.id);
      console.log("applyShareDeduction:", app.applyShareDeduction);
  } catch (e) {
      console.error("FAILURE: API Logic Failed", e);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await db.$disconnect();
  });
