import { db } from "@/prisma/db";

export const EQUITY_ROOT_CODE = "300000";
export const STATUTORY_RESERVES_CODE = "301000";
export const GRANTS_AND_DONATIONS_CODE = "302000";
export const RETAINED_EARNINGS_CODE = "303000";
export const SHARE_CAPITAL_CODE = "304000";
export const SACCO_RESERVES_CODE = "301004";
export const ASSOCIATE_SHARE_PRODUCT_CODE = "300503";

export async function resolveShareCapitalAccount() {
  await ensureEquityStructure();

  const shareCapital = await db.chartOfAccount.findUnique({
    where: { accountCode: SHARE_CAPITAL_CODE },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      isActive: true,
      ledgerType: true,
      debitBalance: true,
      creditBalance: true,
    },
  });

  if (!shareCapital?.isActive) {
    throw new Error("Share capital account (304000) is missing or inactive.");
  }

  return shareCapital;
}

export async function resolveAssociateShareAccountType(client: {
  accountType: {
    findFirst: (args: any) => Promise<any>;
  };
}) {
  const associateShareType = await client.accountType.findFirst({
    where: {
      isShareAccount: true,
      OR: [
        { ledgerAccount: { accountCode: ASSOCIATE_SHARE_PRODUCT_CODE } },
        { name: { contains: "associate", mode: "insensitive" } },
      ],
    },
    include: {
      ledgerAccount: true,
    },
  });

  if (associateShareType) {
    return associateShareType;
  }

  const fallbackShareType = await client.accountType.findFirst({
    where: { isShareAccount: true },
    include: {
      ledgerAccount: true,
    },
  });

  if (!fallbackShareType) {
    throw new Error("Share account type not configured in system.");
  }

  return fallbackShareType;
}

export async function ensureEquityStructure() {
  const root = await db.chartOfAccount.upsert({
    where: { accountCode: EQUITY_ROOT_CODE },
    create: {
      accountCode: EQUITY_ROOT_CODE,
      accountName: "Equity",
      fullCode: EQUITY_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "EQUITY",
      debitCredit: "CR",
      category: "Equity",
      isActive: true,
      isSystem: true,
    },
    update: {
      accountName: "Equity",
      fullCode: EQUITY_ROOT_CODE,
      parentId: null,
      level: 0,
      ledgerType: "EQUITY",
      debitCredit: "CR",
      category: "Equity",
      isActive: true,
      isSystem: true,
    },
  });

  const buckets = [
    {
      code: STATUTORY_RESERVES_CODE,
      name: "Statutory reserves",
    },
    {
      code: GRANTS_AND_DONATIONS_CODE,
      name: "Grants and donations",
    },
    {
      code: RETAINED_EARNINGS_CODE,
      name: "Retained earnings",
    },
    {
      code: SHARE_CAPITAL_CODE,
      name: "Share capital",
    },
  ] as const;

  for (const bucket of buckets) {
    await db.chartOfAccount.upsert({
      where: { accountCode: bucket.code },
      create: {
        accountCode: bucket.code,
        accountName: bucket.name,
        fullCode: bucket.code,
        parentId: root.id,
        level: 1,
        ledgerType: "EQUITY",
        debitCredit: "CR",
        category: "Equity",
        isActive: true,
        isSystem: true,
      },
      update: {
        accountName: bucket.name,
        fullCode: bucket.code,
        parentId: root.id,
        level: 1,
        ledgerType: "EQUITY",
        debitCredit: "CR",
        category: "Equity",
        isActive: true,
        isSystem: true,
      },
    });
  }

  return { root };
}
