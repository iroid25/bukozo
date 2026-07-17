import ExcelJS from "exceljs";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
};

type ProductMeta = {
  code: string;
  name: string;
};

const PRODUCT_ORDER = ["300501", "300502", "300503"] as const;
const PRODUCT_NAMES: Record<string, string> = {
  "300501": "AFFILIATE MEMBERS",
  "300502": "ORDINARY MEMBERS",
  "300503": "ASSOCIATE MEMBERS",
};

const TELLER_CODES: Record<string, string> = {
  KUAG: "Kule A",
  BWEG: "Bwambale",
  MAAC: "Masika",
  MEIC: "Meresi",
  MUOC: "muhindo",
  WIDG: "Winfred",
};

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
}

function datetimeLabel(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy HH:mm:ss");
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizePhone(value: string | null | undefined) {
  const text = normalizeText(value);
  return text || "Unknown";
}

function phoneLooksStandard(value: string) {
  const text = normalizeText(value).replace(/\s+/g, "");
  return /^07\d{8}$/.test(text) || /^2567\d{8}$/.test(text);
}

function refLooksLikePhone(value: string | number | null | undefined) {
  if (value == null) return false;
  const text = String(value).trim();
  return /^\d{9,10}$/.test(text) || text.length >= 9;
}

function resolveTellerName(reference?: string | null, tellerName?: string | null) {
  if (tellerName?.trim()) return tellerName.trim();
  const code = reference?.trim().slice(-4).toUpperCase();
  if (code && TELLER_CODES[code]) return TELLER_CODES[code];
  return "System";
}

function resolveTellerCode(reference?: string | null, tellerName?: string | null) {
  const code = reference?.trim().slice(-4).toUpperCase();
  if (code && TELLER_CODES[code]) return code;
  const fallback = Object.entries(TELLER_CODES).find(([, name]) => name.toLowerCase() === (tellerName || "").trim().toLowerCase());
  return fallback?.[0] || "";
}

function normaliseIdCard(value: string | null | undefined) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();
  if (!raw) return { label: "Not Provided", unknown: true };
  if (["VC", "VC.", "V/C"].includes(upper)) return { label: "Voter's Card", unknown: false };
  if (upper === "EC") return { label: "Election Card", unknown: false };
  if (["NI", "NIN", "NATIONAL", "NATIONAL ID", "NATIONAl", "NTIONAL", "NTIONAL"].includes(upper)) {
    return { label: "National ID", unknown: false };
  }
  if (upper === "STUDENTS ID") return { label: "Student ID", unknown: false };
  if (/^[A-Z]{2}\d{6,}[A-Z0-9]*$/.test(upper)) return { label: "National ID Number (NIN)", unknown: false };
  if (/^\d{7,}$/.test(raw)) return { label: "Passport / Other ID No.", unknown: false };
  if (upper === "UNKNOWN" || upper === "UN KNOWN") return { label: "Unknown", unknown: true };
  return { label: raw, unknown: false };
}

function resolveBranchMeta(branchId: string | null, rows: Array<{ branch?: { name?: string | null; location?: string | null } | null }>) {
  const branch = rows.find((row) => row.branch?.name)?.branch;
  return {
    branch: branch?.name || (branchId ? "Assigned Branch" : "All Branches"),
    branchLocation: branch?.location || "KISINGA Kasese District",
  };
}

async function resolveBranchScope(user: AuthUserLike, requestedBranchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, requestedBranchId);
  return branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
}

async function fetchShareAccounts(branchId: string | null) {
  const memberAccounts = await db.shareAccount.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
    },
    include: {
      member: {
        include: {
          user: {
            select: {
              name: true,
              phone: true,
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
          location: true,
        },
      },
    },
    orderBy: [{ accountNumber: "asc" }],
  });

    const institutionAccounts = await db.account.findMany({
      where: {
        accountType: { isShareAccount: true },
        institutionId: { not: null },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        institution: {
          select: {
            institutionName: true,
            institutionPhone: true,
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
          location: true,
        },
      },
    },
    orderBy: [{ accountNumber: "asc" }],
  });

  const normalizedInstitution = institutionAccounts.map((acc) => ({
    ...acc,
    totalValue: acc.balance,
    openedDate: acc.openedAt,
    member: null,
  }));

  return [...memberAccounts, ...normalizedInstitution];
}

