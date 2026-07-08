export interface AssetClassificationOption {
  id: string;
  accountCode: string;
  accountName: string;
  level: number;
}

export const DEFAULT_ASSET_PARENT_OPTIONS: Record<
  "FIXED" | "CURRENT",
  AssetClassificationOption[]
> = {
  FIXED: [
    {
      id: "fixed-root",
      accountCode: "101000",
      accountName: "Fixed Assets",
      level: 1,
    },
  ],
  CURRENT: [
    {
      id: "current-root",
      accountCode: "102000",
      accountName: "Current Assets",
      level: 1,
    },
  ],
};

export const sortClassificationOptions = (items: AssetClassificationOption[]) =>
  [...items].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.accountCode.localeCompare(b.accountCode);
  });

export const getClassificationHierarchyLabel = (
  item: AssetClassificationOption,
) => {
  const rootLabel = "Assets";

  if (item.accountCode === "101000") return `${rootLabel} > Fixed Assets`;
  if (item.accountCode === "102000") return `${rootLabel} > Current Assets`;

  if (item.accountCode.startsWith("101")) {
    return `${rootLabel} > Fixed Assets > ${item.accountName}`;
  }

  if (item.accountCode.startsWith("102")) {
    return `${rootLabel} > Current Assets > ${item.accountName}`;
  }

  return `${rootLabel} > ${item.accountName}`;
};
