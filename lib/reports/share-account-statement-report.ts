import ExcelJS from "exceljs";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Prisma, UserRole } from "@prisma/client";

import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

const ACCOUNT_NAME_TO_PRODUCT: Record<string, string> = {
  "affiliate shares": "300501",
  "ordinary shares": "300502",
  "associate shares": "300503",
};

function resolveProductCode(typeName: string): string {
  const key = typeName.toLowerCase().trim();
  return ACCOUNT_NAME_TO_PRODUCT[key] || "";
}

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: UserRole | string | null;
};

export type ShareStatementFilters = {
  user: AuthUserLike;
  accountNumber?: string;
  search?: string;
  productCode?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ShareTransactionRow = {
  id: string;
  trxDate: string;
  valueDate: string;
  trxNo: string;
  voucherNo: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balanceAfter: number;
  balanceType: "CR" | "DR";
  daysSincePrev: number;
  trxTypeCode: string;
  trxTypeLabel: string;
  processedBy: string;
  amount: number;
  shares: number;
  sharesBefore: number;
  sharesAfter: number;
  rawReference: string | null;
  sourceLine: string;
};

export type ShareStatementReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  generatedAt: Date;
  currency: "UGX";
  dateRange: { from: string; to: string };
  member: {
    accountTitle: string;
    accountNumber: string;
    product: string;
    nubanCode: string;
    passbookCount: number;
    phone: string;
    idCardType: string;
    address: string;
    status: string;
    nextOfKin: Array<{ name: string; relationship?: string | null; phone?: string | null; percentage: number }>;
    branchName: string | null;
    branchId: string | null;
  };
  openingBalance: { amount: number; type: "CR" | "DR" };
  transactions: ShareTransactionRow[];
  periodTotals: {
    transactionCount: number;
    totalDebits: number;
    totalCredits: number;
  };
  closingBalances: {
    totalClearedAndUncleared: { amount: number; type: "CR" | "DR" };
    unclearedBalance: { amount: number; type: "CR" | "DR" };
    clearedBalance: { amount: number; type: "CR" | "DR" };
    amountBlocked: number;
  };
  growth: Array<{ date: string; balance: number }>;
  reconciliation: {
    productCode: string;
    productName: string;
    equityAccountCode: string | null;
    systemBalance: number;
    ledgerBalance: number;
    difference: number;
    balanced: boolean;
  };
};