function getProductCode(account: any) {
  return String(account.accountType?.ledgerAccount?.accountCode || account.accountType?.name || "").trim();
}

function getProductName(account: any, productCode: string) {
  return (
    account.accountType?.ledgerAccount?.accountName?.trim() ||
    PRODUCT_NAMES[productCode] ||
    account.accountType?.name ||
    productCode
  );
}

function getMemberName(account: any) {
  return (
    account.member?.user?.name?.trim() ||
    [account.member?.surname, account.member?.otherNames].filter(Boolean).join(" ").trim() ||
    account.institution?.institutionName?.trim() ||
    account.accountNumber
  );
}

function getAreaCode(account: any) {
  if (account.institution) return "";
  return normalizeText(account.member?.subCounty) || normalizeText(account.member?.district) || normalizeText(account.member?.parish) || "";
}

function getBvnTin(account: any) {
  if (account.institution) return "N/A";
  return normalizeText(account.member?.user?.nationalId) || normalizeText(account.member?.nin) || "UNKNOWN";
}

function productSectionsFromAccounts(accounts: any[]) {
  return PRODUCT_ORDER.map((productCode) => {
    const productAccounts = accounts.filter((account) => getProductCode(account) === productCode);
    return {
      code: productCode,
      name: PRODUCT_NAMES[productCode],
      rawAccounts: productAccounts,
    };
  });
}

