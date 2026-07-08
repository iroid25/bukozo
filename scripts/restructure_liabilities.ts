import { PrismaClient, AccountLedgerType } from "@prisma/client";

const prisma = new PrismaClient();

const AccountLevel = {
  Main: 1,
  Sub: 2,
  Detail: 3,
} as const;

async function restructureLiabilities() {
  console.log("--- Starting Liability Restructuring ---");

  const liabilitiesRoot = await prisma.chartOfAccount.findUnique({
    where: { accountCode: "200000" },
  });
  if (!liabilitiesRoot) {
    console.error("Root Liabilities (200000) not found!");
    return;
  }

  const currentLiabilities = await prisma.chartOfAccount.upsert({
    where: { accountCode: "201000" },
    update: {
      accountName: "Current Liabilities",
      level: AccountLevel.Main,
      parentId: liabilitiesRoot.id,
    },
    create: {
      accountCode: "201000",
      fullCode: "201000",
      accountName: "Current Liabilities",
      level: AccountLevel.Main,
      ledgerType: AccountLedgerType.LIABILITIES,
      parentId: liabilitiesRoot.id,
      isActive: true,
    },
  });
  console.log("Updated/Created Current Liabilities (201000)");

  const nonCurrentLiabilities = await prisma.chartOfAccount.upsert({
    where: { accountCode: "202000" },
    update: {
      accountName: "Non-current Liabilities",
      level: AccountLevel.Main,
      parentId: liabilitiesRoot.id,
    },
    create: {
      accountCode: "202000",
      fullCode: "202000",
      accountName: "Non-current Liabilities",
      level: AccountLevel.Main,
      ledgerType: AccountLedgerType.LIABILITIES,
      parentId: liabilitiesRoot.id,
      isActive: true,
    },
  });
  console.log("Updated/Created Non-current Liabilities (202000)");

  const assetsRoot = await prisma.chartOfAccount.findUnique({
    where: { accountCode: "100000" },
  });
  if (assetsRoot) {
    await prisma.chartOfAccount.updateMany({
      where: {
        accountName: {
          contains: "Accumulated Depreciation",
          mode: "insensitive",
        },
        ledgerType: AccountLedgerType.LIABILITIES,
      },
      data: {
        accountCode: "109010",
        ledgerType: AccountLedgerType.ASSETS,
        parentId: assetsRoot.id,
        accountName: "Accumulated Depreciation",
      },
    });
    console.log("Moved Accumulated Depreciation to Assets (109010)");
  }

  await prisma.chartOfAccount.updateMany({
    where: { accountCode: "418000" },
    data: {
      accountCode: "201600",
      ledgerType: AccountLedgerType.LIABILITIES,
      parentId: currentLiabilities.id,
      accountName: "Loans Insurance",
    },
  });
  console.log("Fixed Loans Insurance (418000 -> 201600)");

  const savingsAccounts = await prisma.chartOfAccount.findMany({
    where: {
      OR: [
        { accountName: { contains: "savings", mode: "insensitive" } },
        { accountName: { contains: "dividends payable", mode: "insensitive" } },
      ],
      ledgerType: AccountLedgerType.LIABILITIES,
      accountCode: { startsWith: "201" },
      id: { not: currentLiabilities.id },
    },
  });

  for (const acc of savingsAccounts) {
    await prisma.chartOfAccount.update({
      where: { id: acc.id },
      data: { parentId: currentLiabilities.id },
    });
  }
  console.log(
    `Moved ${savingsAccounts.length} savings/payable accounts under Current Liabilities`,
  );

  const longTermLoans = await prisma.chartOfAccount.findMany({
    where: {
      accountName: { contains: "Long Term", mode: "insensitive" },
      ledgerType: AccountLedgerType.LIABILITIES,
    },
  });

  for (const acc of longTermLoans) {
    await prisma.chartOfAccount.update({
      where: { id: acc.id },
      data: { parentId: nonCurrentLiabilities.id },
    });
  }
  console.log(
    `Moved ${longTermLoans.length} long term loan accounts under Non-current Liabilities`,
  );

  const redundantExternal = await prisma.chartOfAccount.findFirst({
    where: { accountCode: "202030" },
  });
  if (redundantExternal) {
    await prisma.chartOfAccount.update({
      where: { id: redundantExternal.id },
      data: {
        parentId: nonCurrentLiabilities.id,
        accountName: "External Loan (Long Term)",
      },
    });
    console.log("Re-coded External Loan (202030) as Non-current");
  }

  console.log("--- Restructuring Complete ---");
}

restructureLiabilities().catch(console.error);
