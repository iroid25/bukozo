import ExcelJS from "exceljs";
import { db } from "@/prisma/db";
import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

export type SharesTransactionReportFilters = {
  user: AuthUserLike;
  dateFrom: string;
  dateTo: string;
  branchId?: string;
  accountTypeId?: string;
  memberId?: string;
  tellerId?: string;
  includeReversed?: boolean;
};

type TransactionRow = {
  accountNumber: string;
  memberName: string;
  phone: string;
  reference: string;
  sessionDate: string;
  transactionDate: string;
  debit: number;
  credit: number;
  userName: string;
  isReversed: boolean;
  productCode: string;
};

type ProductGroup = {
  productCode: string;
  productName: string;
  transactions: TransactionRow[];
  subtotal: {
    count: number;
    totalDebit: number;
    totalCredit: number;
  };
};

export type SharesTransactionReport = {
  saccoName: string;
  branchLabel: string;
  branchLocation: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  products: ProductGroup[];
  grandTotal: {
    count: number;
    totalDebit: number;
    totalCredit: number;
  };
};

const PRODUCT_DISPLAY_ORDER = ["300501", "300502", "300503"];
const PRODUCT_NAMES: Record<string, string> = {
  "300501": "AFFILIATE MEMBERS",
  "300502": "ORDINARY MEMBERS",
  "300503": "ASSOCIATE MEMBERS",
};

function resolveProductCode(account: any): string {
  const code = String(account?.accountType?.ledgerAccount?.accountCode || "").trim();
  if (code) return code;
  const name = String(account?.accountType?.name || "").trim();
  if (name) return name;
  return "UNCATEGORIZED";
}

function resolveProductName(account: any, productCode: string): string {
  if (PRODUCT_NAMES[productCode]) return PRODUCT_NAMES[productCode];
  return (
    account?.accountType?.ledgerAccount?.accountName ||
    account?.accountType?.name ||
    productCode
  );
}

function resolveMemberName(account: any): string {
  const member = account?.member;
  const user = member?.user;
  const inst = account?.institution;
  if (user?.name?.trim()) return user.name.trim();
  if (user?.firstName || user?.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  }
  if (member?.surname || member?.otherNames) {
    return [member.surname, member.otherNames].filter(Boolean).join(" ").trim();
  }
  if (member?.memberNumber) return member.memberNumber;
  if (inst?.institutionName?.trim()) return inst.institutionName.trim();
  if (inst?.user?.name?.trim()) return inst.user.name.trim();
  return account?.accountNumber || "Unknown";
}

function resolvePhone(account: any): string {
  const phone = account?.member?.user?.phone;
  if (phone) return phone;
  const instPhone = account?.institution?.institutionPhone;
  if (instPhone) return instPhone;
  return "";
}

function resolveTellerName(
  reference?: string | null,
  tellerName?: string | null,
): string {
  if (tellerName?.trim()) return tellerName.trim();
  const code = reference?.trim().slice(-4).toUpperCase();
  if (code) return code;
  return "System";
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmtDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("en-GB");
}

