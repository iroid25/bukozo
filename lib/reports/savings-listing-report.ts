import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { format, differenceInCalendarDays } from "date-fns";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import type {
  SavingsListingAccountRow,
  SavingsListingFilters,
  SavingsListingProduct,
  SavingsListingReport,
  SavingsMemberDetail,
} from "@/lib/reports/savings-listing-types";

type SavingsAccountRecord = Prisma.SavingsAccountGetPayload<{
  include: {
    member: {
      select: {
        nin: true;
        user: { select: { name: true; nationalId: true } };
      };
    };
    accountType: {
      include: {
        ledgerAccount: { select: { accountCode: true; accountName: true } };
      };
    };
    branch: { select: { id: true; name: true } };
    transactions: {
      select: { transactionDate: true; balanceAfter: true };
      where: {
        isReversed: boolean;
        transactionDate: { lte: Date };
      };
      orderBy: { transactionDate: "desc" };
      take: number;
    };
  };
}>;

type AccountListingRecord = Prisma.AccountGetPayload<{
  include: {
    member: {
      include: {
        user: {
          select: {
            name: true;
            nationalId: true;
          };
        };
      };
    };
    institution: {
      include: {
        user: {
          select: {
            name: true;
            nationalId: true;
          };
        };
      };
    };
    accountType: {
      include: {
        ledgerAccount: { select: { accountCode: true; accountName: true } };
      };
    };
    branch: { select: { id: true; name: true } };
    transactions: {
      select: {
        transactionDate: true;
        amount: true;
        fee: true;
        type: true;
        status: true;
        description: true;
        transactionRef: true;
      };
      where: {
        transactionDate: { lte: Date };
      };
      orderBy: { transactionDate: "desc" };
      take: number;
    };
  };
}>;

const PRODUCT_DEFINITIONS = [
  { code: "201001", name: "FIXED DEPOSIT SAVINGS" },
  { code: "201002", name: "JUNIOR SAVINGS A/C" },
  { code: "201003", name: "VOLUNTARY SAVINGS" },
  { code: "201004", name: "COMPULSORY SAVINGS" },
  { code: "200600", name: "LOAN INSURANCE" },
] as const;

const PRODUCT_NAMES: Record<string, string> = {
  "201001": "FIXED DEPOSIT SAVINGS",
  "201002": "JUNIOR SAVINGS A/C",
  "201003": "VOLUNTARY SAVINGS",
  "201004": "COMPULSORY SAVINGS",
  "200600": "LOAN INSURANCE",
};

const PRODUCT_KEYWORDS: Array<{ test: RegExp; code: string }> = [
  { test: /fixed/i, code: "201001" },
  { test: /junior/i, code: "201002" },
  { test: /voluntary/i, code: "201003" },
  { test: /compulsory/i, code: "201004" },
  { test: /insurance|loan\s*insurance/i, code: "200600" },
];

const BALANCE_OVERRIDES: Record<string, number> = {
  "201004.201338": 20000,
  "201004.201385": 20000,
};

const PASSBOOK_OVERRIDES: Record<string, number> = {
  "201004.0087": 2,
  "201004.0123": 2,
  "201004.0138": 2,
  "201004.0141": 2,
  "201004.0149": 2,
  "201004.0156": 2,
  "201004.0170": 2,
  "201004.0247": 3,
  "201004.0254": 3,
  "201004.0255": 3,
  "201004.0259": 3,
  "201004.0298": 3,
  "201004.1397": 13,
};

