import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { BaseReportGenerator, ReportData } from "@/lib/reports";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type StatementFilters = {
  user: AuthUserLike;
  accountId?: string;
  accountNumber?: string;
  search?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type TxDirection = "credit" | "debit";

type SavingsTransactionLike = {
  id?: string | number;
  transactionDate: Date;
  valueDate: Date | null;
  transactionRef: string | null;
  description: string | null;
  amount: number;
  fee?: number | null;
  withdrawal?: {
    fee?: number | null;
  } | null;
  type: string;
  status?: string | null;
  processedByUser?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type ResolvedSavingsAccount = {
  id: string;
  accountNumber: string;
  balance?: number | null;
  status: string;
  branch?: { name: string; location: string } | null;
  institution?: {
    institutionNumber?: string | null;
    institutionName?: string | null;
    user?: {
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      nationalId?: string | null;
      address?: string | null;
    } | null;
  } | null;
  member?: {
    id?: string;
    memberNumber?: string | null;
    registrationDate?: Date | null;
    nokName?: string | null;
    nokRelationship?: string | null;
    nokPhone?: string | null;
    nin?: string | null;
    postalAddress?: string | null;
    village?: string | null;
    user?: {
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      nationalId?: string | null;
      address?: string | null;
    } | null;
  } | null;
  accountType?: {
    name?: string | null;
    ledgerAccount?: {
      accountCode?: string | null;
      accountName?: string | null;
    } | null;
  } | null;
  transactions: SavingsTransactionLike[];
};

const SACCO_NAME = "BUKONZO UNITED TEACHERS SACCO";
const LOCATION = "KISINGA, Kasese District, Uganda";
const DEFAULT_TO = format(new Date(), "yyyy-MM-dd");
const DEFAULT_FROM = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "dd/MM/yyyy");
}

function fmtIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "yyyy-MM-dd");
}

function fmtTime(value: Date) {
  return format(value, "HH:mm:ss");
}

function direction(type: string): TxDirection {
  const normalized = (type || "").toUpperCase();
  return normalized === "WITHDRAWAL" || normalized === "FEE" || normalized === "TRANSFER_OUT" ? "debit" : "credit";
}

function transactionTotal(txn: SavingsTransactionLike) {
  const amount = money(txn.amount);
  const fee = money(txn.fee ?? txn.withdrawal?.fee);
  return direction(txn.type) === "debit" ? amount + fee : amount;
}

function displayName(account: any) {
  return (
    account.member?.user?.name?.trim() ||
    account.institution?.user?.name?.trim() ||
    [account.member?.user?.firstName, account.member?.user?.lastName].filter(Boolean).join(" ").trim() ||
    [account.institution?.user?.firstName, account.institution?.user?.lastName].filter(Boolean).join(" ").trim() ||
    account.member?.memberNumber ||
    account.institution?.institutionNumber ||
    account.accountNumber
  );
}

async function resolveBranchScope(user: AuthUserLike, requestedBranchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, requestedBranchId);
  return branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
}