function buildTransactionRows(params: Record<string, any>) {
  const defaultTo = new Date();
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const fromDate = params.fromDate ? parseISO(params.fromDate) : defaultFrom;
  const toDate = params.toDate ? parseISO(params.toDate) : defaultTo;
  const productFilter = normalizeText(params.productId || params.product_code || "");
  const userFilter = normalizeText(params.userName || params.user_name || "").toLowerCase();
  const accountFilter = normalizeText(params.accountNumber || params.account_number || "");
  const memberFilter = normalizeText(params.memberSearch || params.member_search || "").toLowerCase();
  const directionFilter = normalizeText(params.direction || "all").toLowerCase();
  const minAmount = params.minAmount == null || params.minAmount === "" ? null : Number(params.minAmount);

  const andConditions: any[] = [
    {
      transactionDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    {
      isReversed: false,
    },
  ];

  if (accountFilter) {
    andConditions.push({
      account: {
        accountNumber: { contains: accountFilter, mode: "insensitive" },
      },
    });
  }

  if (productFilter && productFilter !== "all") {
    andConditions.push({
      account: {
        accountType: {
          ledgerAccount: {
            accountCode: productFilter,
          },
        },
      },
    });
  }

  const mapShareTransactionRows = (transactions: any[]) =>
    transactions
      .map((tx) => {
        const productCode = getProductCode(tx.account);
        const productName = getProductName(tx.account, productCode);
        const amount = Number(tx.amount || 0);
        const isCredit = ["PURCHASE", "TRANSFER_IN", "DIVIDEND"].includes(String(tx.transactionType));
        const isDebit = !isCredit;
        const direction = isCredit ? "credit" : "debit";
        const tellerCode = resolveTellerCode(tx.reference, tx.teller?.name);
        const userName = resolveTellerName(tx.reference, tx.teller?.name);
        const bvnTinNote = normalizeText(tx.description) || getBvnTin(tx.account);

        return {
          productCode,
          productName,
          account_number: tx.account.accountNumber,
          member_name: getMemberName(tx.account),
          bvn_tin_note: bvnTinNote,
          ref_no: (tx.account as any).batchNumber == null ? null : (tx.account as any).batchNumber,
          trx_number: normalizeText(tx.reference) || tx.id,
          session_date: tx.createdAt ? tx.createdAt.toISOString() : tx.transactionDate.toISOString(),
          trx_date: tx.transactionDate.toISOString(),
          debit_amount: isDebit ? amount : 0,
          credit_amount: isCredit ? amount : 0,
          user_name: userName,
          teller_code: tellerCode,
          direction,
          branchName: tx.account.branch?.name || "All Branches",
        };
      })
      .filter((row) => {
        if (directionFilter !== "all" && row.direction !== directionFilter) return false;
        if (userFilter && !row.user_name.toLowerCase().includes(userFilter)) return false;
        if (memberFilter && ![row.account_number, row.member_name, row.bvn_tin_note, row.user_name]
          .some((value) => value.toLowerCase().includes(memberFilter))) return false;
        if (minAmount != null && !Number.isNaN(minAmount) && Math.max(row.debit_amount, row.credit_amount) < minAmount) return false;
        return true;
      })
      .sort((a, b) => {
        const byProduct = a.productCode.localeCompare(b.productCode);
        if (byProduct !== 0) return byProduct;
        const byDate = new Date(a.trx_date).getTime() - new Date(b.trx_date).getTime();
        if (byDate !== 0) return byDate;
        return a.trx_number.localeCompare(b.trx_number);
      });

  const mapGenericTransactionRows = (transactions: any[]) =>
    transactions
      .map((tx) => {
        const productCode =
          getProductCode(tx.account) ||
          String(tx.account?.accountType?.ledgerAccount?.accountCode || "").trim() ||
          "300501";
        const productName = getProductName(tx.account, productCode);
        const amount = Number(tx.amount || 0);
        const isCredit = String(tx.type || "").toUpperCase() === "SHARES_PURCHASE";
        const direction = isCredit ? "credit" : "debit";
        const tellerCode = resolveTellerCode(tx.transactionRef, tx.processedByUser?.name);
        const userName = resolveTellerName(tx.transactionRef, tx.processedByUser?.name);
        const bvnTinNote = normalizeText(tx.description) || getBvnTin(tx.account);

        return {
          productCode,
          productName,
          account_number: tx.account?.accountNumber || "N/A",
          member_name: tx.account ? getMemberName(tx.account) : "N/A",
          bvn_tin_note: bvnTinNote,
          ref_no: tx.account?.batchNumber == null ? null : tx.account.batchNumber,
          trx_number: normalizeText(tx.transactionRef) || tx.id,
          session_date: (tx.valueDate || tx.transactionDate).toISOString(),
          trx_date: tx.transactionDate.toISOString(),
          debit_amount: isCredit ? 0 : amount,
          credit_amount: isCredit ? amount : 0,
          user_name: userName,
          teller_code: tellerCode,
          direction,
          branchName: tx.account?.branch?.name || "All Branches",
        };
      })
      .filter((row) => {
        if (directionFilter !== "all" && row.direction !== directionFilter) return false;
        if (userFilter && !row.user_name.toLowerCase().includes(userFilter)) return false;
        if (memberFilter && ![row.account_number, row.member_name, row.bvn_tin_note, row.user_name]
          .some((value) => value.toLowerCase().includes(memberFilter))) return false;
        if (minAmount != null && !Number.isNaN(minAmount) && Math.max(row.debit_amount, row.credit_amount) < minAmount) return false;
        return true;
      })
      .sort((a, b) => {
        const byProduct = a.productCode.localeCompare(b.productCode);
        if (byProduct !== 0) return byProduct;
        const byDate = new Date(a.trx_date).getTime() - new Date(b.trx_date).getTime();
        if (byDate !== 0) return byDate;
        return a.trx_number.localeCompare(b.trx_number);
      });

  return db.shareTransaction.findMany({
    where: { AND: andConditions },
    include: {
      account: {
        include: {
          member: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true,
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
              location: true,
            },
          },
        },
      },
      teller: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ transactionDate: "asc" }, { reference: "asc" }],
  }).then(async (transactions) => {
    let rows = mapShareTransactionRows(transactions);

    const genericTransactions = await db.transaction.findMany({
      where: {
        type: "SHARES_PURCHASE",
        status: "COMPLETED",
        transactionDate: {
          gte: fromDate,
          lte: toDate,
        },
        ...(params.branchId && params.branchId !== "all"
          ? { branchId: params.branchId }
          : {}),
      },
      include: {
        account: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
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
                location: true,
              },
            },
          },
        },
        processedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ transactionDate: "asc" }, { transactionRef: "asc" }],
    });

    const genericRows = mapGenericTransactionRows(genericTransactions);
    rows = [...rows, ...genericRows];

    rows = rows.filter((row) => {
      if (productFilter && productFilter !== "all" && row.productCode !== productFilter) return false;
      return true;
    });

    const products = PRODUCT_ORDER.map((productCode) => {
      const productRows = rows.filter((row) => row.productCode === productCode);
      const subtotal = {
        count: productRows.length,
        total_debit: productRows.reduce((sum, row) => sum + row.debit_amount, 0),
        total_credit: productRows.reduce((sum, row) => sum + row.credit_amount, 0),
      };

      return {
        product_code: productCode,
        product_name: PRODUCT_NAMES[productCode],
        transactions: productRows.map((row) => ({
          account_number: row.account_number,
          member_name: row.member_name,
          bvn_tin_note: row.bvn_tin_note,
          ref_no: row.ref_no,
          trx_number: row.trx_number,
          session_date: row.session_date,
          trx_date: row.trx_date,
          debit_amount: row.debit_amount,
          credit_amount: row.credit_amount,
          user_name: row.user_name,
          teller_code: row.teller_code,
          direction: row.direction,
        })),
        subtotal: {
          ...subtotal,
          net: subtotal.total_credit - subtotal.total_debit,
        },
      };
    }).filter((p) => p.transactions.length > 0);

    const otherRows = rows.filter((row) => !PRODUCT_ORDER.includes(row.productCode as any));
    if (otherRows.length > 0) {
      const subtotal = {
        count: otherRows.length,
        total_debit: otherRows.reduce((sum, row) => sum + row.debit_amount, 0),
        total_credit: otherRows.reduce((sum, row) => sum + row.credit_amount, 0),
      };
      products.push({
        product_code: "OTHER",
        product_name: "Other Share Accounts",
        transactions: otherRows.map((row) => ({
          account_number: row.account_number,
          member_name: row.member_name,
          bvn_tin_note: row.bvn_tin_note,
          ref_no: row.ref_no,
          trx_number: row.trx_number,
          session_date: row.session_date,
          trx_date: row.trx_date,
          debit_amount: row.debit_amount,
          credit_amount: row.credit_amount,
          user_name: row.user_name,
          teller_code: row.teller_code,
          direction: row.direction,
        })),
        subtotal: {
          ...subtotal,
          net: subtotal.total_credit - subtotal.total_debit,
        },
      } as any);
    }

    const grandCount = rows.length;
    const grandDebit = rows.reduce((sum, row) => sum + row.debit_amount, 0);
    const grandCredit = rows.reduce((sum, row) => sum + row.credit_amount, 0);

    return {
      from_date: fromDate.toISOString(),
      to_date: toDate.toISOString(),
      products,
      grand_total: {
        count: grandCount,
        total_debit: grandDebit,
        total_credit: grandCredit,
        net: grandCredit - grandDebit,
      },
    };
  });
}

