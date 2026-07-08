import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureBudgetParent(
  code: string,
  name: string,
  kind: "LIABILITY" | "EQUITY",
) {
  let parent = await prisma.budgetCategory.findUnique({
    where: { code },
  });

  if (!parent) {
    console.log(`Creating ${name} budget category...`);
    parent = await prisma.budgetCategory.create({
      data: {
        name,
        code,
        kind,
        isActive: true,
      },
    });
  }

  return parent;
}

async function reclassifyBudgetCategory(options: {
  label: string;
  sourceCode: string;
  sourceNames: string[];
  targetCode: string;
  targetKind: "LIABILITY" | "EQUITY";
  parentId: string;
}) {
  const category = await prisma.budgetCategory.findFirst({
    where: {
      OR: [
        { code: options.sourceCode },
        ...options.sourceNames.map((name) => ({
          name: { equals: name, mode: "insensitive" as const },
        })),
      ],
    },
  });

  if (!category) {
    console.log(`No budget category found for ${options.label}.`);
    return;
  }

  await prisma.budgetCategory.update({
    where: { id: category.id },
    data: {
      code: options.targetCode,
      kind: options.targetKind,
      parentId: options.parentId,
    },
  });

  console.log(`Reclassified budget category: ${options.label}`);
}

async function reclassifyGlAccount(options: {
  label: string;
  sourceCode: string;
  sourceNames: string[];
  targetCode: string;
  targetFullCode: string;
  targetLedgerType: "LIABILITIES" | "EQUITY";
  parentId: string;
  parentLevel: number;
}) {
  const account = await prisma.chartOfAccount.findFirst({
    where: {
      OR: [
        { accountCode: options.sourceCode },
        ...options.sourceNames.map((name) => ({
          accountName: { equals: name, mode: "insensitive" as const },
        })),
      ],
    },
  });

  if (!account) {
    console.log(`No GL account found for ${options.label}.`);
    return;
  }

  await prisma.chartOfAccount.update({
    where: { id: account.id },
    data: {
      accountCode: options.targetCode,
      fullCode: options.targetFullCode,
      ledgerType: options.targetLedgerType,
      parentId: options.parentId,
      level: options.parentLevel + 1,
    },
  });

  console.log(`Reclassified GL account: ${options.label}`);
}

async function main() {
  console.log("Starting legacy income category reclassification...");

  const liabilityParent = await ensureBudgetParent(
    "202000",
    "Non-current Liabilities",
    "LIABILITY",
  );
  const equityParent = await ensureBudgetParent("300000", "Equity", "EQUITY");

  await reclassifyBudgetCategory({
    label: "Loan insurance fees",
    sourceCode: "401003",
    sourceNames: ["Loan insurance fees", "Loans Insurance"],
    targetCode: "202002",
    targetKind: "LIABILITY",
    parentId: liabilityParent.id,
  });

  await reclassifyBudgetCategory({
    label: "Loan share capital",
    sourceCode: "401004",
    sourceNames: ["Loan share capital"],
    targetCode: "300001",
    targetKind: "EQUITY",
    parentId: equityParent.id,
  });

  const glLiabilityParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: "200600" },
  });
  const glEquityParent = await prisma.chartOfAccount.findUnique({
    where: { accountCode: "300500" },
  });

  if (glLiabilityParent) {
    await reclassifyGlAccount({
      label: "Loan insurance fees",
      sourceCode: "401003",
      sourceNames: ["Loan insurance fees", "Loans Insurance"],
      targetCode: "200601",
      targetFullCode: "200601  Loans Insurance",
      targetLedgerType: "LIABILITIES",
      parentId: glLiabilityParent.id,
      parentLevel: glLiabilityParent.level,
    });
  }

  if (glEquityParent) {
    await reclassifyGlAccount({
      label: "Loan share capital",
      sourceCode: "401004",
      sourceNames: ["Loan share capital"],
      targetCode: "300503",
      targetFullCode: "300503  Loan share capital",
      targetLedgerType: "EQUITY",
      parentId: glEquityParent.id,
      parentLevel: glEquityParent.level,
    });
  }

  console.log("Legacy income category reclassification script completed.");
}

main()
  .catch((error) => {
    console.error("Reclassification failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