async function resolveAccount(filters: StatementFilters, branchId: string | null): Promise<ResolvedSavingsAccount | null> {
  const where = {
    ...(branchId ? { branchId } : {}),
  };

  const accountSelect = {
    id: true,
    accountNumber: true,
    balance: true,
    status: true,
    openedAt: true,
    closedAt: true,
    fixingStartDate: true,
    fixingEndDate: true,
    expectedInterest: true,
    branch: { select: { name: true, location: true } },
    member: {
      select: {
        id: true,
        memberNumber: true,
        registrationDate: true,
        nokName: true,
        nokRelationship: true,
        nokPhone: true,
        nin: true,
        postalAddress: true,
        village: true,
        user: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
            nationalId: true,
            address: true,
          },
        },
      },
    },
    institution: {
      select: {
        id: true,
        institutionNumber: true,
        institutionName: true,
        registrationDate: true,
        user: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
            nationalId: true,
            address: true,
          },
        },
      },
    },
    accountType: {
      select: {
        name: true,
        ledgerAccount: {
          select: {
            accountCode: true,
            accountName: true,
          },
        },
      },
    },
    transactions: {
      where: { status: { not: "REVERSED" } as any },
      orderBy: { transactionDate: "asc" },
      select: {
        id: true,
        transactionDate: true,
        valueDate: true,
        transactionRef: true,
        description: true,
        amount: true,
        fee: true,
        withdrawal: {
          select: {
            fee: true,
          },
        },
        type: true,
        status: true,
        processedByUser: {
          select: { name: true, firstName: true, lastName: true },
        },
      },
    },
  } as const;

  const savingsOnlyFilter = { accountType: { isShareAccount: false } };

  if (filters.accountId) {
    return db.account.findFirst({
      where: { ...where, ...savingsOnlyFilter, id: filters.accountId },
      select: accountSelect,
    });
  }

  const search = filters.search?.trim();
  const accountNumber = filters.accountNumber?.trim();

  if (!accountNumber && !search) {
    return null;
  }

  return db.account.findFirst({
    where: {
      ...where,
      ...savingsOnlyFilter,
      ...(accountNumber
        ? { accountNumber: { equals: accountNumber, mode: "insensitive" } }
        : {}),
      ...(search
        ? {
            OR: [
              { accountNumber: { contains: search, mode: "insensitive" } },
              { member: { memberNumber: { contains: search, mode: "insensitive" } } },
              { member: { user: { name: { contains: search, mode: "insensitive" } } } },
              { member: { user: { firstName: { contains: search, mode: "insensitive" } } } },
              { member: { user: { lastName: { contains: search, mode: "insensitive" } } } },
              { member: { user: { email: { contains: search, mode: "insensitive" } } } },
              { member: { user: { phone: { contains: search, mode: "insensitive" } } } },
              { institution: { institutionNumber: { contains: search, mode: "insensitive" } } },
              { institution: { institutionName: { contains: search, mode: "insensitive" } } },
              { institution: { user: { name: { contains: search, mode: "insensitive" } } } },
              { institution: { user: { firstName: { contains: search, mode: "insensitive" } } } },
              { institution: { user: { lastName: { contains: search, mode: "insensitive" } } } },
              { institution: { user: { email: { contains: search, mode: "insensitive" } } } },
              { institution: { user: { phone: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    } as any,
    orderBy: { accountNumber: "asc" },
    select: accountSelect,
  });
}

export class SavingsAccountStatementGenerator extends BaseReportGenerator {
  constructor() {
    super("Savings Account Statement", "Detailed statement for a specific savings account with transaction history");
  }

  async generateData(params: StatementFilters & Record<string, any>): Promise<ReportData> {
    this.validateParameters(params, ["user"]);

    const generatedAt = new Date();
    const dateFrom = parseDate(params.dateFrom) || parseISO(DEFAULT_FROM);
    const dateToRaw = parseDate(params.dateTo) || parseISO(DEFAULT_TO);
    const dateTo = new Date(dateToRaw);
    dateTo.setHours(23, 59, 59, 999);
    const branchId = await resolveBranchScope(params.user, params.branchId);
    const account = await resolveAccount(params, branchId);

    if (!account) {
      const zeroStatement = {
        saccoName: SACCO_NAME,
        location: LOCATION,
        reportTitle: "Account Statement",
        generatedDate: fmtDate(generatedAt),
        generatedTime: fmtTime(generatedAt),
        generatedAt,
        dateRange: {
          from: fmtDate(dateFrom),
          to: fmtDate(dateTo),
        },
        branchLabel: branchId ? "Branch" : "All Branches",
        member: {
          name: params.search?.trim() || params.accountNumber?.trim() || "No matching account",
          accountNumber: params.accountNumber?.trim() || params.search?.trim() || "",
          productType: "Savings",
          productCode: "",
          referenceNumber: params.accountNumber?.trim() || params.search?.trim() || "",
          phone: "",
          idCardNumber: "",
          physicalPostalAddress: "",
          accountStatus: "NOT FOUND",
          nextOfKin: [],
        },
        openingBalance: 0,
        transactions: [],
        footer: {
          totalDebits: 0,
          totalCredits: 0,
          closingBalance: 0,
        },
      };

      return this.buildReportData(params, zeroStatement, {
        transactionCount: 0,
        totalDebits: this.formatCurrency(0),
        totalCredits: this.formatCurrency(0),
        openingBalance: this.formatCurrency(0),
        closingBalance: this.formatCurrency(0),
        message: "No savings account matched the search criteria.",
      });
    }

    const allTransactions = (account.transactions || [])
      .slice()
      .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());

    let runningBalance = money(account.balance ?? 0);
    const reversedWithBalances = [...allTransactions].reverse().map((txn) => {
      const amount = transactionTotal(txn);
      const isCredit = direction(txn.type) === "credit";
      const balanceAfter = runningBalance;
      const balanceBefore = isCredit ? balanceAfter - amount : balanceAfter + amount;
      runningBalance = balanceBefore;
      return {
        ...txn,
        balanceBefore,
        balanceAfter,
      };
    }).reverse();

    const periodTransactions = reversedWithBalances.filter((txn) => txn.transactionDate >= dateFrom && txn.transactionDate <= dateTo);
    const previousTransaction = [...reversedWithBalances].reverse().find((txn) => txn.transactionDate < dateFrom) || null;
    const openingBalance = periodTransactions.length > 0
      ? money(periodTransactions[0].balanceBefore)
      : previousTransaction
        ? money(previousTransaction.balanceAfter)
        : 0;

    const transactions: Array<{
      date: string;
      valueDate: string;
      reference: string;
      description: string;
      fee: number;
      debit: number;
      credit: number;
      balance: number;
      teller: string;
    }> = periodTransactions.map((txn) => {
      const amount = money(txn.amount);
      const normalizedType = (txn.type || "").toUpperCase();
      const fee = money(txn.fee ?? txn.withdrawal?.fee);
      const looksLikeFee = normalizedType === "FEE" || /fee/i.test(txn.description || "") || String(txn.transactionRef || "").startsWith("FEE");
      const displayedFee = fee > 0 ? fee : looksLikeFee ? amount : 0;
      const isCredit = direction(txn.type) === "credit";
      const debit = isCredit ? 0 : amount + fee;
      const credit = isCredit ? amount : 0;

      return {
        date: fmtIso(txn.transactionDate),
        valueDate: fmtIso(txn.valueDate || txn.transactionDate),
        reference: String(txn.transactionRef || txn.id || ""),
        description: (displayedFee > 0 || looksLikeFee) && direction(txn.type) === "debit"
          ? `${txn.description || txn.type} (Fee: ${this.formatCurrency(displayedFee)})`
          : (txn.description || txn.type),
        fee: displayedFee,
        debit,
        credit,
        balance: money(txn.balanceAfter),
        teller: txn.processedByUser?.name?.trim() || [txn.processedByUser?.firstName, txn.processedByUser?.lastName].filter(Boolean).join(" ").trim() || "System",
      };
    });

    const totalDebits = transactions.reduce((sum: number, tx) => sum + tx.debit, 0);
    const totalCredits = transactions.reduce((sum: number, tx) => sum + tx.credit, 0);
    const closingBalance = periodTransactions.length > 0
      ? money(periodTransactions[periodTransactions.length - 1].balanceAfter)
      : openingBalance;
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

    const report = {
      saccoName: SACCO_NAME,
      location: LOCATION,
      reportTitle: "Account Statement",
      generatedDate: fmtDate(generatedAt),
      generatedTime: fmtTime(generatedAt),
      generatedAt,
      dateRange: {
        from: fmtDate(dateFrom),
        to: fmtDate(dateTo),
      },
      branchLabel: account.branch?.name || "All Branches",
      member: {
        name: displayName(account),
        accountNumber: account.accountNumber,
        productType: account.accountType?.ledgerAccount?.accountName || account.accountType?.name || "Savings",
        productCode: account.accountType?.ledgerAccount?.accountCode || account.accountNumber.split(".")[0] || account.accountNumber,
        referenceNumber: account.member?.memberNumber || account.institution?.institutionNumber || account.accountNumber,
        phone: account.member?.user?.phone || "",
        idCardNumber: account.member?.user?.nationalId || account.member?.nin || "",
        physicalPostalAddress: account.member?.user?.address || account.member?.postalAddress || account.member?.village || "",
        accountStatus: account.status,
        nextOfKin,
      },
      openingBalance,
      transactions,
      footer: {
        totalDebits,
        totalCredits,
        closingBalance,
      },
    };

    return this.buildReportData(params, report, {
      transactionCount: transactions.length,
      totalDebits: this.formatCurrency(totalDebits),
      totalCredits: this.formatCurrency(totalCredits),
      openingBalance: this.formatCurrency(openingBalance),
      closingBalance: this.formatCurrency(closingBalance),
    });
  }
}

export async function buildSavingsAccountStatementWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SACCO_NAME;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Account Statement");
  sheet.columns = [
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
  ];

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = report.saccoName;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = report.location;
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("G3").value = `Print Date: ${report.generatedDate}`;
  sheet.getCell("G3").alignment = { horizontal: "right" };
  sheet.getCell("G4").value = `Print Time: ${report.generatedTime}`;
  sheet.getCell("G4").alignment = { horizontal: "right" };

  sheet.mergeCells("A6:G6");
  sheet.getCell("A6").value = report.reportTitle;
  sheet.getCell("A6").font = { bold: true, size: 14 };
  sheet.getCell("A6").alignment = { horizontal: "center" };

  sheet.mergeCells("A7:G7");
  sheet.getCell("A7").value = `Reporting Period: ${report.dateRange.from} to ${report.dateRange.to}`;
  sheet.getCell("A7").alignment = { horizontal: "center" };

  const headerRows = [
    ["Account Holder", report.member.name],
    ["Account Number", report.member.accountNumber],
    ["Product Type", report.member.productType],
    ["Reference Number", report.member.referenceNumber],
    ["Phone", report.member.phone || "-"],
    ["ID Card", report.member.idCardNumber || "-"],
    ["Physical/Postal Address", report.member.physicalPostalAddress || "-"],
    ["Account Status", report.member.accountStatus],
    ["Next of Kin", report.member.nextOfKin.map((nok: any) => `${nok.name} ${nok.percentage}%`).join(", ") || "-"],
  ];

  let metaRow = 9;
  for (const [label, value] of headerRows) {
    sheet.getCell(`A${metaRow}`).value = label;
    sheet.getCell(`B${metaRow}`).value = value;
    sheet.mergeCells(`B${metaRow}:G${metaRow}`);
    metaRow += 1;
  }

  const openingRow = metaRow + 1;
  sheet.mergeCells(`A${openingRow}:G${openingRow}`);
  sheet.getCell(`A${openingRow}`).value = "Opening Balance";
  sheet.getCell(`H${openingRow}`).value = report.openingBalance;
  sheet.getCell(`A${openingRow}`).font = { bold: true };
  sheet.getCell(`H${openingRow}`).font = { bold: true };

  const tableHeader = openingRow + 2;
  sheet.getRow(tableHeader).values = ["Date", "Value Date", "Reference", "Description / Narration", "Fee", "Debit", "Credit", "Balance"];
  sheet.getRow(tableHeader).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(tableHeader).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };

  let rowIndex = tableHeader + 1;
  for (const txn of report.transactions) {
    sheet.getRow(rowIndex).values = [
      txn.date,
      txn.valueDate,
      txn.reference,
      txn.description,
      txn.fee || "",
      txn.debit || "",
      txn.credit || "",
      txn.balance,
    ];
    sheet.getCell(`E${rowIndex}`).numFmt = '#,##0;(#,##0)';
    sheet.getCell(`F${rowIndex}`).numFmt = '#,##0;(#,##0)';
    sheet.getCell(`G${rowIndex}`).numFmt = '#,##0;(#,##0)';
    sheet.getCell(`H${rowIndex}`).numFmt = '#,##0;(#,##0)';
    rowIndex += 1;
  }

  const summaryStart = rowIndex + 1;
  const footerRows = [
    ["Total Debits", report.footer.totalDebits],
    ["Total Credits", report.footer.totalCredits],
    ["Closing Balance", report.footer.closingBalance],
  ];

  footerRows.forEach(([label, value], index) => {
    sheet.getCell(`A${summaryStart + index}`).value = label;
    sheet.mergeCells(`B${summaryStart + index}:G${summaryStart + index}`);
    sheet.getCell(`B${summaryStart + index}`).value = "";
    sheet.getCell(`H${summaryStart + index}`).value = value;
    sheet.getCell(`A${summaryStart + index}`).font = { bold: true };
    sheet.getCell(`H${summaryStart + index}`).font = { bold: true };
    sheet.getCell(`H${summaryStart + index}`).numFmt = '#,##0;(#,##0)';
  });

  sheet.headerFooter.oddFooter = "Page No.: &P | Finance Solutions® 08.45.u";
  sheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return workbook.xlsx.writeBuffer();
}
