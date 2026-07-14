import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const fd = await p.fixedDeposit.findMany({ select: { id: true, principalAmount: true, status: true, startDate: true, branchId: true, accountNumber: true, memberId: true, maturityDate: true } });
  console.log("FixedDeposit records:", fd.length);
  fd.forEach((r, i) => console.log("  [" + (i+1) + "] amt=" + r.principalAmount + " status=" + r.status + " start=" + (r.startDate?.toISOString().slice(0,10) || "N/A") + " acctNo=" + r.accountNumber + " member=" + r.memberId + " branch=" + r.branchId));

  const accts = await p.account.findMany({ where: { accountType: { hasFixedPeriod: true } }, select: { id: true, accountNumber: true, balance: true, status: true, branchId: true, accountType: { select: { name: true, hasFixedPeriod: true } } } });
  console.log("\nAccounts with hasFixedPeriod=true:", accts.length);
  accts.forEach((r, i) => console.log("  [" + (i+1) + "] " + r.accountNumber + " bal=" + r.balance + " status=" + r.status + " type=" + r.accountType.name + " branch=" + r.branchId));

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