function buildZeroBalanceRows(accounts: any[], params: Record<string, any>) {
  const productFilter = normalizeText(params.productId || params.product_code || "");
  const genderFilter = normalizeText(params.gender || "all").toLowerCase();
  const areaFilter = normalizeText(params.areaCode || params.area_code || "");
  const idCardTypeFilter = normalizeText(params.idCardType || params.id_card_type || "");
  const memberSearch = normalizeText(params.memberSearch || params.member_search || "").toLowerCase();

  const rows = accounts
    .map((account) => {
      const productCode = getProductCode(account);
      const productName = getProductName(account, productCode);
      const idCardRaw = normalizeText(account.member?.typeOfId) || normalizeText(account.member?.user?.nationalId);
      const idCard = normaliseIdCard(idCardRaw);
      const phone = normalizePhone(account.member?.user?.phone || account.institution?.institutionPhone);
      const refNo = account.batchNumber == null ? null : account.batchNumber;
      const areaCode = getAreaCode(account);
      const gender = (account.member?.gender || "").toString();
      return {
        productCode,
        productName,
        account_number: account.accountNumber,
        member_name: getMemberName(account),
        gender: gender ? gender.charAt(0) + gender.slice(1).toLowerCase() : "",
        bvn_tin: getBvnTin(account),
        ref_no: refNo,
        phone,
        id_card_raw: idCardRaw,
        id_card_normalised: idCard.label,
        area_code: areaCode,
        flags: {
          ref_is_phone: refLooksLikePhone(refNo),
          phone_non_standard: !phoneLooksStandard(phone),
          id_card_unknown: idCard.unknown,
        },
      };
    })
    .filter((row) => row.productCode);

  const filtered = rows.filter((row) => {
    if (productFilter && productFilter !== "all" && row.productCode !== productFilter) return false;
    if (genderFilter !== "all" && row.gender.toLowerCase() !== genderFilter) return false;
    if (areaFilter && row.area_code.toLowerCase() !== areaFilter.toLowerCase()) return false;
    if (idCardTypeFilter && row.id_card_normalised.toLowerCase() !== idCardTypeFilter.toLowerCase()) return false;
    if (memberSearch && ![row.account_number, row.member_name, row.bvn_tin, row.phone, row.area_code]
      .some((value) => value.toLowerCase().includes(memberSearch))) return false;
    return true;
  });

  const products = PRODUCT_ORDER.map((productCode) => {
    const productRows = filtered.filter((row) => row.productCode === productCode);
    return {
      product_code: productCode,
      product_name: PRODUCT_NAMES[productCode],
      accounts: productRows.map((row) => ({
        account_number: row.account_number,
        member_name: row.member_name,
        gender: row.gender,
        bvn_tin: row.bvn_tin,
        ref_no: row.ref_no,
        phone: row.phone,
        id_card_raw: row.id_card_raw,
        id_card_normalised: row.id_card_normalised,
        area_code: row.area_code,
        flags: row.flags,
      })),
      subtotal: {
        count: productRows.length,
      },
    };
  }).filter((p) => p.accounts.length > 0);

  const otherRows = filtered.filter((row) => !PRODUCT_ORDER.includes(row.productCode as any));
  if (otherRows.length > 0) {
    products.push({
      product_code: "OTHER",
      product_name: "Other Share Accounts",
      accounts: otherRows.map((row) => ({
        account_number: row.account_number,
        member_name: row.member_name,
        gender: row.gender,
        bvn_tin: row.bvn_tin,
        ref_no: row.ref_no,
        phone: row.phone,
        id_card_raw: row.id_card_raw,
        id_card_normalised: row.id_card_normalised,
        area_code: row.area_code,
        flags: row.flags,
      })),
      subtotal: {
        count: otherRows.length,
      },
    } as any);
  }

  const grandTotal = filtered.length;
  const areaCodeBreakdown = filtered.reduce((acc, row) => {
    const key = row.area_code || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return {
    report_date: params.reportDate || params.report_date || new Date().toISOString(),
    products,
    grand_total: {
      count: grandTotal,
    },
    summary: {
      total_zero_balance_accounts: grandTotal,
      missing_phone_count: filtered.filter((row) => row.flags.phone_non_standard || row.phone === "Unknown").length,
      unknown_id_count: filtered.filter((row) => row.flags.id_card_unknown).length,
      gender_breakdown: {
        male: filtered.filter((row) => row.gender.toLowerCase() === "male").length,
        female: filtered.filter((row) => row.gender.toLowerCase() === "female").length,
      },
      area_code_breakdown: Object.entries(areaCodeBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([areaCode, count]) => ({ area_code: areaCode, count })),
    },
  };
}

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function writeHeader(sheet: ExcelJS.Worksheet, report: any, title: string) {
  const reportDate = report.report_date ? dateLabel(report.report_date) : "";
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = report.sacco_name || REPORT_HEADER_DETAILS.institutionName;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("J2").value = dateLabel(report.generated_at || new Date());
  sheet.getCell("J2").alignment = { horizontal: "right" };

  sheet.getCell("J4").value = format(new Date(report.generated_at || new Date()), "HH:mm:ss");
  sheet.getCell("J4").alignment = { horizontal: "right" };

  sheet.mergeCells("A5:J5");
  sheet.getCell("A5").value = report.branch_location || "KISINGA Kasese District";
  sheet.getCell("A5").alignment = { horizontal: "left" };

  sheet.mergeCells("A8:J8");
  sheet.getCell("A8").value = title;
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };

  sheet.mergeCells("A10:J10");
  sheet.getCell("A10").value = `Reporting Date: ${reportDate}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };
}

export async function getShareTransactionsReport(params: {
  user: AuthUserLike;
  fromDate?: string;
  toDate?: string;
  productId?: string;
  userName?: string;
  accountNumber?: string;
  memberSearch?: string;
  direction?: string;
  minAmount?: string | number;
  branchId?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const accounts = await fetchShareAccounts(branchId);
  const transactions = await buildTransactionRows(params);
  const branchMeta = resolveBranchMeta(branchId, accounts);
  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branch,
    branch_location: branchMeta.branchLocation,
    ...transactions,
    generated_at: new Date().toISOString(),
  };
}

export async function getShareZeroBalanceReport(params: {
  user: AuthUserLike;
  reportDate?: string;
  productId?: string;
  gender?: string;
  areaCode?: string;
  idCardType?: string;
  memberSearch?: string;
  branchId?: string;
}) {
  const branchId = await resolveBranchScope(params.user, params.branchId);
  const accounts = await fetchShareAccounts(branchId);
  const branchMeta = resolveBranchMeta(branchId, accounts);
  const report = buildZeroBalanceRows(accounts, params);
  return {
    sacco_name: REPORT_HEADER_DETAILS.institutionName,
    branch: branchMeta.branch,
    branch_location: branchMeta.branchLocation,
    generated_at: new Date().toISOString(),
    ...report,
  };
}

export async function buildShareTransactionsWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Shares Transactions");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "14:14",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 20 },
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 18 },
  ];

  writeHeader(sheet, report, "Shares Transactions Report");

  report.products.forEach((product: any) => {
    sheet.addRow([]);
    const productRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    productRow.font = { bold: true };
    productRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    sheet.mergeCells(`A${productRow.number}:J${productRow.number}`);

    sheet.addRow([
      "A/C No.",
      "Name",
      "Bank Verification No./TIN",
      "Ref. No.",
      "Trx No.",
      "Session Date",
      "Trx Date",
      "Debit",
      "Credit",
      "User Name",
    ]);
    sheet.lastRow!.eachCell((cell) => headerStyle(cell));

    product.transactions.forEach((transaction: any) => {
      const row = sheet.addRow([
        transaction.account_number,
        transaction.member_name,
        transaction.bvn_tin_note || "",
        transaction.ref_no == null ? "" : transaction.ref_no,
        transaction.trx_number,
        transaction.session_date,
        transaction.trx_date,
        transaction.debit_amount,
        transaction.credit_amount,
        transaction.user_name,
      ]);
      row.getCell(6).numFmt = "dd/MM/yyyy";
      row.getCell(7).numFmt = "dd/MM/yyyy";
      row.getCell(8).numFmt = "#,##0";
      row.getCell(9).numFmt = "#,##0";
      row.getCell(5).font = { name: "Consolas" };
    });

    const subtotalRow = sheet.addRow([
      `Total: ${product.subtotal.count}   ${money(product.subtotal.total_debit)}   ${money(product.subtotal.total_credit)}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    subtotalRow.font = { bold: true };
    sheet.mergeCells(`A${subtotalRow.number}:J${subtotalRow.number}`);
  });

  return workbook.xlsx.writeBuffer();
}