export async function getSharesTransactionReport(
  filters: SharesTransactionReportFilters,
): Promise<SharesTransactionReport> {
  const branchFilter = await getBranchFilterForService(
    filters.user as any,
    filters.branchId || undefined,
  );
  const resolvedBranchId =
    branchFilter.branchId && branchFilter.branchId !== "all"
      ? branchFilter.branchId
      : null;

  const dateFrom = new Date(filters.dateFrom);
  const dateTo = new Date(filters.dateTo);
  dateTo.setHours(23, 59, 59, 999);

  const includeReversed = filters.includeReversed === true;

  const accountInclude = {
    accountType: {
      include: {
        ledgerAccount: { select: { accountCode: true, accountName: true } },
      },
    },
    branch: { select: { name: true, location: true } },
  };

  // ── Query 1: ShareTransaction (member share accounts) ──
  const shareWhere: any = {
    transactionDate: { gte: dateFrom, lte: dateTo },
  };
  if (!includeReversed) shareWhere.isReversed = false;
  if (resolvedBranchId) shareWhere.account = { branchId: resolvedBranchId };
  if (filters.accountTypeId) {
    shareWhere.account = { ...shareWhere.account, accountTypeId: filters.accountTypeId };
  }
  if (filters.memberId) {
    shareWhere.account = { ...shareWhere.account, memberId: filters.memberId };
  }
  if (filters.tellerId) shareWhere.tellerId = filters.tellerId;

  const shareTxns = await db.shareTransaction.findMany({
    where: shareWhere,
    include: {
      account: {
        include: {
          ...accountInclude,
          member: {
            include: {
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      teller: { select: { name: true } },
    },
    orderBy: [{ transactionDate: "asc" }, { reference: "asc" }],
  });

  const shareRows: TransactionRow[] = shareTxns.map((tx) => {
    const amount = Number(tx.amount || 0);
    const type = String(tx.transactionType || "").toUpperCase();
    const isCredit = ["PURCHASE", "TRANSFER_IN", "DIVIDEND"].includes(type);
    const debit = !isCredit ? amount : 0;
    const credit = isCredit ? amount : 0;

    return {
      accountNumber: tx.account?.accountNumber || "N/A",
      memberName: resolveMemberName(tx.account),
      phone: resolvePhone(tx.account),
      reference: tx.reference || tx.id,
      sessionDate: fmtDate(tx.sessionId || tx.transactionDate),
      transactionDate: fmtDate(tx.transactionDate),
      debit,
      credit,
      userName: resolveTellerName(tx.reference, tx.teller?.name),
      isReversed: tx.isReversed,
      productCode: resolveProductCode(tx.account),
    };
  });

  // ── Query 2: Transaction (institution share accounts only — avoids duplicates with ShareTransaction) ──
  const instAccountWhere: any = {
    institutionId: { not: null },
  };
  if (resolvedBranchId) instAccountWhere.branchId = resolvedBranchId;
  if (filters.accountTypeId) {
    instAccountWhere.accountTypeId = filters.accountTypeId;
  }

  const institutionAccountIds = await db.account.findMany({
    where: {
      ...instAccountWhere,
      accountType: { isShareAccount: true },
    },
    select: { id: true },
  });
  const instAcctIds = institutionAccountIds.map((a) => a.id);

  const genericRows: TransactionRow[] = [];

  if (instAcctIds.length > 0) {
    const genericWhere: any = {
      type: { in: ["SHARES_PURCHASE", "DEPOSIT"] },
      status: "COMPLETED",
      transactionDate: { gte: dateFrom, lte: dateTo },
      accountId: { in: instAcctIds },
    };
    if (filters.tellerId) {
      genericWhere.processedByUserId = filters.tellerId;
    }

    const genericTxns = await db.transaction.findMany({
      where: genericWhere,
      include: {
        account: {
          include: {
            ...accountInclude,
            institution: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        processedByUser: { select: { name: true } },
        institution: {
          select: { institutionName: true, institutionPhone: true },
        },
      },
      orderBy: [{ transactionDate: "asc" }, { transactionRef: "asc" }],
    });

    for (const tx of genericTxns) {
      const amount = Number(tx.amount || 0);
      const accountWithInst = tx.account
        ? { ...tx.account, institution: tx.institution || tx.account?.institution || null }
        : null;

      genericRows.push({
        accountNumber: tx.account?.accountNumber || "N/A",
        memberName: resolveMemberName(accountWithInst),
        phone: resolvePhone(accountWithInst),
        reference: tx.transactionRef || tx.id,
        sessionDate: fmtDate(tx.valueDate || tx.transactionDate),
        transactionDate: fmtDate(tx.transactionDate),
        debit: 0,
        credit: amount,
        userName: resolveTellerName(tx.transactionRef, tx.processedByUser?.name),
        isReversed: false,
        productCode: resolveProductCode(tx.account),
      });
    }
  }

  // ── Merge & group ──
  const allRows = [...shareRows, ...genericRows];

  const branchLabel = resolvedBranchId
    ? (shareTxns[0]?.account?.branch?.name ||
        "Selected Branch")
    : "All Branches";
  const branchLocation =
    shareTxns[0]?.account?.branch?.location ||
    REPORT_HEADER_DETAILS.postalAddress.join(", ");

  // Group by product code
  const productMap = new Map<string, TransactionRow[]>();
  for (const row of allRows) {
    if (!productMap.has(row.productCode)) productMap.set(row.productCode, []);
    productMap.get(row.productCode)!.push(row);
  }

  const products: ProductGroup[] = [];
  const seenCodes = new Set<string>();

  for (const code of PRODUCT_DISPLAY_ORDER) {
    const txRows = productMap.get(code);
    if (!txRows || txRows.length === 0) continue;
    seenCodes.add(code);
    products.push({
      productCode: code,
      productName: PRODUCT_NAMES[code] || code,
      transactions: txRows,
      subtotal: {
        count: txRows.length,
        totalDebit: txRows.reduce((s, r) => s + r.debit, 0),
        totalCredit: txRows.reduce((s, r) => s + r.credit, 0),
      },
    });
  }

  for (const [code, txRows] of productMap) {
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    const sampleAccount =
      shareTxns.find((tx) => resolveProductCode(tx.account) === code)?.account ||
      genericRows.find((r) => r.productCode === code);
    const resolvedName = sampleAccount
      ? resolveProductName(
          typeof (sampleAccount as any)?.account === "object"
            ? (sampleAccount as any).account
            : sampleAccount,
          code,
        )
      : code;
    products.push({
      productCode: code,
      productName: resolvedName,
      transactions: txRows,
      subtotal: {
        count: txRows.length,
        totalDebit: txRows.reduce((s, r) => s + r.debit, 0),
        totalCredit: txRows.reduce((s, r) => s + r.credit, 0),
      },
    });
  }

  const grandTotal = {
    count: allRows.length,
    totalDebit: allRows.reduce((s, r) => s + r.debit, 0),
    totalCredit: allRows.reduce((s, r) => s + r.credit, 0),
  };

  return {
    saccoName: REPORT_HEADER_DETAILS.institutionName,
    branchLabel,
    branchLocation,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    generatedAt: new Date().toISOString(),
    products,
    grandTotal,
  };
}

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
}

function subtotalStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FF1D4ED8" } };
}

export async function buildSharesTransactionsReportWorkbook(
  report: SharesTransactionReport,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator =
    report.saccoName || REPORT_HEADER_DETAILS.institutionName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Shares Transactions", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  sheet.columns = [
    { width: 18 },
    { width: 28 },
    { width: 16 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
  ];

  let currentRow = 1;

  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = report.saccoName;
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
  sheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = report.branchLocation;
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  sheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  sheet.getCell(`I${currentRow}`).value = report.generatedAt
    ? new Date(report.generatedAt).toLocaleString("en-GB")
    : "";
  sheet.getCell(`I${currentRow}`).alignment = { horizontal: "right" };
  currentRow++;

  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = "Shares Transactions Report";
  sheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 14,
    color: { argb: "FF1D4ED8" },
  };
  sheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = `Reporting Date From: ${fmtDisplayDate(report.dateFrom)} To: ${fmtDisplayDate(report.dateTo)}`;
  sheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  sheet.mergeCells(`A${currentRow}:I${currentRow}`);
  sheet.getCell(`A${currentRow}`).value = `Branch: ${report.branchLabel}`;
  sheet.getCell(`A${currentRow}`).alignment = { horizontal: "left" };
  currentRow += 2;

  for (const product of report.products) {
    sheet.mergeCells(`A${currentRow}:I${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = `Product: ${product.productCode} - ${product.productName}`;
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${currentRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    currentRow++;

    const headerRow = sheet.addRow([
      "A/C No.",
      "Name",
      "Phone/Ref",
      "Trx Ref No.",
      "Session Date",
      "Trx Date",
      "Debit",
      "Credit",
      "User Name",
    ]);
    headerRow.eachCell((cell) => headerStyle(cell));
    headerRow.height = 22;
    currentRow++;

    for (const tx of product.transactions) {
      const row = sheet.addRow([
        tx.accountNumber,
        tx.memberName,
        tx.phone,
        tx.reference,
        fmtDisplayDate(tx.sessionDate),
        fmtDisplayDate(tx.transactionDate),
        tx.debit || "",
        tx.credit || "",
        tx.userName,
      ]);
      if (tx.isReversed) {
        row.eachCell((cell) => {
          cell.font = {
            ...cell.font,
            strike: true,
            color: { argb: "FF9CA3AF" },
          };
        });
      }
      row.getCell(7).numFmt = "#,##0;(#,##0)";
      row.getCell(8).numFmt = "#,##0;(#,##0)";
      currentRow++;
    }

    const totalRow = sheet.addRow([
      `Total: ${product.subtotal.count}`,
      "",
      "",
      "",
      "",
      "",
      product.subtotal.totalDebit || "",
      product.subtotal.totalCredit || "",
    ]);
    totalRow.eachCell((cell) => subtotalStyle(cell));
    totalRow.getCell(7).numFmt = "#,##0;(#,##0)";
    totalRow.getCell(8).numFmt = "#,##0;(#,##0)";
    currentRow += 2;
  }

  const grandRow = sheet.addRow([
    `Total: ${report.grandTotal.count}`,
    "",
    "",
    "",
    "",
    "",
    report.grandTotal.totalDebit || "",
    report.grandTotal.totalCredit || "",
  ]);
  grandRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 };
  });
  grandRow.getCell(7).numFmt = "#,##0;(#,##0)";
  grandRow.getCell(8).numFmt = "#,##0;(#,##0)";

  return workbook.xlsx.writeBuffer();
}
