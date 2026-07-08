import { CategoryKind, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedCategory = {
  name: string;
  code: string;
  description?: string;
};

const expenseParent: SeedCategory = {
  name: "Expenses",
  code: "500000",
  description: "Top-level expense account group",
};

const expenseItems: SeedCategory[] = [
  { name: "Office stationery", code: "500100" },
  { name: "Books of accounts", code: "500200" },
  { name: "Policy documents", code: "500300" },
  { name: "Utilities", code: "500400" },
  { name: "Maintenance", code: "500500" },
  { name: "Salaries and wages", code: "500600" },
  { name: "NSSF", code: "500700" },
  { name: "PAYE", code: "500800" },
  { name: "Staff incentives", code: "500900" },
  { name: "Administration allowances", code: "501000" },
  { name: "Administration costs", code: "501100" },
  { name: "Transport and travel costs", code: "501200" },
  { name: "Meetings", code: "501300" },
  { name: "Communication", code: "501400" },
  { name: "Trainings", code: "501500" },
  { name: "Exchange visits expense", code: "501600" },
  { name: "Subscriptions to organizations", code: "501700" },
  { name: "Legal costs", code: "501800" },
  { name: "Financial costs", code: "501900" },
  { name: "Public relations", code: "502000" },
  { name: "Publicity and advertisements", code: "502100" },
  { name: "Entertainment", code: "502200" },
  { name: "Projects expenses", code: "502300" },
  { name: "Loan related expenses", code: "502400" },
  { name: "Dividends", code: "502500" },
  { name: "Software expenses", code: "502600" },
  { name: "Health and sanitation", code: "502700" },
  { name: "Depreciation expenses", code: "502800" },
  { name: "Calendars", code: "502900" },
  { name: "Website expenses", code: "503000" },
  { name: "Thanks giving expenses", code: "503100" },
  { name: "Rent", code: "503200" },
  { name: "Construction costs", code: "503300" },
  { name: "Interest payments", code: "503400" },
];

async function upsertExpenseCategory(
  category: SeedCategory,
  parentId: string | null,
) {
  return prisma.budgetCategory.upsert({
    where: { code: category.code },
    update: {
      name: category.name,
      kind: CategoryKind.EXPENSE,
      description: category.description || null,
      isActive: true,
      parentId,
    },
    create: {
      name: category.name,
      code: category.code,
      kind: CategoryKind.EXPENSE,
      description: category.description || null,
      isActive: true,
      parentId,
    },
  });
}

export async function seedExpenditureCategories() {
  console.log("Starting expenditure category seed...");

  const parent = await upsertExpenseCategory(expenseParent, null);

  let createdOrUpdated = 0;
  for (const item of expenseItems) {
    await upsertExpenseCategory(item, parent.id);
    createdOrUpdated += 1;
  }

  console.log(
    `Expense categories seeded successfully: 1 parent and ${createdOrUpdated} items.`,
  );
}
