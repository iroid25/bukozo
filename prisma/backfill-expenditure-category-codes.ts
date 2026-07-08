import { CategoryKind, PrismaClient } from "@prisma/client";
import { generateNextExpenseCategoryCode } from "../lib/expenditure/category-code";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

type ExpenseCategoryRow = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
};

function isNumericCode(code: string | null | undefined): boolean {
  return !!code && /^\d+$/.test(code.trim());
}

async function ensureExpenseRoot(categories: ExpenseCategoryRow[]) {
  const existingRoot =
    categories.find((category) => category.code === "500000") ||
    categories.find(
      (category) => category.name.trim().toLowerCase() === "expenses",
    );

  if (existingRoot) {
    if (existingRoot.code !== "500000") {
      const updated = await prisma.budgetCategory.update({
        where: { id: existingRoot.id },
        data: { code: "500000" },
      });

      existingRoot.code = updated.code;
    }

    return existingRoot;
  }

  const created = await prisma.budgetCategory.create({
    data: {
      name: "Expenses",
      code: "500000",
      kind: CategoryKind.EXPENSE,
      description: "Top-level expense account group",
      isActive: true,
      parentId: null,
    },
  });

  categories.push({
    id: created.id,
    name: created.name,
    code: created.code,
    parentId: created.parentId,
  });

  return created;
}

async function backfillChildren(
  categories: ExpenseCategoryRow[],
  parentId: string,
  rootId: string,
) {
  const children = categories
    .filter((category) => category.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const child of children) {
    const needsCode = !isNumericCode(child.code);
    if (needsCode) {
      const generated = generateNextExpenseCategoryCode(
        categories,
        parentId,
        rootId,
        child.id,
      );

      if (!generated) {
        console.warn(`Skipping ${child.name}: unable to generate a code`);
      } else {
        await prisma.budgetCategory.update({
          where: { id: child.id },
          data: { code: generated },
        });
        child.code = generated;
      }
    }

    await backfillChildren(categories, child.id, rootId);
  }
}

async function main() {
  console.log("Starting expenditure category code backfill...");

  const categories = await prisma.budgetCategory.findMany({
    where: { kind: CategoryKind.EXPENSE },
    select: {
      id: true,
      name: true,
      code: true,
      parentId: true,
    },
  });

  const root = await ensureExpenseRoot(categories);
  const rootId = root.id;

  await backfillChildren(categories, rootId, rootId);

  console.log("Expense category code backfill complete.");
}

main()
  .catch((error) => {
    console.error("Failed to backfill expense category codes:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