export async function buildShareZeroBalanceWorkbook(report: any) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = REPORT_HEADER_DETAILS.institutionName;
  const sheet = workbook.addWorksheet("Shares Zero Balance");
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "14:14",
  };
  sheet.columns = [
    { width: 16 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
  ];

  writeHeader(sheet, report, "Shares Zero Balance Report");

  report.products.forEach((product: any) => {
    sheet.addRow([]);
    const productRow = sheet.addRow([`Product: ${product.product_code} - ${product.product_name}`]);
    productRow.font = { bold: true };
    productRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    sheet.mergeCells(`A${productRow.number}:H${productRow.number}`);

    sheet.addRow([
      "A/C No.",
      "Name",
      "Gender",
      "Bank Verification No./TIN",
      "Ref. No.",
      "Phone",
      "ID Card",
      "Area Code",
    ]);
    sheet.lastRow!.eachCell((cell) => headerStyle(cell));

    product.accounts.forEach((account: any) => {
      const row = sheet.addRow([
        account.account_number,
        account.member_name,
        account.gender,
        account.bvn_tin,
        account.ref_no == null ? "" : account.ref_no,
        account.phone,
        account.id_card_raw,
        account.area_code,
      ]);
      if (account.flags.ref_is_phone) row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    });

    const subtotalRow = sheet.addRow([`Total: ${product.subtotal.count}`, "", "", "", "", "", "", ""]);
    subtotalRow.font = { bold: true };
  });

  return workbook.xlsx.writeBuffer();
}

export { PRODUCT_ORDER, PRODUCT_NAMES, TELLER_CODES, normaliseIdCard, refLooksLikePhone, phoneLooksStandard };