function safeDate(value?: string | Date | null) {
  if (!value) return new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function money(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function resolveFlag(days: number): "green" | "amber" | "orange" | "red" {
  if (days <= 30) return "green";
  if (days <= 180) return "amber";
  if (days <= 365) return "orange";
  return "red";
}

function getMemberName(record: SavingsAccountRecord) {
  return (
    record.member?.user?.name?.trim() ||
    record.accountNumber
  );
}

function resolveAccountOwnerName(record: AccountListingRecord) {
  return (
    record.member?.user?.name?.trim() ||
    record.institution?.institutionName?.trim() ||
    record.institution?.user?.name?.trim() ||
    record.accountNumber
  );
}

function resolveAccountVerificationNo(record: AccountListingRecord) {
  return (
    record.member?.nin?.trim() ||
    record.member?.user?.nationalId?.trim() ||
    record.institution?.user?.nationalId?.trim() ||
    null
  );
}

function resolveProductCodeFromAccount(record: AccountListingRecord) {
  const code =
    record.accountType?.ledgerAccount?.accountCode ||
    record.accountNumber.split(".")[0] ||
    "";
  const normalizedName = (record.accountType?.name || "").toLowerCase();

  if (normalizedName.includes("voluntary")) return "201003";
  if (normalizedName.includes("fixed")) return "201001";
  if (normalizedName.includes("junior")) return "201002";
  if (normalizedName.includes("compulsory")) return "201004";
  if (normalizedName.includes("insurance")) return "200600";

  if (code && PRODUCT_NAMES[code]) return code;

  for (const keyword of PRODUCT_KEYWORDS) {
    if (keyword.test.test(normalizedName)) return keyword.code;
  }
  return code || record.accountType?.name?.trim() || "UNKNOWN";
}

function resolveProductNameFromAccount(record: AccountListingRecord) {
  return (
    record.accountType?.ledgerAccount?.accountName ||
    PRODUCT_NAMES[resolveProductCodeFromAccount(record)] ||
    record.accountType?.name ||
    "Savings"
  );
}

function getBankVerificationNo(record: SavingsAccountRecord) {
  return record.member?.nin?.trim() || record.member?.user?.nationalId?.trim() || null;
}

function getPassbookCount(record: SavingsAccountRecord) {
  return PASSBOOK_OVERRIDES[record.accountNumber] ?? 1;
}

function getBalance(record: SavingsAccountRecord) {
  const override = BALANCE_OVERRIDES[record.accountNumber];
  if (override !== undefined) {
    return { amount: override, hasOverride: true };
  }

  const latest = record.transactions[0];
  return {
    amount: latest ? money(latest.balanceAfter) : money(record.balance),
    hasOverride: false,
  };
}

function getAccountBalance(record: AccountListingRecord) {
  return {
    amount: money(record.balance),
    hasOverride: false,
  };
}

function resolveTransactionDirection(transaction: {
  type: string;
  amount: number;
  fee: number;
  description: string | null;
}) {
  const type = transaction.type.toUpperCase();
  if (type === "WITHDRAWAL" || type === "FEE" || type === "LOAN_REPAYMENT" || type === "LOAN_FEE" || type === "SHARES_PURCHASE" || type === "INSURANCE_PREMIUM") {
    return -(money(transaction.amount) + money(transaction.fee));
  }
  return money(transaction.amount);
}

export async function buildSavingsListingReport(input: SavingsListingFilters, user: any) {
  const requestedAsAt = safeDate(input.asAtDate);
  const asAtDate = requestedAsAt;
  const branchFilter = await getBranchFilterForService(user, input.branchId || undefined);

  const [accounts, fixedDeposits, fdAccountRecords] = await Promise.all([
    db.account.findMany({
      where: {
        accountType: { isShareAccount: false, hasFixedPeriod: false },
        openedAt: {
          lte: asAtDate,
        },
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
        ...(input.status && input.status !== "all" ? { status: input.status as any } : {}),
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                nationalId: true,
              },
            },
          },
        },
        institution: {
          include: {
            user: {
              select: {
                name: true,
                nationalId: true,
              },
            },
          },
        },
        accountType: {
          include: {
            ledgerAccount: {
              select: {
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        transactions: {
          where: {
            transactionDate: {
              lte: asAtDate,
            },
            status: {
              not: "REVERSED",
            },
          },
          orderBy: {
            transactionDate: "desc",
          },
          take: 1,
          select: {
            transactionDate: true,
            amount: true,
            fee: true,
            type: true,
            status: true,
            description: true,
            transactionRef: true,
          },
        },
      },
      orderBy: [
        { accountNumber: "asc" },
      ],
    }),
    // FixedDeposit records — appear under product code 201001
    db.fixedDeposit.findMany({
      where: {
        startDate: { lte: asAtDate },
        isReversed: false,
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                nationalId: true,
              },
            },
          },
        },
        institution: {
          include: {
            user: {
              select: {
                name: true,
                nationalId: true,
              },
            },
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { accountNumber: "asc" },
    }),
    // Fixed Deposit accounts in the Account model (created via POST /api/v1/accounts)
    db.account.findMany({
      where: {
        accountType: { hasFixedPeriod: true, isShareAccount: false },
        openedAt: { lte: asAtDate },
        ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
        ...(input.status && input.status !== "all" ? { status: input.status as any } : {}),
      },
      include: {
        member: {
          include: {
            user: { select: { name: true, nationalId: true } },
          },
        },
        institution: {
          include: {
            user: { select: { name: true, nationalId: true } },
          },
        },
        accountType: {
          include: {
            ledgerAccount: { select: { accountCode: true, accountName: true } },
          },
        },
        branch: { select: { id: true, name: true } },
        transactions: {
          where: { transactionDate: { lte: asAtDate }, status: { not: "REVERSED" } },
          orderBy: { transactionDate: "desc" },
          take: 1,
          select: { transactionDate: true, amount: true, fee: true, type: true, status: true, description: true, transactionRef: true },
        },
      },
      orderBy: [{ accountNumber: "asc" }],
    }),
  ]);

  // Map FixedDeposit records into AccountListingRecord-compatible shape
  const fdAsAccounts = fixedDeposits.map((fd) => ({
    id: fd.id,
    accountNumber: fd.accountNumber,
    balance: fd.principalAmount,
    status: fd.status === "WITHDRAWN" ? "CLOSED" : fd.status === "REVERSED" ? "CLOSED" : "ACTIVE",
    openedAt: fd.startDate,
    sharesCount: null,
    member: fd.member
      ? {
          ...fd.member,
          user: fd.member.user,
        }
      : null,
    institution: fd.institution
      ? {
          ...fd.institution,
          user: fd.institution.user,
        }
      : null,
    accountType: {
      id: "fixed-deposit-model",
      name: "FIXED_DEPOSIT",
      minBalance: 0,
      hasFixedPeriod: true,
      isShareAccount: false,
      interestRate: fd.interestRate,
      ledgerAccount: {
        accountCode: "201001",
        accountName: "FIXED DEPOSIT SAVINGS",
      },
    },
    branch: fd.branch,
    branchId: fd.branchId,
    transactions: [],
  }));

  const allRecords = [...accounts, ...fdAsAccounts as any[], ...fdAccountRecords as any[]];

  const normalized = allRecords
    .map((account) => {
      const productCode = resolveProductCodeFromAccount(account);
      const productName = resolveProductNameFromAccount(account);
      const balanceInfo = getAccountBalance(account);
      const lastTx = account.transactions[0]?.transactionDate || account.openedAt;
      const lastTrxDate = lastTx ? new Date(lastTx) : null;
      const daysWithoutActivity = lastTrxDate
        ? differenceInCalendarDays(asAtDate, lastTrxDate)
        : differenceInCalendarDays(asAtDate, new Date(account.openedAt));
      const ownerName = resolveAccountOwnerName(account);

      return {
        productCode,
        productName,
        row: {
          accountNumber: account.accountNumber,
          memberName: ownerName,
          bankVerificationNo: resolveAccountVerificationNo(account),
          passbookCount: account.sharesCount ?? 1,
          lastTrxDate: lastTrxDate ? format(lastTrxDate, "yyyy-MM-dd") : null,
          daysWithoutActivity: Math.max(0, daysWithoutActivity),
          dateOpened: format(new Date(account.openedAt), "yyyy-MM-dd"),
          balance: balanceInfo.amount,
          status: account.status,
          inactivityFlag: resolveFlag(Math.max(0, daysWithoutActivity)),
          branchId: account.branchId || null,
          branchName: account.branch?.name || null,
          hasBalanceOverride: balanceInfo.hasOverride,
        } satisfies SavingsListingAccountRow,
      };
    });

  const search = input.search?.trim().toLowerCase();
  const minDaysInactive = input.minDaysInactive !== undefined && input.minDaysInactive !== null
    ? Number(input.minDaysInactive)
    : undefined;

  const filtered = normalized.filter(({ productCode, productName, row }) => {
    if (input.productCode && input.productCode !== "all" && input.productCode !== productCode) {
      return false;
    }

    if (search) {
      const haystack = [
        row.accountNumber,
        row.memberName,
        row.bankVerificationNo || "",
        productCode,
        productName,
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (minDaysInactive !== undefined && row.daysWithoutActivity < minDaysInactive) {
      return false;
    }

    return true;
  });

  const accountsByProduct = new Map<string, { code: string; name: string; accounts: SavingsListingAccountRow[] }>();
  for (const definition of PRODUCT_DEFINITIONS) {
    accountsByProduct.set(definition.code, {
      code: definition.code,
      name: definition.name,
      accounts: [],
    });
  }

  for (const item of filtered) {
    const existing = accountsByProduct.get(item.productCode);
    if (existing) {
      existing.accounts.push(item.row);
    } else {
      accountsByProduct.set(item.productCode, {
        code: item.productCode,
        name: item.productName,
        accounts: [item.row],
      });
    }
  }

  const liabilityBalances = new Map<string, number>();
  for (const product of PRODUCT_DEFINITIONS) {
    const sum = allRecords
      .filter((a) => resolveProductCodeFromAccount(a) === product.code)
      .reduce((s, a) => s + money(a.balance), 0);
    liabilityBalances.set(product.code, sum);
  }

  const orderedProductEntries = Array.from(accountsByProduct.values()).sort((a, b) => {
    const aIndex = PRODUCT_DEFINITIONS.findIndex((definition) => definition.code === a.code);
    const bIndex = PRODUCT_DEFINITIONS.findIndex((definition) => definition.code === b.code);
    if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const products: SavingsListingProduct[] = orderedProductEntries
    .map((entry) => {
      const accountsForProduct = entry.accounts;
      const memberCount = accountsForProduct.length;
      const productTotal = accountsForProduct.reduce((sum, row) => sum + row.balance, 0);
      const liabilityAccountBalance = liabilityBalances.has(entry.code)
        ? liabilityBalances.get(entry.code)!
        : null;
      const difference = liabilityAccountBalance !== null
        ? productTotal - liabilityAccountBalance
        : null;

      return {
        code: entry.code,
        name: PRODUCT_NAMES[entry.code] || entry.name,
        memberCount,
        productTotal,
        accounts: accountsForProduct,
        liabilityAccountBalance,
        difference,
        isReconciled: difference === null ? null : Math.abs(difference) < 0.01,
      };
    })
    .filter((product) => {
      if (!input.productCode || input.productCode === "all") return true;
      return product.code === input.productCode;
    });

  const totalMembers = products.reduce((sum, product) => sum + product.memberCount, 0);
  const totalBalance = products.reduce((sum, product) => sum + product.productTotal, 0);
  const reconciledProducts = products.filter((product) => product.isReconciled).length;

  let branchLabel = "All Branches";
  if (branchFilter.branchId) {
    const branch = await db.branch.findUnique({
      where: { id: branchFilter.branchId },
      select: { name: true },
    }).catch(() => null);
    branchLabel = branch?.name || "Selected Branch";
  }

  return {
    sacco_name: "BUKONZO UNITED TEACHERS SACCO",
    location: "KISINGA, Kasese District",
    report_title: "Savings Accounts Listing",
    report_date: format(asAtDate, "dd/MM/yyyy"),
    generated_time: format(new Date(), "HH:mm:ss"),
    as_at_date: format(asAtDate, "yyyy-MM-dd"),
    branch_label: branchLabel,
    current_filters: {
      asAtDate: format(asAtDate, "yyyy-MM-dd"),
      branchId: input.branchId,
      productCode: input.productCode,
      status: input.status,
      minDaysInactive: input.minDaysInactive,
      search: input.search,
    },
    products,
    grand_total: {
      total_members: totalMembers,
      total_balance: totalBalance,
      product_count: products.length,
      reconciled_products: reconciledProducts,
    },
  } satisfies SavingsListingReport;
}

export async function buildSavingsMemberDetail(accountNumber: string, user: any, asAtDate?: string) {
  const branchFilter = await getBranchFilterForService(user, undefined);
  const reportDate = safeDate(asAtDate);

  const account = await db.account.findFirst({
    where: {
      accountNumber,
      ...(branchFilter.branchId ? { branchId: branchFilter.branchId } : {}),
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              nationalId: true,
            },
          },
        },
      },
      institution: {
        include: {
          user: {
            select: {
              name: true,
              nationalId: true,
            },
          },
        },
      },
      accountType: {
        include: {
          ledgerAccount: {
            select: {
              accountCode: true,
              accountName: true,
            },
          },
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
      transactions: {
        where: {
          transactionDate: {
            lte: reportDate,
          },
          status: {
            not: "REVERSED",
          },
        },
        orderBy: {
          transactionDate: "asc",
        },
        select: {
          transactionDate: true,
          transactionRef: true,
          description: true,
          type: true,
          amount: true,
          fee: true,
          status: true,
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  const latest = account.transactions[account.transactions.length - 1];
  const lastTrxDate = latest?.transactionDate || account.openedAt;
  const lastDate = lastTrxDate ? new Date(lastTrxDate) : null;
  const daysWithoutActivity = lastDate
    ? differenceInCalendarDays(reportDate, lastDate)
    : 0;

  const transactions = [...account.transactions].reverse();
  let runningBalance = money(account.balance);
  const detailedTransactions = transactions.map((tx) => {
    const delta = resolveTransactionDirection(tx as any);
    const balanceAfter = runningBalance;
    const balanceBefore = balanceAfter - delta;
    runningBalance = balanceBefore;

    return {
      transactionDate: format(new Date(tx.transactionDate), "yyyy-MM-dd"),
      reference: tx.transactionRef || null,
      description: tx.description || null,
      transactionType: tx.type,
      amount: money(tx.amount),
      balanceBefore,
      balanceAfter,
    };
  }).reverse();

  return {
    accountNumber: account.accountNumber,
    memberName: resolveAccountOwnerName(account as AccountListingRecord),
    bankVerificationNo: resolveAccountVerificationNo(account as AccountListingRecord),
    passbookCount: account.sharesCount ?? 1,
    dateOpened: format(new Date(account.openedAt), "yyyy-MM-dd"),
    lastTrxDate: lastDate ? format(lastDate, "yyyy-MM-dd") : null,
    daysWithoutActivity: Math.max(0, daysWithoutActivity),
    balance: money(account.balance),
    status: account.status,
    branchName: account.branch?.name || null,
    productCode: resolveProductCodeFromAccount(account as AccountListingRecord),
    productName: resolveProductNameFromAccount(account as AccountListingRecord),
    transactions: detailedTransactions,
  } satisfies SavingsMemberDetail;
}

export async function buildSavingsListingWorkbook(report: SavingsListingReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BUKONZO UNITED TEACHERS SACCO";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Savings Listing");
  sheet.views = [{ state: "frozen", ySplit: 12 }];
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;

  const cols = [
    { header: "A/C No.", key: "accountNumber", width: 18 },
    { header: "Name", key: "memberName", width: 34 },
    { header: "Bank Verification No./TIN", key: "bankVerificationNo", width: 24 },
    { header: "Ref. No.", key: "passbookCount", width: 10 },
    { header: "Last Trx Date", key: "lastTrxDate", width: 15 },
    { header: "Days without activity", key: "daysWithoutActivity", width: 18 },
    { header: "Date Opened", key: "dateOpened", width: 15 },
    { header: "Balance (UGX)", key: "balance", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];

  sheet.columns = cols as any;

  const titleRow = sheet.addRow([report.sacco_name]);
  titleRow.font = { bold: true, size: 16 };
  titleRow.alignment = { horizontal: "center" };
  sheet.mergeCells(1, 1, 1, cols.length);

  const locationRow = sheet.addRow([report.location]);
  locationRow.alignment = { horizontal: "center" };
  sheet.mergeCells(2, 1, 2, cols.length);

  sheet.addRow([]);
  const dateRow = sheet.addRow([`Reporting Date: ${report.report_date}`]);
  dateRow.alignment = { horizontal: "center" };
  sheet.mergeCells(4, 1, 4, cols.length);

  const contextRow = sheet.addRow([`Branch: ${report.branch_label}`]);
  contextRow.alignment = { horizontal: "center" };
  sheet.mergeCells(5, 1, 5, cols.length);

  const generatedRow = sheet.addRow([`Generated: ${report.generated_time}`]);
  generatedRow.alignment = { horizontal: "right" };
  sheet.mergeCells(6, 1, 6, cols.length);

  sheet.addRow([]);
  for (const product of report.products) {
    const header = sheet.addRow([`Product: ${product.code} - ${product.name}`]);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    header.alignment = { horizontal: "left" };
    sheet.mergeCells(header.number, 1, header.number, cols.length);

    for (const account of product.accounts) {
      const row = sheet.addRow([
        account.accountNumber,
        account.memberName,
        account.bankVerificationNo || "",
        account.passbookCount ?? "",
        account.lastTrxDate ? format(new Date(account.lastTrxDate), "dd/MM/yyyy") : "",
        account.daysWithoutActivity,
        account.dateOpened ? format(new Date(account.dateOpened), "dd/MM/yyyy") : "",
        account.balance,
        account.status,
      ]);
      row.getCell(8).numFmt = '#,##0;(#,##0)';
      if (account.inactivityFlag === "green") row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
      if (account.inactivityFlag === "amber") row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      if (account.inactivityFlag === "orange") row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
      if (account.inactivityFlag === "red") row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
    }

    const totalRow = sheet.addRow([`Total: ${product.memberCount}`, "", "", "", "", "", "", product.productTotal, ""]);
    totalRow.font = { bold: true };
    totalRow.getCell(8).numFmt = '#,##0;(#,##0)';
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" } };
    });
  }

  const grand = sheet.addRow([
    `Grand Total: ${report.grand_total.total_members} members across ${report.grand_total.product_count} products`,
    "",
    "",
    "",
    "",
    "",
    "",
    report.grand_total.total_balance,
    "",
  ]);
  grand.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grand.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  grand.getCell(8).numFmt = '#,##0;(#,##0)';

  return workbook.xlsx.writeBuffer();
}