type ShareAccountRecord = Prisma.ShareAccountGetPayload<{
  include: {
    member: {
      include: {
        user: {
          select: {
            name: true;
            phone: true;
            email: true;
            address: true;
            nationalId: true;
          };
        };
      };
    };
    accountType: true;
    branch: {
      select: {
        id: true;
        name: true;
      };
    };
    transactions: {
      include: {
        teller: {
          select: {
            name: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

const SACCO_NAME = "BUKONZO UNITED TEACHERS SACCO";
const LOCATION = "KISINGA, Kasese District, Uganda";
const DEFAULT_FROM = `${new Date().getFullYear()}-01-01`;
const DEFAULT_TO = new Date().toISOString().slice(0, 10);

const TRX_TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Shares Deposit",
  SALE: "Shares Withdrawal",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  DIVIDEND: "Dividend",
  REVERSAL: "Reversal",
};

function safeDate(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date) {
  return format(value, "dd/MM/yyyy");
}

function formatTime(value: Date) {
  return format(value, "HH:mm:ss");
}

function formatIsoDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function balanceType(amount: number): "CR" | "DR" {
  return amount >= 0 ? "CR" : "DR";
}

function resolveTransactionTypeCode(row: any) {
  const reference = row.reference?.trim() || row.transactionRef?.trim();
  if (reference) {
    const code = reference.slice(-1).toUpperCase();
    if (/^[A-Z]$/.test(code)) return code;
  }

  const txnType = row.transactionType || row.type;
  switch (txnType) {
    case "PURCHASE":
    case "TRANSFER_IN":
    case "DIVIDEND":
    case "SHARES_PURCHASE":
    case "DEPOSIT":
      return "C";
    case "SALE":
    case "TRANSFER_OUT":
    case "WITHDRAWAL":
      return "D";
    case "REVERSAL":
      return "H";
    default:
      return "C";
  }
}

function resolveTellerName(row: any) {
  const teller = row.teller;
  if (teller) return teller.name?.trim() || [teller.firstName, teller.lastName].filter(Boolean).join(" ").trim() || "System";
  const user = row.processedByUser;
  if (user) return user.name?.trim() || "System";
  return "System";
}

type ShareTransactionRecord = Prisma.ShareTransactionGetPayload<{
  include: {
    teller: {
      select: {
        name: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

async function resolveBranchScope(user: AuthUserLike, requestedBranchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, requestedBranchId);
  return branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
}

async function findShareAccount(filters: ShareStatementFilters, branchId: string | null) {
  const accountNumber = filters.accountNumber?.trim();
  const search = filters.search?.trim();
  const productCode = normalize(filters.productCode);

  const where: Prisma.ShareAccountWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(productCode && productCode !== "all"
      ? {
          OR: [
            { accountNumber: { startsWith: `${productCode}.` } },
            {
              accountType: {
                name: { in: Object.entries(ACCOUNT_NAME_TO_PRODUCT).filter(([, c]) => c === productCode).map(([n]) => n.charAt(0).toUpperCase() + n.slice(1)) },
              },
            },
          ],
        }
      : {}),
  };

  if (accountNumber) {
    const exact = await db.shareAccount.findFirst({
      where: {
        ...(branchId ? { branchId } : {}),
        accountNumber,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
                address: true,
                nationalId: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { id: true, name: true } },
        transactions: { include: { teller: { select: { name: true, firstName: true, lastName: true } } } },
      },
    });

    if (exact) return exact;

    const instExact = await db.account.findFirst({
      where: {
        institutionId: { not: null },
        accountType: { isShareAccount: true },
        accountNumber,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        institution: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
                address: true,
                nationalId: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { id: true, name: true } },
      },
    });

    if (instExact) {
      return {
        ...instExact,
        totalValue: instExact.balance,
        numberOfShares: (instExact as any).sharesCount || 0,
        openedDate: instExact.openedAt,
        transactions: [],
        member: null,
      } as any;
    }
  }

  if (search) {
    const found = await db.shareAccount.findFirst({
      where: {
        ...where,
          OR: [
            { accountNumber: { contains: search, mode: "insensitive" } },
            { member: { savingsAccountNumber: { contains: search, mode: "insensitive" } } },
            { member: { user: { name: { contains: search, mode: "insensitive" } } } },
            { member: { user: { phone: { contains: search, mode: "insensitive" } } } },
            { member: { memberNumber: { contains: search, mode: "insensitive" } } },
        ],
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
                address: true,
                nationalId: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { id: true, name: true } },
        transactions: { include: { teller: { select: { name: true, firstName: true, lastName: true } } } },
      },
      orderBy: { accountNumber: "asc" },
    });

    if (found) return found;

    const instFound = await db.account.findFirst({
      where: {
        institutionId: { not: null },
        accountType: { isShareAccount: true },
        ...(branchId ? { branchId } : {}),
        OR: [
          { accountNumber: { contains: search, mode: "insensitive" } },
          { institution: { institutionName: { contains: search, mode: "insensitive" } } },
          { institution: { institutionNumber: { contains: search, mode: "insensitive" } } },
          { institution: { user: { name: { contains: search, mode: "insensitive" } } } },
          { institution: { user: { phone: { contains: search, mode: "insensitive" } } } },
        ],
      },
      include: {
        institution: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                email: true,
                address: true,
                nationalId: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { accountNumber: "asc" },
    });

    if (instFound) {
      return {
        ...instFound,
        totalValue: instFound.balance,
        numberOfShares: (instFound as any).sharesCount || 0,
        openedDate: instFound.openedAt,
        transactions: [],
        member: null,
      } as any;
    }
  }

  return null;
}

function txDirection(tx: any) {
  const txnType = tx.transactionType || tx.type;
  if (txnType === "PURCHASE" || txnType === "TRANSFER_IN" || txnType === "DIVIDEND" || txnType === "SHARES_PURCHASE" || txnType === "DEPOSIT") {
    return "credit" as const;
  }
  return "debit" as const;
}

function isLoanShareDeduction(tx: any) {
  const reference = (tx.reference || tx.transactionRef || "").trim().toUpperCase();
  const description = (tx.description || "").trim().toLowerCase();
  return reference.startsWith("LN-SHARE-") || description.includes("share capital deduction from loan");
}

function resolveTxnLabel(tx: any) {
  if (isLoanShareDeduction(tx)) {
    return "Loan deduction - Associate Shares";
  }
  return TRX_TYPE_LABELS[tx.transactionType] || TRX_TYPE_LABELS[tx.type] || "Shares Deposit";
}

async function ledgerBalanceForAccount(account: ShareAccountRecord, asOfDate: Date, _branchId?: string) {
  const endOfDay = new Date(asOfDate);
  endOfDay.setHours(23, 59, 59, 999);

  let txns = account.transactions.filter(
    (tx) => !tx.isReversed && tx.transactionDate <= endOfDay,
  );

  let balance = 0;
  for (const tx of txns) {
    const txnType = (tx as any).transactionType || (tx as any).type;
    if (txnType === "PURCHASE" || txnType === "TRANSFER_IN" || txnType === "DIVIDEND" || txnType === "SHARES_PURCHASE" || txnType === "DEPOSIT") {
      balance += Number(tx.amount || 0);
    } else {
      balance -= Number(tx.amount || 0);
    }
  }

  return balance;
}

export async function buildShareAccountStatementReport(filters: ShareStatementFilters): Promise<ShareStatementReport> {
  const generatedAt = new Date();
  const dateFrom = safeDate(filters.dateFrom) || parseISO(DEFAULT_FROM);
  const dateTo = safeDate(filters.dateTo) || parseISO(DEFAULT_TO);
  const branchId = await resolveBranchScope(filters.user, filters.branchId);
  const account = await findShareAccount(filters, branchId);

  if (!account) {
    throw new Error("Share account not found");
  }

  let accountTransactions = account.transactions as any[];

  const allTransactions = accountTransactions
    .filter((txn: any) => !txn.isReversed && txn.transactionDate <= dateTo)
    .sort((a: any, b: any) => a.transactionDate.getTime() - b.transactionDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime());

  const previousTransactions = allTransactions.filter((txn: any) => txn.transactionDate < dateFrom);
  const periodTransactions = allTransactions.filter((txn: any) => txn.transactionDate >= dateFrom && txn.transactionDate <= dateTo);

  let openingBalance = previousTransactions.reduce((sum: number, txn: any) => {
    const amount = money(txn.amount);
    return txDirection(txn) === "credit" ? sum + amount : sum - amount;
  }, 0);

  const growth: Array<{ date: string; balance: number }> = [
    { date: formatIsoDate(dateFrom), balance: openingBalance },
  ];

  const openingType = balanceType(openingBalance);
  const nextOfKin = account.member?.nokName
    ? [
        {
          name: account.member.nokName,
          relationship: account.member.nokRelationship || null,
          phone: account.member.nokPhone || null,
          percentage: 100,
        },
      ]
    : [];

  let runningBalance = openingBalance;
  const transactions: ShareTransactionRow[] = [];

  for (let index = 0; index < periodTransactions.length; index += 1) {
    const txn = periodTransactions[index];
    const amount = money(txn.amount);
    const isCredit = txDirection(txn) === "credit";
    const debitAmount = isCredit ? 0 : amount;
    const creditAmount = isCredit ? amount : 0;
    runningBalance = isCredit ? runningBalance + amount : runningBalance - amount;
    const prevDate = index === 0
      ? (previousTransactions.at(-1)?.transactionDate || dateFrom)
      : periodTransactions[index - 1].transactionDate;
    const daysSincePrev = Math.max(0, differenceInCalendarDays(txn.transactionDate, prevDate));
    const trxNo = txn.reference || txn.transactionRef || txn.id;
    const trxTypeCode = resolveTransactionTypeCode(txn);
    const sourceLine = isLoanShareDeduction(txn)
      ? "Loan deduction - Associate Shares"
      : TRX_TYPE_LABELS[txn.transactionType] || TRX_TYPE_LABELS[txn.type] || "Shares Deposit";

    transactions.push({
      id: txn.id,
      trxDate: formatIsoDate(txn.transactionDate),
      valueDate: formatIsoDate(txn.transactionDate),
      trxNo,
      voucherNo: txn.reference?.replace(/[^0-9]/g, "").slice(0, 20) || trxNo.slice(0, 20),
      description: txn.description || "Shares",
      debitAmount,
      creditAmount,
      balanceAfter: runningBalance,
      balanceType: balanceType(runningBalance),
      daysSincePrev,
      trxTypeCode,
      trxTypeLabel: resolveTxnLabel(txn),
      processedBy: resolveTellerName(txn),
      amount,
      shares: txn.shares,
      sharesBefore: txn.sharesBefore,
      sharesAfter: txn.sharesAfter,
      rawReference: txn.reference || null,
      sourceLine,
    });

    growth.push({ date: formatIsoDate(txn.transactionDate), balance: runningBalance });
  }

  const totalDebits = periodTransactions.filter((txn: any) => txDirection(txn) === "debit").reduce((sum: number, txn: any) => sum + money(txn.amount), 0);
  const totalCredits = periodTransactions.filter((txn: any) => txDirection(txn) === "credit").reduce((sum: number, txn: any) => sum + money(txn.amount), 0);
  const closingBalance = runningBalance;
  const amountBlocked = 0;
  const unclearedBalance = 0;
  const clearedBalance = closingBalance - unclearedBalance;
  const productCode = resolveProductCode(account.accountType?.name || "") || account.accountNumber.split(".")[0] || "300502";
  const productName = account.accountType?.name || "ORDINARY MEMBERS";
  const ledgerBalance = await ledgerBalanceForAccount(account, dateTo, branchId ?? undefined);

  return {
    saccoName: SACCO_NAME,
    location: LOCATION,
    reportTitle: "Account Statement",
    generatedDate: formatDate(generatedAt),
    generatedTime: formatTime(generatedAt),
    generatedAt,
    currency: "UGX",
    dateRange: {
      from: formatDate(dateFrom),
      to: formatDate(dateTo),
    },
    member: {
      accountTitle: account.member?.user?.name || "N/A",
      accountNumber: account.accountNumber,
      product: productName,
      nubanCode: account.member?.savingsAccountNumber || account.accountNumber,
      passbookCount: 1,
      phone: account.member?.user?.phone || "",
      idCardType: account.member?.typeOfId || (account.member?.user?.nationalId ? "EC" : "N/A"),
      address: account.member?.postalAddress || account.member?.village || account.member?.user?.address || "",
      status: account.status,
      nextOfKin,
      branchName: account.branch?.name || null,
      branchId: account.branchId || null,
    },
    openingBalance: {
      amount: openingBalance,
      type: openingType,
    },
    transactions,
    periodTotals: {
      transactionCount: transactions.length,
      totalDebits,
      totalCredits,
    },
    closingBalances: {
      totalClearedAndUncleared: { amount: closingBalance, type: balanceType(closingBalance) },
      unclearedBalance: { amount: unclearedBalance, type: balanceType(unclearedBalance) },
      clearedBalance: { amount: clearedBalance, type: balanceType(clearedBalance) },
      amountBlocked,
    },
    growth,
    reconciliation: {
      productCode,
      productName,
      equityAccountCode: resolveProductCode(account.accountType?.name || "") || null,
      systemBalance: closingBalance,
      ledgerBalance,
      difference: closingBalance - ledgerBalance,
      balanced: Math.abs(closingBalance - ledgerBalance) < 0.01,
    },
  };
}

export async function searchShareAccounts(filters: ShareStatementFilters) {
  const branchId = await resolveBranchScope(filters.user, filters.branchId);
  const search = filters.search?.trim();
  const productCode = normalize(filters.productCode);

  const andClauses: any[] = [];
  if (branchId) andClauses.push({ branchId });
  if (productCode && productCode !== "all") {
    andClauses.push({
      OR: [
        { accountNumber: { startsWith: `${productCode}.` } },
        { accountType: { name: { in: Object.entries(ACCOUNT_NAME_TO_PRODUCT).filter(([, c]) => c === productCode).map(([n]) => n.charAt(0).toUpperCase() + n.slice(1)) } } },
      ],
    });
  }
  if (search) {
    andClauses.push({
      OR: [
        { accountNumber: { contains: search, mode: "insensitive" } },
        { member: { savingsAccountNumber: { contains: search, mode: "insensitive" } } },
        { member: { user: { name: { contains: search, mode: "insensitive" } } } },
        { member: { user: { phone: { contains: search, mode: "insensitive" } } } },
        { member: { memberNumber: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  const [accounts, institutionAccounts] = await Promise.all([
    db.shareAccount.findMany({
      where: andClauses.length > 0 ? { AND: andClauses } : {},
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { name: true } },
      },
      orderBy: { accountNumber: "asc" },
      take: 25,
    }),
    db.account.findMany({
      where: {
        institutionId: { not: null },
        accountType: { isShareAccount: true },
        ...(branchId ? { branchId } : {}),
        ...(search
          ? {
              OR: [
                { accountNumber: { contains: search, mode: "insensitive" } },
                { institution: { institutionName: { contains: search, mode: "insensitive" } } },
                { institution: { institutionNumber: { contains: search, mode: "insensitive" } } },
                { institution: { user: { name: { contains: search, mode: "insensitive" } } } },
                { institution: { user: { phone: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        institution: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                address: true,
              },
            },
          },
        },
        accountType: true,
        branch: { select: { name: true } },
      },
      orderBy: { accountNumber: "asc" },
      take: 25,
    }),
  ]);

  const memberResults = accounts.map((account) => ({
    accountNumber: account.accountNumber,
    accountTitle: account.member.user.name,
    product: account.accountType.name || "ORDINARY MEMBERS",
    nubanCode: account.member.savingsAccountNumber || account.accountNumber,
    phone: account.member.user.phone || "",
    address: account.member.user.address || account.member.postalAddress || "",
    status: account.status,
    branchName: account.branch?.name || null,
  }));

  const instResults = institutionAccounts.map((account) => ({
    accountNumber: account.accountNumber,
    accountTitle: (account as any).institution?.institutionName || "Unknown",
    product: account.accountType.name || "ORDINARY MEMBERS",
    nubanCode: account.accountNumber,
    phone: (account as any).institution?.user?.phone || "",
    address: (account as any).institution?.user?.address || "",
    status: account.status,
    branchName: account.branch?.name || null,
  }));

  return [...memberResults, ...instResults].slice(0, 25);
}

export async function buildShareAccountStatementWorkbook(report: ShareStatementReport) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Share Statement");

  sheet.columns = [
    { width: 14 },
    { width: 14 },
    { width: 24 },
    { width: 10 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 14 },
  ];

  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = report.saccoName;
  sheet.getCell("A2").font = { bold: true, size: 16 };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("I3").value = `Report Date: ${report.generatedDate}`;
  sheet.getCell("I3").alignment = { horizontal: "right" };
  sheet.getCell("I5").value = `Generated Time: ${report.generatedTime}`;
  sheet.getCell("I5").alignment = { horizontal: "right" };

  sheet.mergeCells("A6:I6");
  sheet.getCell("A6").value = report.location;
  sheet.getCell("A6").font = { italic: true, size: 11 };
  sheet.getCell("A6").alignment = { horizontal: "center" };

  sheet.mergeCells("A9:I9");
  sheet.getCell("A9").value = report.reportTitle;
  sheet.getCell("A9").font = { bold: true, size: 14 };
  sheet.getCell("A9").alignment = { horizontal: "center" };

  sheet.mergeCells("A11:I11");
  sheet.getCell("A11").value = `Reporting Date From: ${report.dateRange.from} To: ${report.dateRange.to}`;
  sheet.getCell("A11").alignment = { horizontal: "center" };

  sheet.getCell("G12").value = `Currency Code: ${report.currency}`;
  sheet.getCell("G12").alignment = { horizontal: "right" };

  const headerStartRow = 14;
  sheet.getCell(`A${headerStartRow}`).value = "Account Title:";
  sheet.getCell(`B${headerStartRow}`).value = report.member.accountTitle;
  sheet.getCell(`F${headerStartRow}`).value = "Ref. No.:";
  sheet.getCell(`G${headerStartRow}`).value = report.member.passbookCount;

  sheet.getCell(`A${headerStartRow + 1}`).value = "NUBAN Code:";
  sheet.getCell(`B${headerStartRow + 1}`).value = report.member.nubanCode;
  sheet.getCell(`F${headerStartRow + 1}`).value = "Phone:";
  sheet.getCell(`G${headerStartRow + 1}`).value = report.member.phone;

  sheet.getCell(`A${headerStartRow + 2}`).value = "A/C No.:";
  sheet.getCell(`B${headerStartRow + 2}`).value = report.member.accountNumber;
  sheet.getCell(`F${headerStartRow + 2}`).value = "ID Card:";
  sheet.getCell(`G${headerStartRow + 2}`).value = report.member.idCardType;

  sheet.getCell(`A${headerStartRow + 3}`).value = "Product:";
  sheet.getCell(`B${headerStartRow + 3}`).value = report.member.product;
  sheet.getCell(`F${headerStartRow + 3}`).value = "Address:";
  sheet.getCell(`G${headerStartRow + 3}`).value = report.member.address;

  sheet.getCell(`A${headerStartRow + 4}`).value = "Account Status:";
  sheet.getCell(`B${headerStartRow + 4}`).value = report.member.status;
  sheet.getCell(`F${headerStartRow + 4}`).value = "Next of Kin:";
  sheet.getCell(`G${headerStartRow + 4}`).value = report.member.nextOfKin.map((nok) => `${nok.name} ${nok.percentage.toFixed(2)}%`).join(", ") || "-";

  const openingRow = 30;
  sheet.mergeCells(`A${openingRow}:H${openingRow}`);
  sheet.getCell(`A${openingRow}`).value = "Balance Brought Forward";
  sheet.getCell(`I${openingRow}`).value = `${Math.abs(report.openingBalance.amount).toLocaleString()} ${report.openingBalance.type}`;
  sheet.getCell(`A${openingRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
  sheet.getCell(`I${openingRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };

  const tableHeaderRow = 32;
  sheet.getRow(tableHeaderRow).values = ["Trx Date", "Value Date", "Trx No.", "Voucher", "Description", "Debit", "Credit", "Balance", "Days"];
  sheet.getRow(tableHeaderRow).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(tableHeaderRow).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF14532D" },
  };

  let currentRow = tableHeaderRow + 1;
  for (const txn of report.transactions) {
    sheet.getRow(currentRow).values = [
      txn.trxDate,
      txn.valueDate,
      txn.trxNo,
      txn.voucherNo,
      txn.description,
      txn.debitAmount || "",
      txn.creditAmount || "",
      `${Math.abs(txn.balanceAfter).toLocaleString()} ${txn.balanceType}`,
      txn.daysSincePrev,
    ];

    sheet.getCell(`F${currentRow}`).font = { color: { argb: "FFB91C1C" } };
    sheet.getCell(`G${currentRow}`).font = { color: { argb: "FF047857" } };
    if (txn.balanceType === "DR") {
      sheet.getCell(`H${currentRow}`).font = { color: { argb: "FFB91C1C" }, bold: true };
      sheet.getCell(`H${currentRow}`).value = `* ${Math.abs(txn.balanceAfter).toLocaleString()} DR`;
    }
    currentRow += 2;
  }

  const totalRow = currentRow;
  sheet.getRow(totalRow).values = [
    `Total: ${report.periodTotals.transactionCount}`,
    "",
    "",
    "",
    "",
    report.periodTotals.totalDebits,
    report.periodTotals.totalCredits,
    "",
    "",
  ];
  sheet.getRow(totalRow).font = { bold: true };
  sheet.getRow(totalRow).border = {
    top: { style: "thin" },
  };

  const closingStart = totalRow + 2;
  const closingRows = [
    ["Total (Cleared + Uncleared)", `${Math.abs(report.closingBalances.totalClearedAndUncleared.amount).toLocaleString()} ${report.closingBalances.totalClearedAndUncleared.type}`],
    ["Uncleared Balance", `${Math.abs(report.closingBalances.unclearedBalance.amount).toLocaleString()} ${report.closingBalances.unclearedBalance.type}`],
    ["Cleared Balance", `${Math.abs(report.closingBalances.clearedBalance.amount).toLocaleString()} ${report.closingBalances.clearedBalance.type}`],
    ["Amount Blocked", report.closingBalances.amountBlocked.toLocaleString()],
  ];

  closingRows.forEach(([label, value], index) => {
    sheet.getCell(`A${closingStart + index}`).value = label;
    sheet.mergeCells(`B${closingStart + index}:I${closingStart + index}`);
    sheet.getCell(`B${closingStart + index}`).value = value;
  });

  sheet.headerFooter.oddFooter = "Page No.: &P | * - Overdrawn Account | Finance Solutions® 08.45.u";
  sheet.views = [{ state: "frozen", ySplit: tableHeaderRow }];
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  return workbook.xlsx.writeBuffer();
}
