
import { db } from "./prisma/db";
import { AccountLedgerType } from "@prisma/client";

const COA_DATA = [
  // 100000 - ASSETS
  {
    code: "100000",
    name: "Assets",
    type: AccountLedgerType.ASSETS,
    level: 1,
    children: [
      {
        code: "101000",
        name: "Fixed assets",
        level: 2,
        children: [
          { code: "101100", name: "Land and Buildings", level: 3 },
          { code: "101200", name: "Motor Vehicles", level: 3 },
          { code: "101300", name: "Furniture and Fittings", level: 3 },
          { code: "101400", name: "Computers and Equipment", level: 3 },
          { code: "101500", name: "Machinery and Tools", level: 3 },
        ]
      },
      {
        code: "102000",
        name: "Current assets",
        level: 2,
        children: [
          { code: "102001", name: "Cash at hand", level: 3 },
          { code: "102002", name: "Cash at bank", level: 3 },
          { code: "102003", name: "Loans", level: 3 },
          { code: "102005", name: "Accounts Receivable", level: 3 },
        ]
      }
    ]
  },
  // 200000 - LIABILITIES
  {
    code: "200000",
    name: "Liabilities",
    type: AccountLedgerType.LIABILITIES,
    level: 1,
    children: [
      {
        code: "201000",
        name: "Current Liabilities",
        level: 2,
        children: [
          { code: "201001", name: "Member Savings", level: 3 },
          { code: "201002", name: "Accounts Payable", level: 3 },
          { code: "201003", name: "Tax Payable", level: 3 },
        ]
      },
      {
        code: "202000",
        name: "Long Term Liabilities",
        level: 2,
        children: [
          { code: "202001", name: "Long Term Loans", level: 3 },
        ]
      }
    ]
  },
  // 300000 - EQUITY
  {
    code: "300000",
    name: "Equity",
    type: AccountLedgerType.EQUITY,
    level: 1,
    children: [
      { code: "301000", name: "Share Capital", level: 2 },
      { code: "302000", name: "Retained Earnings", level: 2 },
      { code: "303000", name: "Reserves", level: 2 },
    ]
  },
  // 400000 - INCOME
  {
    code: "400000",
    name: "Income",
    type: AccountLedgerType.INCOME,
    level: 1,
    children: [
      {
        code: "401000",
        name: "Operating Income",
        level: 2,
        children: [
          { code: "401001", name: "Interest on Loans", level: 3 },
          { code: "401002", name: "Membership Fees", level: 3 },
          { code: "401003", name: "Transaction Fees", level: 3 },
          { code: "401004", name: "Withdrawal Charges", level: 3 },
        ]
      },
      {
        code: "402000",
        name: "Non-Operating Income",
        level: 2,
        children: [
          { code: "402001", name: "Investment Income", level: 3 },
          { code: "402002", name: "Other Income", level: 3 },
        ]
      }
    ]
  },
  // 500000 - EXPENSES
  {
    code: "500000",
    name: "Expenses",
    type: AccountLedgerType.EXPENSES,
    level: 1,
    children: [
      {
        code: "501000",
        name: "Operating Expenses",
        level: 2,
        children: [
          { code: "501001", name: "Salaries and Wages", level: 3 },
          { code: "501002", name: "Rent and Utilities", level: 3 },
          { code: "501003", name: "Office Supplies", level: 3 },
          { code: "501004", name: "Communication", level: 3 },
          { code: "501005", name: "Travel and Transport", level: 3 },
        ]
      },
      {
        code: "502000",
        name: "Financial Expenses",
        level: 2,
        children: [
          { code: "502001", name: "Interest Expense", level: 3 },
          { code: "502002", name: "Bank Charges", level: 3 },
        ]
      }
    ]
  }
];

async function createAccountRecursive(account: any, parentId: string | null = null, ledgerType: AccountLedgerType) {
  try {
    const created = await db.chartOfAccount.upsert({
      where: { accountCode: account.code },
      update: {},
      create: {
        accountCode: account.code,
        fullCode: account.code, // Simple mapping for now
        accountName: account.name,
        level: account.level,
        ledgerType: ledgerType,
        parentId: parentId,
        isActive: true,
      }
    });

    console.log(`Created/Updated: ${account.code} - ${account.name}`);

    if (account.children) {
      for (const child of account.children) {
        await createAccountRecursive(child, created.id, ledgerType);
      }
    }
  } catch (error) {
    console.error(`Error creating ${account.code}:`, error);
  }
}

async function main() {
  console.log("🚀 Starting COA Seeding...");
  
  for (const root of COA_DATA) {
    await createAccountRecursive(root, null, root.type);
  }
  
  console.log("✅ COA Seeding Completed.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
