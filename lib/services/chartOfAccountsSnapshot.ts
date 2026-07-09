import fs from "fs";
import path from "path";
import { HIDDEN_COA_CODES } from "@/lib/accounting/coa-identity";
export type SnapshotChartOfAccount = {
  id: string;
  accountCode: string;
  accountName: string;
  fullCode: string;
  parentId: string | null;
  level: number;
  category: string | null;
  product: string | null;
  currency: string;
  debitCredit: string | null;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  ledgerType: string;
};

const SNAPSHOT_DIR = path.join(process.cwd(), "progress");
const SNAPSHOT_FILE = "chart-of-accounts-backup-2026-04-25T19-49-57-476Z.json";
const TARGET_LEDGER_TYPES = new Set([
  "ASSETS",
  "LIABILITIES",
  "INCOME",
  "EXPENDITURES",
]);
const TARGET_COA_CODES = new Set([
  "100000",
  "101000",
  "102000",
  "102001",
  "107000",
  "200000",
  "201000",
  "201010",
  "200600",
  "201100",
  "201200",
  "201300",
  "201400",
  "201500",
  "202000",
  "202030",
  "202040",
  "400000",
  "400200",
  "400300",
  "400301",
  "400302",
  "400400",
  "400401",
  "400402",
  "400403",
  "400405",
  "400406",
  "400407",
  "400408",
  "400500",
  "400600",
  "400700",
  "400800",
  "400801",
  "400802",
  "400803",
  "400804",
  "400950",
  "401000",
  "401001",
  "401002",
  "401005",
  "401200",
  "401301",
  "401302",
  "401303",
  "401304",
  "401305",
  "401306",
  "401400",
  "401401",
  "401402",
  "401403",
  "401500",
  "401600",
  "401700",
  "401800",
  "401900",
  "401960",
  "401961",
  "500000",
  "500100",
  "500101",
  "500102",
  "500103",
  "500104",
  "500105",
  "500106",
  "500107",
  "500108",
  "500200",
  "500201",
  "500202",
  "500203",
  "500204",
  "500205",
  "500206",
  "500207",
  "500500",
  "500501",
  "500502",
  "500503",
  "500504",
  "500505",
  "500506",
  "500507",
  "500508",
  "500509",
  "500600",
  "500700",
  "500701",
  "500702",
  "500703",
  "500704",
  "500705",
  "500706",
  "500707",
  "500708",
  "500709",
  "500710",
  "500800",
  "500801",
  "500802",
  "500803",
  "500804",
  "500805",
  "500806",
  "500807",
  "500808",
  "500809",
  "500810",
  "500900",
  "500901",
  "500902",
  "500903",
  "500904",
  "500905",
  "500906",
  "500907",
  "500908",
  "500909",
  "501000",
  "501001",
  "501002",
  "501003",
  "501004",
  "501005",
  "501006",
  "501200",
  "501201",
  "501202",
  "501203",
  "501300",
  "501301",
  "501302",
  "501303",
  "501500",
  "501501",
  "501502",
  "501503",
  "501504",
  "501505",
  "501506",
  "501507",
  "501508",
  "501509",
  "501600",
  "501700",
  "501800",
  "501900",
  "501901",
  "501902",
  "501903",
  "502200",
  "502201",
  "502202",
  "502203",
  "502204",
  "502205",
  "502206",
  "502207",
  "502400",
  "502401",
  "502402",
  "502403",
  "502404",
  "502405",
  "502406",
  "502407",
  "502408",
  "502409",
  "502410",
  "502411",
  "502412",
  "502413",
  "502414",
  "502415",
  "502416",
  "502500",
  "502501",
  "502502",
  "502503",
  "502600",
  "502601",
  "502602",
  "502603",
  "502604",
  "502605",
  "502606",
  "502607",
  "502800",
  "503100",
  "503101",
  "503102",
  "503103",
  "503104",
  "503105",
  "503106",
  "503107",
  "503300",
  "503600",
  "503800",
  "503900",
  "503901",
  "503902",
  "503903",
  "503904",
  "504000",
  "504001",
  "504002",
  "504003",
  "504004",
  "504005",
  "504006",
  "504007",
  "504008",
  "504009",
  "504010",
  "504011",
  "504012",
  "504013",
  "504014",
  "504015",
  "504016",
  "504017",
  "504018",
  "504019",
  "505010",
  "505011",
  "505012",
  "505013",
  "505014",
  "505015",
  "505016",
  "505017",
  "505018",
  "505019",
  "506001",
  "506002",
  "506004",
  "506005",
  "506006",
  "506007",
  "506008",
]);
let cachedSnapshot: SnapshotChartOfAccount[] | null = null;
let cachedSnapshotPath: string | null = null;
let cachedSnapshotMtime = 0;

