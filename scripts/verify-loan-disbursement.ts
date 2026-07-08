
import { db } from "../prisma/db";
import { LoanService } from "../services/loan.service";
import { LoanStatus } from "@prisma/client";

async function main() {
  console.log("🚀 Starting Loan Disbursement Verification...");

  // 1. Setup / Fetch Prerequisites
  const manager = await db.user.findFirst({ where: { role: "BRANCHMANAGER" } });
  const teller = await db.user.findFirst({ where: { role: "TELLER" } });
  
  // Find a member with an active account
  const member = await db.member.findFirst({
    where: { 
        accounts: { some: { status: "ACTIVE", accountType: { isShareAccount: false } } } 
    },
    include: { user: true, accounts: { include: { accountType: true } } }
  });

  const product = await db.loanProduct.findFirst({ where: { isActive: true } });

  if (!manager || !teller || !member || !product) {
    console.error("❌ Missing prerequisites:", { 
        manager: !!manager, 
        teller: !!teller, 
        member: !!member, 
        product: !!product 
    });
    return;
  }

  console.log(`✅ Prerequisites found:
    Manager: ${manager.name}
    Teller: ${teller.name}
    Member: ${member.user.name}
    Product: ${product.name}
  `);

  // Ensure Teller has Float
  let float = await db.userFloat.findUnique({ where: { userId: teller.id } });
  if (!float) {
    console.log("⚠️ Teller has no float, creating...");
    float = await db.userFloat.create({ 
        data: { userId: teller.id, balance: 10000000 } 
    });
  } else if (float.balance < 500000) {
    console.log("⚠️ Teller float low, topping up...");
    float = await db.userFloat.update({
        where: { id: float.id },
        data: { balance: 10000000 }
    });
  }
  console.log(`💰 Teller Float: UGX ${float.balance.toLocaleString()}`);

  // 2. Apply for Loan
  console.log("\n📝 Applying for loan...");
  const amount = 500000;
  const applyParams = {
    memberId: member.id,
    productId: product.id,
    amount: amount,
    purpose: "Verification Test Loan",
    officerId: manager.id, // Simulating officer
    // Add additional required fields for createLoanApplication if testing 'create' directly,
    // but LoanService.apply is simpler wrapper? 
    // Wait, LoanService.apply in the file I read was:
    // static async apply(data: { memberId, productId, amount, purpose, officerId }) ...
  };

  // We better use the actions/loanApplication.ts `createLoanApplication` if we want full validation 
  // OR just create manual DB entry for speed if we TRUST the service methods.
  // The user asked "is it working", implying the whole flow.
  // usage of LoanService.apply from my reading:
  const applicationResult = await LoanService.apply(applyParams);
  if (!applicationResult.ok) {
    console.error("❌ Application failed:", applicationResult.error);
    return;
  }
  const applicationId = applicationResult.data!.id;
  console.log(`✅ Loan Applied: ${applicationId}`);

  // 3. Approve Loan & Assign Teller
  console.log("\n👍 Approving loan & assigning teller...");
  const approveResult = await LoanService.approve({
    applicationId,
    managerId: manager.id,
    approvedAmount: amount,
    tellerId: teller.id
  });

  if (!approveResult.ok) {
    console.error("❌ Approval failed:", approveResult.error);
    return;
  }
  console.log("✅ Loan Approved and Assigned to Teller");

  // Verify Allocation
  const approvedApp = await db.loanApplication.findUnique({
    where: { id: applicationId },
    include: { allocatedTeller: true }
  });
  console.log(`   -> Allocated Teller: ${approvedApp?.allocatedTeller?.name}`);
  if (approvedApp?.allocatedTellerId !== teller.id) {
    console.error("❌ Teller allocation failed verification!");
    return;
  }

  // 4. Verify Teller Dashboard Fetch
  console.log("\n👀 Verifying Teller Dashboard fetch...");
  const dashboardLoans = await LoanService.getLoans({
    allocatedTellerId: teller.id,
    status: "APPROVED"
  });
  const found = dashboardLoans.data?.find((l: any) => l.loanApplicationId === applicationId);
  if (!found) {
    console.error("❌ Loan not found in teller's dashboard list!");
    return;
  }
  console.log(`✅ Loan found in teller's queue: Loan ID ${found.id}`);

  // Capture Balances Before
  const memberAccount = member.accounts.find(a => !a.accountType.isShareAccount && a.status === "ACTIVE") || member.accounts[0];
  const msgFloatBefore = await db.userFloat.findUnique({ where: { userId: teller.id } });
  const msgAccountBefore = await db.account.findUnique({ where: { id: memberAccount.id } });

  console.log(`\nBefore Disbursement:
    Teller Float: ${msgFloatBefore?.balance.toLocaleString()}
    Member Balance: ${msgAccountBefore?.balance.toLocaleString()}
  `);

  // 5. Disburse Loan
  console.log("\n💸 Disbursing loan...");
  const disburseResult = await LoanService.disburse(applicationId, teller.id);

  if (!disburseResult.ok) {
    console.error("❌ Disbursement failed:", disburseResult.error);
    return;
  }

  // 6. Verify Financials
  const msgFloatAfter = await db.userFloat.findUnique({ where: { userId: teller.id } });
  const msgAccountAfter = await db.account.findUnique({ where: { id: memberAccount.id } });
  
  const netDisbursed = disburseResult.data!.netDisbursement;
  console.log(`\n✅ Disbursement Successful!
    Net Disbursed: ${netDisbursed.toLocaleString()}
    Processing Fee: ${disburseResult.data!.processingFee.toLocaleString()}
  `);

  console.log(`After Disbursement:
    Teller Float: ${msgFloatAfter?.balance.toLocaleString()} (Change: ${(msgFloatAfter!.balance - msgFloatBefore!.balance).toLocaleString()})
    Member Balance: ${msgAccountAfter?.balance.toLocaleString()} (Change: ${(msgAccountAfter!.balance - msgAccountBefore!.balance).toLocaleString()})
  `);

  // Assertions
  const floatDiff = msgFloatBefore!.balance - msgFloatAfter!.balance;
  const expectedDiff = netDisbursed; // Float drops by net amount given out

  if (Math.abs(floatDiff - expectedDiff) < 1) { // Floating point tolerance
     console.log("✅ Float deduction verified.");
  } else {
     console.error(`❌ Float deduction mismatch! Expected ${expectedDiff}, got ${floatDiff}`);
  }

  const accountDiff = msgAccountAfter!.balance - msgAccountBefore!.balance;
  if (Math.abs(accountDiff - netDisbursed) < 1) {
    console.log("✅ Member account credit verified.");
  } else {
    console.error(`❌ Member credit mismatch! Expected ${netDisbursed}, got ${accountDiff}`);
  }

  // CLEANUP (Optional - leave it for manual inspection or delete?)
  // For now, let's keep it to show the user.
}

main().catch(console.error);
