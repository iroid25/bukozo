export type ExpenseCategoryLike = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
};

export function getExpenseRootCategory(
  categories: ExpenseCategoryLike[],
): ExpenseCategoryLike | null {
  return (
    categories.find(
      (category) =>
        category.code === "500000" ||
        category.name.trim().toLowerCase() === "expenses",
    ) || null
  );
}

function parseNumericCode(code: string | null | undefined): number | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function codeExists(
  categories: ExpenseCategoryLike[],
  code: string,
  excludeId?: string,
): boolean {
  return categories.some(
    (category) => category.code === code && category.id !== excludeId,
  );
}

function nextCodeFromSiblings(
  categories: ExpenseCategoryLike[],
  parentId: string,
  step: number,
  fallbackBase: number,
  excludeId?: string,
): string {
  const siblingCodes = categories
    .filter((category) => category.parentId === parentId)
    .map((category) => parseNumericCode(category.code))
    .filter((code): code is number => code !== null);

  let nextValue =
    siblingCodes.length > 0
      ? Math.max(...siblingCodes) + step
      : fallbackBase + step;

  while (codeExists(categories, String(nextValue), excludeId)) {
    nextValue += step;
  }

  return String(nextValue);
}

export function generateNextExpenseCategoryCode(
  categories: ExpenseCategoryLike[],
  parentId: string | null,
  rootId?: string | null,
  excludeId?: string,
): string | null {
  if (!parentId) {
    return null;
  }

  const rootCategory = rootId
    ? categories.find((category) => category.id === rootId) || null
    : getExpenseRootCategory(categories);

  const resolvedRootId = rootCategory?.id || rootId || null;
  const parentCategory = categories.find((category) => category.id === parentId);

  if (resolvedRootId && parentId === resolvedRootId) {
    const rootCode = parseNumericCode(rootCategory?.code) ?? 500000;
    return nextCodeFromSiblings(
      categories,
      resolvedRootId,
      100,
      rootCode,
      excludeId,
    );
  }

  if (parentCategory && resolvedRootId && parentCategory.parentId === resolvedRootId) {
    const parentCode = parseNumericCode(parentCategory.code) ?? 500000;
    return nextCodeFromSiblings(
      categories,
      parentId,
      1,
      parentCode,
      excludeId,
    );
  }

  if (parentCategory) {
    const parentCode = parseNumericCode(parentCategory.code) ?? 500000;
    return nextCodeFromSiblings(
      categories,
      parentId,
      1,
      parentCode,
      excludeId,
    );
  }

  return null;
}