function findLatestSnapshotPath(): string | null {
  const explicitPath = path.join(SNAPSHOT_DIR, SNAPSHOT_FILE);
  if (fs.existsSync(explicitPath)) return explicitPath;

  if (!fs.existsSync(SNAPSHOT_DIR)) return null;

  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((file) => file.startsWith("chart-of-accounts-backup-") && file.endsWith(".json"))
    .map((file) => path.join(SNAPSHOT_DIR, file));

  if (files.length === 0) return null;

  return files
    .map((file) => ({
      file,
      mtime: fs.statSync(file).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file ?? null;
}

export function loadChartOfAccountsSnapshot(): SnapshotChartOfAccount[] {
  const snapshotPath = findLatestSnapshotPath();
  if (!snapshotPath) return [];

  const mtime = fs.statSync(snapshotPath).mtimeMs;
  if (cachedSnapshot && cachedSnapshotPath === snapshotPath && cachedSnapshotMtime === mtime) {
    return cachedSnapshot;
  }

  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as any[];
  const snapshot = raw.map((account) => ({
    id: String(account.id),
    accountCode: String(account.accountCode ?? ""),
    accountName: String(account.accountName ?? ""),
    fullCode: String(account.fullCode ?? account.accountCode ?? ""),
    parentId: account.parentId ?? null,
    level: Number(account.level ?? 0),
    category: account.category ?? null,
    product: account.product ?? null,
    currency: String(account.currency ?? "UGX"),
    debitCredit: account.debitCredit ?? null,
    description: account.description ?? null,
    notes: account.notes ?? null,
    isActive: Boolean(account.isActive ?? true),
    isSystem: Boolean(account.isSystem ?? true),
    createdAt: account.createdAt ?? new Date().toISOString(),
    updatedAt: account.updatedAt ?? new Date().toISOString(),
    balance: Number(account.balance ?? 0),
    debitBalance: Number(account.debitBalance ?? 0),
    creditBalance: Number(account.creditBalance ?? 0),
    ledgerType: String(account.ledgerType ?? "ASSETS"),
  })) as SnapshotChartOfAccount[];

  cachedSnapshot = snapshot;
  cachedSnapshotPath = snapshotPath;
  cachedSnapshotMtime = mtime;
  return snapshot;
}

export function getSnapshotAccountById(id: string) {
  return loadChartOfAccountsSnapshot().find((account) => account.id === id) || null;
}

export function getSnapshotAccountByCode(code: string) {
  return loadChartOfAccountsSnapshot().find((account) => account.accountCode === code) || null;
}

export function filterSnapshotAccounts(options: {
  ledgerType?: string;
  level?: number;
  search?: string;
  isActive?: boolean;
  coreOnly?: boolean;
  numericOnly?: boolean;
}) {
  const {
    ledgerType,
    level,
    search,
    isActive,
    coreOnly = false,
    numericOnly = true,
  } = options;

  return loadChartOfAccountsSnapshot().filter((account) => {
    if (HIDDEN_COA_CODES.has(account.accountCode)) return false;
    if (ledgerType && account.ledgerType !== ledgerType) return false;
    if (typeof level === "number" && account.level !== level) return false;
    if (typeof isActive === "boolean" && account.isActive !== isActive) return false;
    if (coreOnly && !TARGET_LEDGER_TYPES.has(account.ledgerType)) return false;
    if (!TARGET_LEDGER_TYPES.has(account.ledgerType)) return false;
    if (!TARGET_COA_CODES.has(account.accountCode)) return false;
    if (numericOnly && !/^\d+$/.test(account.accountCode)) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${account.accountCode} ${account.accountName} ${account.fullCode}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function paginateSnapshotAccounts(
  accounts: SnapshotChartOfAccount[],
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;
  return {
    data: accounts.slice(skip, skip + limit),
    pagination: {
      page,
      limit,
      total: accounts.length,
      totalPages: Math.max(1, Math.ceil(accounts.length / limit)),
    },
  };
}

export function buildSnapshotTrialBalance(ledgerType?: string) {
  const accounts = filterSnapshotAccounts({
    ledgerType,
    isActive: true,
    coreOnly: false,
    numericOnly: true,
  });

  const grouped = accounts.reduce((acc, account) => {
    if (!acc[account.ledgerType]) acc[account.ledgerType] = [];
    acc[account.ledgerType].push(account);
    return acc;
  }, {} as Record<string, SnapshotChartOfAccount[]>);

  const totals = {
    totalDebits: 0,
    totalCredits: 0,
    byLedgerType: {} as Record<string, { debits: number; credits: number }>,
  };

  Object.entries(grouped).forEach(([type, accts]) => {
    const debits = accts.reduce((sum, a) => sum + a.debitBalance, 0);
    const credits = accts.reduce((sum, a) => sum + a.creditBalance, 0);
    totals.byLedgerType[type] = { debits, credits };
    totals.totalDebits += debits;
    totals.totalCredits += credits;
  });

  return {
    accounts: grouped,
    totals,
    isBalanced: Math.abs(totals.totalDebits - totals.totalCredits) < 0.01,
    difference: totals.totalDebits - totals.totalCredits,
    asOfDate: new Date().toISOString(),
  };
}

export function getSnapshotChildren(parentId: string) {
  return loadChartOfAccountsSnapshot()
    .filter((account) => account.parentId === parentId)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export function getSnapshotItems(accountId: string) {
  const account = getSnapshotAccountById(accountId);
  if (!account) return null;

  const children = getSnapshotChildren(account.id);
  const items = children.length
    ? children.map((child) => ({
        id: child.id,
        name: child.accountName,
        code: child.accountCode,
        date: child.updatedAt || child.createdAt,
        amount: child.balance,
        status: child.isActive ? "Active" : "Inactive",
        details: `Type: ${child.ledgerType} | Balance: ${child.balance}`,
      }))
    : [
        {
          id: account.id,
          name: account.accountName,
          code: account.accountCode,
          date: account.updatedAt || account.createdAt,
          amount: account.balance,
          status: account.isActive ? "Active" : "Inactive",
          details: `Type: ${account.ledgerType} | Debit: ${account.debitBalance} | Credit: ${account.creditBalance}`,
        },
      ];

  return {
    account,
    itemsType: children.length ? "SNAPSHOT_CHILDREN" : "SNAPSHOT_ACCOUNT",
    items,
  };
}

export function getSnapshotAccountDetails(accountId: string) {
  const account = getSnapshotAccountById(accountId);
  if (!account) return null;

  const children = getSnapshotChildren(account.id);
  return {
    data: {
      ...account,
      parent: account.parentId
        ? (() => {
            const parent = getSnapshotAccountById(account.parentId as string);
            return parent
              ? {
                  id: parent.id,
                  accountCode: parent.accountCode,
                  accountName: parent.accountName,
                  fullCode: parent.fullCode,
                }
              : null;
          })()
        : null,
      children: children.map((child) => ({
        id: child.id,
        accountCode: child.accountCode,
        accountName: child.accountName,
        fullCode: child.fullCode,
        level: child.level,
        balance: child.balance,
      })),
      _count: {
        children: children.length,
        journalEntries: 0,
        debitTransactions: 0,
        creditTransactions: 0,
      },
      balance: account.balance,
      debitBalance: account.debitBalance,
      creditBalance: account.creditBalance,
    },
  };
}
