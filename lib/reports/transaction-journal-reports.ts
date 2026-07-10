import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { UserRole } from "@prisma/client";

import { REPORT_HEADER_DETAILS } from "@/lib/report-header";
import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: string | null;
  name?: string | null;
};

export type FilterMode = "trx_date" | "session_date";

export type DaySheetRow = {
  trx_number: string;
  gl_account_no: string;
  account_no: string;
  name: string;
  trx_code: string;
  voucher_no: string;
  session_date: string;
  trx_date: string;
  debit: number;
  credit: number;
  user_name: string;
  is_debit_leg: boolean;
  is_credit_leg: boolean;
  trx_type_label: string;
  voucher_group_id: string;
  branch_name: string;
  account_name?: string;
  highlighted?: boolean;
  is_r2t?: boolean;
  is_t2r?: boolean;
  description?: string;
  reference?: string;
};

export type DaySheetReport = {
  report_title: string;
  filter_mode: FilterMode;
  filter_label: string;
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
  };
  transactions: DaySheetRow[];
  summary: {
    row_count: number;
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
    unique_vouchers: number;
    unique_tellers: number;
  };
  legend: Array<{ code: string; meaning: string; lastChar: string }>;
};

export type TellerCashStatusRow = {
  trx_number: string;
  gl_account_no: string;
  account_no: string;
  name: string;
  trx_code: string;
  source_code: string;
  source_label: string;
  source_detail: string;
  voucher_no: string;
  trx_date: string;
  time_posted: string;
  debit: number;
  credit: number;
  running_balance: number;
  user_name: string;
  is_r2t: boolean;
  is_t2r: boolean;
  trx_type_label: string;
  voucher_group_id: string;
  is_asset_purchase: boolean;
};

export type TellerCashStatusReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    session_date: string;
    teller_code: string;
    teller_name: string;
  };
  transactions: TellerCashStatusRow[];
  source_breakdown: Array<{
    source_code: string;
    source_label: string;
    count: number;
    debit_total: number;
    credit_total: number;
    net_amount: number;
  }>;
  summary: {
    transaction_count: number;
    total_debit: number;
    total_credit: number;
    net_change: number;
    is_balanced: boolean;
    opening_float: number;
    closing_balance: number;
  };
  signature_block: {
    prepared_by: string | null;
    verified_by: string | null;
    approved_by: string | null;
  };
  legend: Array<{ code: string; meaning: string; lastChar: string }>;
};

export type GeneralTransactionRegisterRow = {
  trx_number: string;
  gl_account_no: string;
  account_no: string;
  name: string;
  trx_code: string;
  voucher_no: string;
  session_date: string;
  trx_date: string;
  debit: number;
  credit: number;
  user_name: string;
  is_debit_leg: boolean;
  is_credit_leg: boolean;
  trx_type_label: string;
  voucher_group_id: string;
  is_t2r: boolean;
  is_system_account: boolean;
  description?: string;
  reference?: string;
};

export type GeneralTransactionRegisterReport = {
  report_title: string;
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
    filter_type: "trx_date";
  };
  transactions: GeneralTransactionRegisterRow[];
  summary: {
    row_count: number;
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
    imbalance_amount: number;
    unique_vouchers: number;
    unique_tellers: number;
    unique_trx_codes: number;
  };
  legend: Array<{ code: string; meaning: string; lastChar: string }>;
};

export type TransactionJournalListingRow = {
  gl_account_no: string;
  account_no: string;
  name: string;
  voucher_no: string;
  trx_number: string;
  trx_code: string;
  session_date: string;
  trx_date: string;
  debit: number;
  credit: number;
  supervisor_name: string | null;
  user_name: string;
  transaction_text: string;
  is_debit_leg: boolean;
  is_credit_leg: boolean;
  trx_type_label: string;
  voucher_group_id: string;
  is_t2r: boolean;
  is_mobile_channel: boolean;
  is_third_party: boolean;
  has_supervisor: boolean;
  is_system_account: boolean;
};

export type TransactionJournalListingReport = {
  report_title: string;
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
    filter_type: "session_date";
  };
  transactions: TransactionJournalListingRow[];
  summary: {
    row_count: number;
    total_debit: number;
    total_credit: number;
    is_balanced: boolean;
    imbalance_amount: number;
    unique_vouchers: number;
    unique_tellers: number;
    unique_trx_codes: number;
    mobile_channel_count: number;
    third_party_count: number;
    supervisor_count: number;
  };
  legend: Array<{ code: string; meaning: string; lastChar: string }>;
};

const TX_TYPE_MAP: Record<string, { code: string; label: string }> = {
  DEPOSIT: { code: "SD", label: "Savings Deposit" },
  WITHDRAWAL: { code: "SW", label: "Savings Withdrawal" },
  LOAN_REPAYMENT: { code: "LP", label: "Loan Repayment" },
  LOAN_DISBURSEMENT: { code: "I", label: "Loan Disbursement" },
  TRANSFER: { code: "T", label: "Transfer Amount" },
  FEE: { code: "N", label: "Fees & Charges" },
  SHARES_PURCHASE: { code: "C", label: "Shares Deposit" },
  INSURANCE_PREMIUM: { code: "E", label: "Income Entry" },
  LOAN_FEE: { code: "N", label: "Fees & Charges" },
  FLOAT_ALLOCATION: { code: "R2T", label: "Reserve to Teller" },
  FLOAT_RECONCILIATION: { code: "T2R", label: "Teller to Reserve" },
  OTHER: { code: "GJ", label: "General Journal" },
};

// Legend for the cashier/teller cash status report — matches exactly the codes
// produced by TX_TYPE_MAP, which is always used when a transaction has a known type.
const CASHIER_LEGEND = [
  { code: "SD",  meaning: "Savings Deposit",          lastChar: "SD"  },
  { code: "SW",  meaning: "Savings Withdrawal",       lastChar: "SW"  },
  { code: "LP",  meaning: "Loan Repayment",           lastChar: "LP"  },
  { code: "I",   meaning: "Loan Disbursement",        lastChar: "I"   },
  { code: "C",   meaning: "Shares Deposit",           lastChar: "C"   },
  { code: "E",   meaning: "Income Entry",             lastChar: "E"   },
  { code: "N",   meaning: "Fees & Charges",           lastChar: "N"   },
  { code: "T",   meaning: "Transfer Amount",          lastChar: "T"   },
  { code: "R2T", meaning: "Reserve to Teller",       lastChar: "R2T" },
  { code: "T2R", meaning: "Teller to Reserve",       lastChar: "T2R" },
  { code: "GJ",  meaning: "General Journal",         lastChar: "GJ"  },
  { code: "INC", meaning: "Income Received (Cash)",  lastChar: "INC" },
  { code: "EXP", meaning: "Expense Payment (Cash)",  lastChar: "EXP" },
  { code: "AST", meaning: "Asset Purchase (Cash)",   lastChar: "AST" },
];

const LEGEND = [
  { code: "A", meaning: "Savings Deposit", lastChar: "A" },
  { code: "B", meaning: "Savings Withdrawal", lastChar: "B" },
  { code: "C", meaning: "Shares Deposit", lastChar: "C" },
  { code: "D", meaning: "Shares Withdrawal", lastChar: "D" },
  { code: "E", meaning: "Income Entry", lastChar: "E" },
  { code: "F", meaning: "Expense Entry", lastChar: "F" },
  { code: "G", meaning: "General Journal", lastChar: "G" },
  { code: "H", meaning: "Error Correction", lastChar: "H" },
  { code: "I", meaning: "Loan Disbursement", lastChar: "I" },
  { code: "J", meaning: "Loan Repayment", lastChar: "J" },
  { code: "K", meaning: "Penalty", lastChar: "K" },
  { code: "L", meaning: "Write-offs", lastChar: "L" },
  { code: "M", meaning: "Reschedule a Loan", lastChar: "M" },
  { code: "N", meaning: "Fees & Charges", lastChar: "N" },
  { code: "O", meaning: "Member Transactions", lastChar: "O" },
  { code: "P", meaning: "Savings Interest", lastChar: "P" },
  { code: "Q", meaning: "Savings Transaction Fee", lastChar: "Q" },
  { code: "R", meaning: "Minimum Balance Fee", lastChar: "R" },
  { code: "S", meaning: "Ledger Fee", lastChar: "S" },
  { code: "T", meaning: "Transfer Amount", lastChar: "T" },
  { code: "U", meaning: "Fixed Asset Depreciation", lastChar: "U" },
  { code: "V", meaning: "Provision", lastChar: "V" },
  { code: "W", meaning: "Penalty Calculation", lastChar: "W" },
  { code: "X", meaning: "Interest Due Capitalization/Forex", lastChar: "X" },
  { code: "Y", meaning: "Batch Transactions", lastChar: "Y" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function asDate(value: string | Date) {
  return typeof value === "string" ? parseISO(value) : value;
}

function dateOnly(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function timeOnly(value: Date) {
  return format(value, "HH:mm:ss");
}

function normalizeDisplayText(value?: string | null) {
  return (value || "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
}

function decodeTrxCode(transactionRef: string, type?: string | null) {
  if (type && TX_TYPE_MAP[type]) return TX_TYPE_MAP[type];
  const lastChar = (transactionRef || "").trim().slice(-1).toUpperCase();
  const match = LEGEND.find((item) => item.lastChar === lastChar);
  return match
    ? { code: match.code, label: match.meaning }
    : { code: lastChar || "GJ", label: "General Journal" };
}

function classifyTransactionSource(tx: any) {
  const type = String(tx.type || "").toUpperCase();
  const deposit = tx.deposit || null;
  const withdrawal = tx.withdrawal || null;

  if (deposit) {
    return {
      source_code: "DEPOSIT",
      source_label: "Deposit",
      source_detail: normalizeDisplayText(
        deposit.channel || deposit.depositType || deposit.institutionName || tx.description || tx.paymentReference || tx.externalReference || "Deposit posting",
      ),
    };
  }

  if (withdrawal) {
    return {
      source_code: "WITHDRAWAL",
      source_label: "Withdrawal",
      source_detail: normalizeDisplayText(
        withdrawal.channel || tx.description || tx.paymentReference || tx.externalReference || "Withdrawal posting",
      ),
    };
  }

  switch (type) {
    case "DEPOSIT":
      return {
        source_code: "DEPOSIT",
        source_label: "Deposit",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Deposit posting"),
      };
    case "WITHDRAWAL":
      return {
        source_code: "WITHDRAWAL",
        source_label: "Withdrawal",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Withdrawal posting"),
      };
    case "LOAN_REPAYMENT":
      return {
        source_code: "LOAN_REPAYMENT",
        source_label: "Loan Repayment",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Loan repayment posting"),
      };
    case "LOAN_DISBURSEMENT":
      return {
        source_code: "LOAN_DISBURSEMENT",
        source_label: "Loan Disbursement",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Loan disbursement posting"),
      };
    case "FLOAT_ALLOCATION":
      return {
        source_code: "FLOAT_ALLOCATION",
        source_label: "Float Allocation",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Float allocation posting"),
      };
    case "FLOAT_RECONCILIATION":
      return {
        source_code: "FLOAT_RECONCILIATION",
        source_label: "Float Reconciliation",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Float reconciliation posting"),
      };
    case "SHARES_PURCHASE":
      return {
        source_code: "SHARES_PURCHASE",
        source_label: "Share Purchase",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Share purchase posting"),
      };
    case "INSURANCE_PREMIUM":
      return {
        source_code: "INSURANCE_PREMIUM",
        source_label: "Insurance Premium",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Insurance premium posting"),
      };
    case "TRANSFER":
      return {
        source_code: "TRANSFER",
        source_label: "Transfer",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Transfer posting"),
      };
    case "FEE":
    case "LOAN_FEE":
      return {
        source_code: type,
        source_label: "Fees & Charges",
        source_detail: normalizeDisplayText(tx.description || tx.paymentReference || tx.externalReference || "Fee posting"),
      };
    case "OTHER":
    default:
      return {
        source_code: type || "OTHER",
        source_label: "General Journal",
        source_detail: normalizeDisplayText(
          tx.description ||
            tx.paymentReference ||
            tx.externalReference ||
            tx.journalEntries?.[0]?.description ||
            "System / manual journal posting",
        ),
      };
  }
}

function summarizeSources(rows: TellerCashStatusRow[]) {
  const buckets = new Map<
    string,
    { source_code: string; source_label: string; count: number; debit_total: number; credit_total: number; net_amount: number }
  >();

  for (const row of rows) {
    const existing = buckets.get(row.source_code) || {
      source_code: row.source_code,
      source_label: row.source_label,
      count: 0,
      debit_total: 0,
      credit_total: 0,
      net_amount: 0,
    };

    existing.count += 1;
    existing.debit_total += row.debit;
    existing.credit_total += row.credit;
    existing.net_amount += row.debit - row.credit;
    buckets.set(row.source_code, existing);
  }

  return [...buckets.values()].sort(
    (left, right) =>
      Math.abs(right.net_amount) - Math.abs(left.net_amount) ||
      right.count - left.count ||
      left.source_label.localeCompare(right.source_label),
  );
}

function buildVoucherGroupId(transactionRef: string, voucherNo: string, glAccountNo: string) {
  return `${voucherNo || transactionRef || "voucher"}:${glAccountNo}`;
}

function buildAuditVoucherGroupId(transactionRef: string, voucherNo: string) {
  return normalizeDisplayText(voucherNo || transactionRef || "voucher");
}

function isSystemAccount(accountNo: string) {
  return ["0", "1", "3"].includes(String(accountNo || "").trim());
}

function isMobileChannel(text: string) {
  return text.toLowerCase().includes("mobile");
}

function isThirdPartyText(text: string) {
  return /\sby\s/i.test(text);
}

async function resolveBranchMeta(user: AuthUserLike, branchId?: string) {
  const branchFilter = await getBranchFilterForService(user as any, branchId);
  const finalBranchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
  const branch = finalBranchId
    ? await db.branch.findUnique({ where: { id: finalBranchId }, select: { name: true, location: true } })
    : null;
  return {
    branchId: finalBranchId,
    branchName: branch?.name || "All Branches",
    branchLocation: branch?.location || "KISINGA Kasese District",
  };
}

export async function buildDaySheetReport(input: {
  user: AuthUserLike;
  fromDate: string;
  toDate: string;
  filterMode: FilterMode;
  branchId?: string;
  userName?: string;
  glAccount?: string;
  trxCode?: string;
  voucherNo?: string;
}): Promise<DaySheetReport> {
  const from = asDate(input.fromDate);
  const to = asDate(input.toDate);
  // Use exclusive upper bound (start of next day) so the full toDate is included
  const toExclusive = new Date(to.getTime() + 86400000);
  const branchMeta = await resolveBranchMeta(input.user, input.branchId);
  const transactionWhere =
    input.filterMode === "session_date"
      ? branchMeta.branchId
        ? { branchId: branchMeta.branchId }
        : undefined
      : {
          transactionDate: {
            gte: from,
            lt: toExclusive,
          },
          ...(branchMeta.branchId ? { branchId: branchMeta.branchId } : {}),
        };

  const journalEntries = await db.journalEntry.findMany({
    where: {
      ...(input.filterMode === "session_date"
        ? {
            entryDate: {
              gte: from,
              lt: toExclusive,
            },
          }
        : {}),
      ...(input.voucherNo ? { reference: { contains: input.voucherNo, mode: "insensitive" } } : {}),
      ...(input.glAccount ? { account: { accountCode: { contains: input.glAccount, mode: "insensitive" } } } : {}),
      ...(transactionWhere
        ? {
            OR: [
              { transaction: transactionWhere },
              {
                transactionId: null,
                ...(branchMeta.branchId ? { branchId: branchMeta.branchId } : {}),
                ...(input.filterMode !== "session_date"
                  ? { entryDate: { gte: from, lt: toExclusive } }
                  : {}),
              },
            ],
          }
        : {}),
    },
    include: {
      account: {
        select: {
          accountCode: true,
          accountName: true,
        },
      },
      transaction: {
        include: {
          account: {
            include: {
              member: { include: { user: { select: { name: true } } } },
              institution: { select: { institutionName: true } },
            },
          },
          debitAccount: { select: { accountCode: true, accountName: true } },
          creditAccount: { select: { accountCode: true, accountName: true } },
          processedByUser: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: [
      { entryDate: "asc" },
      { entryNumber: "asc" },
      { createdAt: "asc" },
    ],
  });

  const rows = journalEntries
    .map((entry) => {
      const transaction = entry.transaction;
      const trxNumber = transaction?.transactionRef || entry.reference || entry.entryNumber;
      const trxInfo = decodeTrxCode(trxNumber, transaction?.type || null);
      const transactionDate = transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date(entry.entryDate);
      const sessionDate = new Date(entry.entryDate);
      const debit = Number(entry.debitAmount || 0);
      const credit = Number(entry.creditAmount || 0);
      const amount = debit || credit;
      const glAccountNo = entry.account.accountCode || "0";
      const accountNo = transaction?.account?.accountNumber || "0";
      const name = transaction?.account?.member?.user?.name || transaction?.account?.institution?.institutionName || transaction?.account?.accountNumber || entry.account.accountName;
      const voucherNo = entry.reference || transaction?.paymentReference || transaction?.transactionRef || "Reserve";
      const userName = transaction?.processedByUser?.name || entry.createdBy?.name || "System";
      return {
        trx_number: trxNumber,
        gl_account_no: glAccountNo,
        account_no: accountNo,
        name,
        trx_code: trxInfo.code,
        voucher_no: voucherNo,
        session_date: dateOnly(sessionDate),
        trx_date: dateOnly(transactionDate),
        debit,
        credit,
        user_name: userName,
        is_debit_leg: debit > 0,
        is_credit_leg: debit === 0 && credit > 0,
        trx_type_label: trxInfo.label,
        voucher_group_id: buildVoucherGroupId(trxNumber, voucherNo, glAccountNo),
        branch_name: branchMeta.branchName,
        account_name: entry.account.accountName,
        description: entry.description,
        reference: entry.reference || "",
        highlighted: false,
        is_r2t: trxInfo.code === "R2T",
        is_t2r: trxInfo.code === "T2R",
      } satisfies DaySheetRow;
    })
    .filter((row) => {
      if (input.userName && !row.user_name.toLowerCase().includes(input.userName.toLowerCase())) return false;
      if (input.trxCode && row.trx_code.toLowerCase() !== input.trxCode.toLowerCase()) return false;
      return true;
    });

  rows.sort((a, b) => {
    const trxCompare = a.trx_number.localeCompare(b.trx_number);
    if (trxCompare !== 0) return trxCompare;
    const glCompare = a.gl_account_no.localeCompare(b.gl_account_no);
    if (glCompare !== 0) return glCompare;
    const voucherCompare = a.voucher_no.localeCompare(b.voucher_no);
    if (voucherCompare !== 0) return voucherCompare;
    return a.account_no.localeCompare(b.account_no);
  });

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const balance = totalDebit - totalCredit;
  const uniqueVouchers = new Set(rows.map((row) => row.voucher_no)).size;
  const uniqueTellers = new Set(rows.map((row) => row.user_name)).size;

  return {
    report_title:
      input.filterMode === "session_date"
        ? "Trx/Day Sheet by Session Date"
        : "Trx/Day Sheet by Trx Date",
    filter_mode: input.filterMode,
    filter_label: `Reporting Date From: ${format(from, "dd/MM/yyyy")} To: ${format(to, "dd/MM/yyyy")}`,
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchMeta.branchName,
      generated_at: new Date().toISOString(),
      from_date: dateOnly(from),
      to_date: dateOnly(to),
    },
    transactions: rows,
    summary: {
      row_count: rows.length,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: Math.abs(balance) < 0.01,
      unique_vouchers: uniqueVouchers,
      unique_tellers: uniqueTellers,
    },
    legend: LEGEND,
  };
}

export async function buildCashierCashStatusReport(input: {
  user: AuthUserLike;
  sessionDate: string;
  tellerId?: string;
  branchId?: string;
  trxCode?: string;
}): Promise<TellerCashStatusReport> {
  const sessionDate = asDate(input.sessionDate);
  const branchMeta = await resolveBranchMeta(input.user, input.branchId);
  const requestedTellerId = input.tellerId?.trim();
  const showAllTellers = !requestedTellerId || requestedTellerId.toLowerCase() === "all";

  const tellerId = showAllTellers ? "" : requestedTellerId || "";
  const tellerUser = tellerId
    ? await db.user.findUnique({
        where: { id: tellerId },
        select: { name: true },
      })
    : null;
  const tellerName = showAllTellers
    ? "All Tellers"
    : tellerUser?.name || "System";
  const tellerCode = showAllTellers
    ? "ALL"
    : tellerId.slice(0, 8).toUpperCase() || "SESSION";

  const nextDay = new Date(sessionDate.getTime() + 86400000);

  // Resolve the float ID(s) for the selected teller(s) — FloatTransaction is
  // the single source of truth for everything that moved through the teller's cash drawer.
  const userFloats = await db.userFloat.findMany({
    where: {
      ...(!showAllTellers && tellerId ? { userId: tellerId } : {}),
      ...(branchMeta.branchId ? { user: { branchId: branchMeta.branchId } } : {}),
    },
    select: { id: true, userId: true },
  });
  const floatIds = userFloats.map((f) => f.id);

  const allFloatTxns = floatIds.length > 0
    ? await db.floatTransaction.findMany({
        where: {
          floatId: { in: floatIds },
          transactionDate: { lt: nextDay },
        },
        include: {
          performedByUser: { select: { name: true } },
        },
        orderBy: [{ transactionDate: "asc" }],
      })
    : [];

  const floatTxns = allFloatTxns.filter((txn) => new Date(txn.transactionDate).getTime() >= sessionDate.getTime());

  // Batch-fetch related Transaction records for member name / account number display.
  // Income, expenditure, and asset entries are identifiable by their description prefix
  // so they do NOT need a Transaction lookup — their info is in the description already.
  const relatedTxnIds = [
    ...new Set(
      floatTxns
        .filter((ft) => {
          const d = (ft.description || "").toLowerCase();
          return (
            ft.relatedTransactionId &&
            !d.startsWith("income:") &&
            !d.startsWith("expenditure:") &&
            !d.startsWith("asset purchase")
          );
        })
        .map((ft) => ft.relatedTransactionId!),
    ),
  ];
  const relatedTxnMap = new Map<string, any>();
  if (relatedTxnIds.length > 0) {
    const txns = await db.transaction.findMany({
      where: { id: { in: relatedTxnIds } },
      select: {
        id: true,
        transactionRef: true,
        paymentReference: true,
        externalReference: true,
        account: {
          select: {
            accountNumber: true,
            member: { select: { user: { select: { name: true } } } },
            institution: { select: { institutionName: true } },
          },
        },
      },
    });
    txns.forEach((t) => relatedTxnMap.set(t.id, t));
  }

  const openingFloat = allFloatTxns
    .filter((txn) => new Date(txn.transactionDate).getTime() < sessionDate.getTime())
    .reduce((sum, txn) => {
      const desc = normalizeDisplayText(txn.description || "").toLowerCase();
      const amount = Number(txn.amount || 0);
      if (String(txn.type || "").toUpperCase() === "FLOAT_ALLOCATION") return sum + amount;
      if (String(txn.type || "").toUpperCase() === "FLOAT_RECONCILIATION") return sum - amount;
      if (desc.startsWith("asset purchase")) return sum - Math.abs(amount);
      return sum;
    }, 0);

  type CashItem = {
    sortTs: number;
    cashDelta: number;
    rowData: Omit<TellerCashStatusRow, "running_balance">;
  };
  const allItems: CashItem[] = [];

  const FLOAT_SOURCE_MAP: Record<string, { sourceCode: string; sourceLabel: string; trxCode: string; trxLabel: string }> = {
    DEPOSIT:              { sourceCode: "DEPOSIT",              sourceLabel: "Deposit",             trxCode: "SD",  trxLabel: "Savings Deposit"     },
    WITHDRAWAL:           { sourceCode: "WITHDRAWAL",           sourceLabel: "Withdrawal",          trxCode: "SW",  trxLabel: "Savings Withdrawal"  },
    LOAN_REPAYMENT:       { sourceCode: "LOAN_REPAYMENT",       sourceLabel: "Loan Repayment",      trxCode: "LP",  trxLabel: "Loan Repayment"      },
    LOAN_DISBURSEMENT:    { sourceCode: "LOAN_DISBURSEMENT",    sourceLabel: "Loan Disbursement",   trxCode: "I",   trxLabel: "Loan Disbursement"   },
    FLOAT_ALLOCATION:     { sourceCode: "FLOAT_ALLOCATION",     sourceLabel: "Float Allocation",    trxCode: "R2T", trxLabel: "Reserve to Teller"   },
    FLOAT_RECONCILIATION: { sourceCode: "FLOAT_RECONCILIATION", sourceLabel: "Float Reconciliation",trxCode: "T2R", trxLabel: "Teller to Reserve"   },
    SHARES_PURCHASE:      { sourceCode: "SHARES_PURCHASE",      sourceLabel: "Share Purchase",      trxCode: "C",   trxLabel: "Shares Deposit"      },
    INSURANCE_PREMIUM:    { sourceCode: "INSURANCE_PREMIUM",    sourceLabel: "Insurance Premium",   trxCode: "E",   trxLabel: "Income Entry"        },
    FEE:                  { sourceCode: "FEE",                  sourceLabel: "Fees & Charges",      trxCode: "N",   trxLabel: "Fees & Charges"      },
    LOAN_FEE:             { sourceCode: "LOAN_FEE",             sourceLabel: "Loan Fee",            trxCode: "N",   trxLabel: "Fees & Charges"      },
    TRANSFER:             { sourceCode: "TRANSFER",             sourceLabel: "Transfer",            trxCode: "T",   trxLabel: "Transfer Amount"     },
  };

  for (const ft of floatTxns) {
    const type = String(ft.type || "").toUpperCase();
    const desc = normalizeDisplayText(ft.description || "");
    const descLower = desc.toLowerCase();
    const relatedTxn = ft.relatedTransactionId ? relatedTxnMap.get(ft.relatedTransactionId) : null;

    let sourceCode: string;
    let sourceLabel: string;
    let sourceDetail: string;
    let trxCode: string;
    let trxLabel: string;
    let isAssetPurchase = false;
    let memberName = "";
    let accountNo = "-";
    let trxNumber = ft.id;
    let voucherNo = ft.relatedTransactionId || ft.id;

    if (type === "OTHER" && descLower.startsWith("asset purchase")) {
      // "Asset purchase using teller float - AssetName (assetCode) [...]"
      const match = desc.match(/asset purchase using teller float\s*[-–]\s*(.+?)(?:\s*\[|$)/i);
      const assetLabel = match ? match[1].trim() : desc;
      sourceCode = "ASSET_PURCHASE";
      sourceLabel = "Asset Purchase";
      sourceDetail = assetLabel;
      trxCode = "AST";
      trxLabel = "Asset Purchase";
      isAssetPurchase = true;
      memberName = assetLabel;
      voucherNo = ft.relatedTransactionId || ft.id;

    } else if (type === "OTHER" && descLower.startsWith("expenditure:")) {
      const detail = desc.replace(/^expenditure:\s*/i, "").trim();
      sourceCode = "EXPENDITURE";
      sourceLabel = "Expense Payment";
      sourceDetail = detail || "Cash expense";
      trxCode = "EXP";
      trxLabel = "Expense Payment";
      memberName = detail || "Expense";

    } else if (type === "DEPOSIT" && descLower.startsWith("income:")) {
      const detail = desc.replace(/^income:\s*/i, "").trim();
      sourceCode = "INCOME";
      sourceLabel = "Income Received";
      sourceDetail = detail || "Cash income";
      trxCode = "INC";
      trxLabel = "Income Received";
      memberName = detail || "Income";

    } else {
      // Standard banking transaction — enrich display from related Transaction
      const entry = FLOAT_SOURCE_MAP[type] ?? {
        sourceCode: type || "OTHER",
        sourceLabel: "General Journal",
        trxCode: "GJ",
        trxLabel: "General Journal",
      };
      sourceCode = entry.sourceCode;
      sourceLabel = entry.sourceLabel;
      sourceDetail = desc || sourceLabel;
      trxCode = entry.trxCode;
      trxLabel = entry.trxLabel;

      if (relatedTxn) {
        trxNumber = relatedTxn.transactionRef || ft.id;
        voucherNo = relatedTxn.paymentReference || relatedTxn.externalReference || relatedTxn.transactionRef || ft.id;
        accountNo = relatedTxn.account?.accountNumber || "-";
        memberName = relatedTxn.account?.member?.user?.name || relatedTxn.account?.institution?.institutionName || "";
      }
    }

    if (input.trxCode && trxCode.toLowerCase() !== input.trxCode.toLowerCase()) continue;

    const rawAmount = Number(ft.amount);
    // Asset purchases are stored with a positive amount but decrease the float
    const cashDelta = isAssetPurchase ? -Math.abs(rawAmount) : rawAmount;
    const trxDate = new Date(ft.transactionDate);

    allItems.push({
      sortTs: trxDate.getTime(),
      cashDelta,
      rowData: {
        trx_number: trxNumber,
        gl_account_no: "-",
        account_no: accountNo,
        name: normalizeDisplayText(memberName || ft.performedByUser?.name || sourceLabel),
        trx_code: trxCode,
        source_code: sourceCode,
        source_label: sourceLabel,
        source_detail: normalizeDisplayText(sourceDetail),
        voucher_no: voucherNo,
        trx_date: dateOnly(trxDate),
        time_posted: timeOnly(trxDate),
        debit: cashDelta > 0 ? cashDelta : 0,
        credit: cashDelta < 0 ? Math.abs(cashDelta) : 0,
        user_name: ft.performedByUser?.name || "System",
        is_r2t: type === "FLOAT_ALLOCATION",
        is_t2r: type === "FLOAT_RECONCILIATION",
        is_asset_purchase: isAssetPurchase,
        trx_type_label: trxLabel,
        voucher_group_id: trxNumber,
      },
    });
  }

  allItems.sort((a, b) => a.sortTs - b.sortTs);
  let runningBalance = Number(openingFloat);
  const rows: TellerCashStatusRow[] = allItems.map((item) => {
    runningBalance += item.cashDelta;
    return { ...item.rowData, running_balance: runningBalance };
  });

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const closingBalance = runningBalance;
  const sourceBreakdown = summarizeSources(rows);

  return {
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchMeta.branchName,
      generated_at: new Date().toISOString(),
      session_date: dateOnly(sessionDate),
      teller_code: tellerCode,
      teller_name: tellerName,
    },
    transactions: rows,
    source_breakdown: sourceBreakdown,
    summary: {
      transaction_count: rows.length,
      total_debit: totalDebit,
      total_credit: totalCredit,
      net_change: totalDebit - totalCredit,
      is_balanced: Math.abs(totalDebit - totalCredit) < 0.01 && Math.abs(closingBalance) < 0.01,
      opening_float: Number(openingFloat),
      closing_balance: closingBalance,
    },
    signature_block: {
      prepared_by: null,
      verified_by: null,
      approved_by: null,
    },
    legend: CASHIER_LEGEND,
  };
}

export async function buildGeneralTransactionRegisterReport(input: {
  user: AuthUserLike;
  fromDate: string;
  toDate: string;
  branchId?: string;
  userName?: string;
  glAccount?: string;
  trxCode?: string;
  voucherNo?: string;
  memberSearch?: string;
}): Promise<GeneralTransactionRegisterReport> {
  const from = asDate(input.fromDate);
  const to = asDate(input.toDate);
  // Use exclusive upper bound (start of next day) so the full toDate is included
  const toExclusive = new Date(to.getTime() + 86400000);
  const branchMeta = await resolveBranchMeta(input.user, input.branchId);

  const transactionWhere =
    branchMeta.branchId
      ? {
          transactionDate: { gte: from, lt: toExclusive },
          branchId: branchMeta.branchId,
        }
      : {
          transactionDate: { gte: from, lt: toExclusive },
        };

  const journalEntries = await db.journalEntry.findMany({
    where: {
      ...(input.voucherNo ? { reference: { contains: input.voucherNo, mode: "insensitive" } } : {}),
      ...(input.glAccount ? { account: { accountCode: { contains: input.glAccount, mode: "insensitive" } } } : {}),
      ...(branchMeta.branchId
        ? {
            OR: [
              { transaction: transactionWhere },
              { transactionId: null, entryDate: { gte: from, lt: toExclusive }, branchId: branchMeta.branchId },
            ],
          }
        : {
            OR: [
              { transaction: transactionWhere },
              { transactionId: null, entryDate: { gte: from, lt: toExclusive } },
            ],
          }),
    },
    include: {
      account: {
        select: {
          accountCode: true,
          accountName: true,
        },
      },
      transaction: {
        include: {
          account: {
            include: {
              member: { include: { user: { select: { name: true } } } },
              institution: { select: { institutionName: true } },
            },
          },
          debitAccount: { select: { accountCode: true, accountName: true } },
          creditAccount: { select: { accountCode: true, accountName: true } },
          processedByUser: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: [
      { transaction: { transactionDate: "asc" } } as any,
      { transaction: { transactionRef: "asc" } } as any,
      { entryNumber: "asc" },
    ],
  });

  const rows = journalEntries
    .map((entry) => {
      const transaction = entry.transaction;
      const trxNumber = transaction?.transactionRef || entry.reference || entry.entryNumber;
      const trxInfo = decodeTrxCode(trxNumber, transaction?.type || null);
      const transactionDate = transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date(entry.entryDate);
      const sessionDate = new Date(entry.entryDate);
      const debit = Number(entry.debitAmount || 0);
      const credit = Number(entry.creditAmount || 0);
      const glAccountNo = entry.account.accountCode || "0";
      const accountNo = transaction?.account?.accountNumber || "0";
      const name = normalizeDisplayText(
        transaction?.account?.member?.user?.name || transaction?.account?.institution?.institutionName || transaction?.account?.accountNumber || entry.account.accountName,
      );
      const voucherNo = normalizeDisplayText(entry.reference || transaction?.paymentReference || transaction?.externalReference || transaction?.transactionRef || "Reserve");
      const userName = normalizeDisplayText(transaction?.processedByUser?.name || entry.createdBy?.name || "System");
      return {
        trx_number: trxNumber,
        gl_account_no: glAccountNo,
        account_no: accountNo,
        name,
        trx_code: trxInfo.code,
        voucher_no: voucherNo,
        session_date: dateOnly(sessionDate),
        trx_date: dateOnly(transactionDate),
        debit,
        credit,
        user_name: userName,
        is_debit_leg: debit > 0,
        is_credit_leg: credit > 0,
        trx_type_label: trxInfo.label,
        voucher_group_id: buildAuditVoucherGroupId(trxNumber, voucherNo),
        is_t2r: trxInfo.code === "T2R",
        is_system_account: isSystemAccount(accountNo),
        description: entry.description,
        reference: entry.reference || "",
      } satisfies GeneralTransactionRegisterRow;
    })
    .filter((row) => {
      if (input.userName && !row.user_name.toLowerCase().includes(input.userName.toLowerCase())) return false;
      if (input.trxCode && row.trx_code.toLowerCase() !== input.trxCode.toLowerCase()) return false;
      if (input.memberSearch && !`${row.name} ${row.account_no}`.toLowerCase().includes(input.memberSearch.toLowerCase())) return false;
      if (input.voucherNo && !`${row.voucher_no} ${row.trx_number}`.toLowerCase().includes(input.voucherNo.toLowerCase())) return false;
      return true;
    });

  rows.sort((a, b) => {
    const trxCompare = a.trx_number.localeCompare(b.trx_number);
    if (trxCompare !== 0) return trxCompare;
    const glCompare = a.gl_account_no.localeCompare(b.gl_account_no);
    if (glCompare !== 0) return glCompare;
    return a.account_no.localeCompare(b.account_no);
  });

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const imbalanceAmount = totalDebit - totalCredit;
  const uniqueVouchers = new Set(rows.map((row) => row.voucher_no)).size;
  const uniqueTellers = new Set(rows.map((row) => row.user_name)).size;
  const uniqueTrxCodes = new Set(rows.map((row) => row.trx_code)).size;

  return {
    report_title: "General Trx Register by Trx Date",
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchMeta.branchName,
      generated_at: new Date().toISOString(),
      from_date: dateOnly(from),
      to_date: dateOnly(to),
      filter_type: "trx_date",
    },
    transactions: rows,
    summary: {
      row_count: rows.length,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: Math.abs(imbalanceAmount) < 0.01,
      imbalance_amount: imbalanceAmount,
      unique_vouchers: uniqueVouchers,
      unique_tellers: uniqueTellers,
      unique_trx_codes: uniqueTrxCodes,
    },
    legend: LEGEND,
  };
}

export async function buildTransactionJournalListingReport(input: {
  user: AuthUserLike;
  fromDate: string;
  toDate: string;
  branchId?: string;
  userName?: string;
  glAccount?: string;
  trxCode?: string;
  textSearch?: string;
  memberSearch?: string;
  voucherNo?: string;
}): Promise<TransactionJournalListingReport> {
  const from = asDate(input.fromDate);
  const to = asDate(input.toDate);
  // Use exclusive upper bound (start of next day) so the full toDate is included
  const toExclusive = new Date(to.getTime() + 86400000);
  const branchMeta = await resolveBranchMeta(input.user, input.branchId);

  const journalEntries = await db.journalEntry.findMany({
    where: {
      entryDate: {
        gte: from,
        lt: toExclusive,
      },
      ...(branchMeta.branchId
        ? {
            OR: [
              { transaction: { branchId: branchMeta.branchId } },
              { transactionId: null, branchId: branchMeta.branchId },
            ],
          }
        : {}),
      ...(input.glAccount ? { account: { accountCode: { contains: input.glAccount, mode: "insensitive" } } } : {}),
    },
    include: {
      account: {
        select: {
          accountCode: true,
          accountName: true,
        },
      },
      transaction: {
        include: {
          account: {
            include: {
              member: { include: { user: { select: { name: true } } } },
              institution: { select: { institutionName: true } },
            },
          },
          debitAccount: { select: { accountCode: true, accountName: true } },
          creditAccount: { select: { accountCode: true, accountName: true } },
          processedByUser: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: [
      { entryDate: "asc" },
      { entryNumber: "asc" },
      { transaction: { transactionRef: "asc" } } as any,
    ],
  });

  const rows = journalEntries
    .map((entry) => {
      const transaction = entry.transaction;
      const trxNumber = transaction?.transactionRef || entry.reference || entry.entryNumber;
      const trxInfo = decodeTrxCode(trxNumber, transaction?.type || null);
      const transactionDate = transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date(entry.entryDate);
      const sessionDate = new Date(entry.entryDate);
      const debit = Number(entry.debitAmount || 0);
      const credit = Number(entry.creditAmount || 0);
      const glAccountNo = entry.account.accountCode || "0";
      const accountNo = transaction?.account?.accountNumber || "0";
      const name = normalizeDisplayText(
        transaction?.account?.member?.user?.name || transaction?.account?.institution?.institutionName || transaction?.account?.accountNumber || entry.account.accountName,
      );
      const transactionText = normalizeDisplayText(
        entry.description ||
          transaction?.description ||
          entry.reference ||
          transaction?.paymentReference ||
          transaction?.externalReference ||
          transaction?.transactionRef ||
          "",
      );
      const voucherNo = transactionText || normalizeDisplayText(entry.reference || transaction?.paymentReference || transaction?.transactionRef || "Reserve");
      const supervisorName = normalizeDisplayText(entry.createdBy?.name || null) || null;
      const userName = normalizeDisplayText(transaction?.processedByUser?.name || entry.createdBy?.name || "System");
      return {
        gl_account_no: glAccountNo,
        account_no: accountNo,
        name,
        voucher_no: voucherNo,
        trx_number: trxNumber,
        trx_code: trxInfo.code,
        session_date: dateOnly(sessionDate),
        trx_date: dateOnly(transactionDate),
        debit,
        credit,
        supervisor_name: supervisorName,
        user_name: userName,
        transaction_text: transactionText || voucherNo,
        is_debit_leg: debit > 0,
        is_credit_leg: credit > 0,
        trx_type_label: trxInfo.label,
        voucher_group_id: buildAuditVoucherGroupId(trxNumber, voucherNo),
        is_t2r: trxInfo.code === "T2R",
        is_mobile_channel: isMobileChannel(transactionText || voucherNo),
        is_third_party: isThirdPartyText(transactionText || voucherNo),
        has_supervisor: Boolean(supervisorName),
        is_system_account: isSystemAccount(accountNo),
      } satisfies TransactionJournalListingRow;
    })
    .filter((row) => {
      if (input.userName && !row.user_name.toLowerCase().includes(input.userName.toLowerCase())) return false;
      if (input.trxCode && row.trx_code.toLowerCase() !== input.trxCode.toLowerCase()) return false;
      if (input.textSearch && !`${row.transaction_text} ${row.voucher_no}`.toLowerCase().includes(input.textSearch.toLowerCase())) return false;
      if (input.memberSearch && !`${row.name} ${row.account_no}`.toLowerCase().includes(input.memberSearch.toLowerCase())) return false;
      if (input.voucherNo && !`${row.voucher_no} ${row.trx_number}`.toLowerCase().includes(input.voucherNo.toLowerCase())) return false;
      return true;
    });

  rows.sort((a, b) => {
    const trxCompare = a.trx_number.localeCompare(b.trx_number);
    if (trxCompare !== 0) return trxCompare;
    const glCompare = a.gl_account_no.localeCompare(b.gl_account_no);
    if (glCompare !== 0) return glCompare;
    return a.account_no.localeCompare(b.account_no);
  });

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const imbalanceAmount = totalDebit - totalCredit;
  const uniqueVouchers = new Set(rows.map((row) => row.voucher_no)).size;
  const uniqueTellers = new Set(rows.map((row) => row.user_name)).size;
  const uniqueTrxCodes = new Set(rows.map((row) => row.trx_code)).size;
  const mobileChannelCount = rows.filter((row) => row.is_mobile_channel).length;
  const thirdPartyCount = rows.filter((row) => row.is_third_party).length;
  const supervisorCount = rows.filter((row) => row.has_supervisor).length;

  return {
    report_title: "Transaction Journal Listing By Session Date",
    report_meta: {
      sacco_name: REPORT_HEADER_DETAILS.institutionName,
      branch: branchMeta.branchName,
      generated_at: new Date().toISOString(),
      from_date: dateOnly(from),
      to_date: dateOnly(to),
      filter_type: "session_date",
    },
    transactions: rows,
    summary: {
      row_count: rows.length,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: Math.abs(imbalanceAmount) < 0.01,
      imbalance_amount: imbalanceAmount,
      unique_vouchers: uniqueVouchers,
      unique_tellers: uniqueTellers,
      unique_trx_codes: uniqueTrxCodes,
      mobile_channel_count: mobileChannelCount,
      third_party_count: thirdPartyCount,
      supervisor_count: supervisorCount,
    },
    legend: LEGEND,
  };
}

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function baseWorkbook(report: { report_meta: { sacco_name: string; branch: string; generated_at: string } }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.report_meta.sacco_name;
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

export async function buildDaySheetWorkbook(report: DaySheetReport) {
  const workbook = baseWorkbook(report);
  const sheet = workbook.addWorksheet("Day Sheet");
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("K2").value = format(new Date(report.report_meta.generated_at), "dd/MM/yyyy");
  sheet.getCell("K2").alignment = { horizontal: "right" };
  sheet.getCell("K3").value = format(new Date(report.report_meta.generated_at), "HH:mm:ss");
  sheet.getCell("K3").alignment = { horizontal: "right" };
  sheet.mergeCells("A5:K5");
  sheet.getCell("A5").value = report.report_meta.branch;
  sheet.getCell("A5").alignment = { horizontal: "left" };
  sheet.mergeCells("A8:K8");
  sheet.getCell("A8").value = report.report_title;
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };
  sheet.mergeCells("A10:K10");
  sheet.getCell("A10").value = report.filter_label;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  sheet.addRow([]);
  const header = sheet.addRow([
    "Trx No.",
    "GL A/C No.",
    "A/C No.",
    "Name",
    "Trx Code",
    "Voucher No.",
    "Session Date",
    "Trx Date",
    "Debit",
    "Credit",
    "User Name",
  ]);
  header.eachCell((cell) => headerStyle(cell));

  report.transactions.forEach((row) => {
    const excelRow = sheet.addRow([
      row.trx_number,
      row.gl_account_no,
      row.account_no,
      row.name,
      row.trx_code,
      row.voucher_no,
      row.session_date,
      row.trx_date,
      row.debit,
      row.credit,
      row.user_name,
    ]);
    excelRow.getCell(1).font = { name: "Consolas" };
    excelRow.getCell(7).numFmt = "dd/MM/yyyy";
    excelRow.getCell(8).numFmt = "dd/MM/yyyy";
    excelRow.getCell(9).numFmt = "#,##0";
    excelRow.getCell(10).numFmt = "#,##0";
  });

  const totalRow = sheet.addRow([
    `Total: ${report.summary.row_count}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    report.summary.total_debit,
    report.summary.total_credit,
    "",
  ]);
  totalRow.font = { bold: true };

  const balanceRow = sheet.addRow([
    report.summary.is_balanced ? "BALANCED" : "UNBALANCED",
  ]);
  sheet.mergeCells(`A${balanceRow.number}:K${balanceRow.number}`);
  balanceRow.font = { bold: true };
  balanceRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: report.summary.is_balanced ? "FFC6EFCE" : "FFFFC7CE" } };

  sheet.addRow([]);
  sheet.addRow(["Prepared By:_____________    Verified By:_____________"]);
  sheet.addRow(["Approved by:_____________"]);

  sheet.addRow([]);
  const legendTitle = sheet.addRow(["Trx No. Last Character"]);
  legendTitle.font = { bold: true };
  const legendHeader = sheet.addRow(["Code", "Meaning", "", "", "Code", "Meaning", "", "", "Code", "Meaning", "", ""]);
  legendHeader.eachCell((cell) => {
    cell.font = { bold: true };
  });
  for (let index = 0; index < report.legend.length; index += 3) {
    const slice = report.legend.slice(index, index + 3);
    const values = slice.flatMap((item) => [item.code, item.meaning, "", ""]);
    while (values.length < 12) values.push("");
    const legendRow = sheet.addRow(values);
    legendRow.font = { size: 9 };
  }

  return workbook.xlsx.writeBuffer();
}

export async function buildCashierCashStatusWorkbook(report: TellerCashStatusReport) {
  const workbook = baseWorkbook(report);
  const sheet = workbook.addWorksheet("Cashier Status");
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.columns = [
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 24 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:M1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("M2").value = format(new Date(report.report_meta.generated_at), "dd/MM/yyyy");
  sheet.getCell("M2").alignment = { horizontal: "right" };
  sheet.getCell("M3").value = format(new Date(report.report_meta.generated_at), "HH:mm:ss");
  sheet.getCell("M3").alignment = { horizontal: "right" };
  sheet.mergeCells("A5:M5");
  sheet.getCell("A5").value = report.report_meta.branch;
  sheet.mergeCells("A8:M8");
  sheet.getCell("A8").value = "Cashier/Teller Cash Status By Session Date";
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.mergeCells("A10:M10");
  sheet.getCell("A10").value = `Reporting Date( Session Date ): ${formatISODate(report.report_meta.session_date)}`;
  sheet.mergeCells("A11:M11");
  sheet.getCell("A11").value = `Cashier/Teller No.: ${report.report_meta.teller_code}`;

  sheet.addRow([]);
  const header = sheet.addRow(["GL A/C No.", "A/C No.", "Name", "Trx No.", "Time", "Trx Code", "Source", "Voucher No.", "Trx Date", "Debit", "Credit", "Running Balance", "User Name"]);
  header.eachCell((cell) => headerStyle(cell));

  report.transactions.forEach((row) => {
    const excelRow = sheet.addRow([
      row.gl_account_no,
      row.account_no,
      row.name,
      row.trx_number,
      row.time_posted,
      row.trx_code,
      row.source_label,
      row.voucher_no,
      row.trx_date,
      row.debit,
      row.credit,
      row.running_balance,
      row.user_name,
    ]);
    excelRow.getCell(4).font = { name: "Consolas" };
    excelRow.getCell(9).numFmt = "dd/MM/yyyy";
    excelRow.getCell(10).numFmt = "#,##0";
    excelRow.getCell(11).numFmt = "#,##0";
    excelRow.getCell(12).numFmt = "#,##0";
    if (row.is_asset_purchase) {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      excelRow.font = { bold: true };
    } else if (row.source_code === "INCOME") {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
    } else if (row.source_code === "EXPENDITURE") {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
    }
  });

  const totalRow = sheet.addRow([
    `Total: ${report.summary.transaction_count}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    report.summary.total_debit,
    report.summary.total_credit,
    report.summary.closing_balance,
    "",
  ]);
  totalRow.font = { bold: true };

  const statusRow = sheet.addRow([
    `Net Change: ${money(report.summary.net_change)}${report.summary.is_balanced ? " - BALANCED" : " - UNBALANCED"}`,
  ]);
  sheet.mergeCells(`A${statusRow.number}:M${statusRow.number}`);
  statusRow.font = { bold: true };
  statusRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: report.summary.is_balanced ? "FFC6EFCE" : "FFFFC7CE" } };

  sheet.addRow([]);
  sheet.addRow(["Prepared By:_____________    Verified By:_____________"]);
  sheet.addRow(["Approved By:_____________"]);

  sheet.addRow([]);
  const sourceTitle = sheet.addRow(["Source Breakdown"]);
  sourceTitle.font = { bold: true };
  const sourceHeader = sheet.addRow(["Source", "Count", "Debit Total", "Credit Total", "Net Amount"]);
  sourceHeader.eachCell((cell) => {
    cell.font = { bold: true };
  });
  report.source_breakdown.forEach((source) => {
    const row = sheet.addRow([
      source.source_label,
      source.count,
      source.debit_total,
      source.credit_total,
      source.net_amount,
    ]);
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
    row.getCell(5).numFmt = "#,##0";
  });

  sheet.addRow([]);
  const legendTitle = sheet.addRow(["Trx No. Last Character"]);
  legendTitle.font = { bold: true };
  const legendHeader = sheet.addRow(["Code", "Meaning", "", "", "Code", "Meaning", "", "", "Code", "Meaning", "", ""]);
  legendHeader.eachCell((cell) => {
    cell.font = { bold: true };
  });
  for (let index = 0; index < report.legend.length; index += 3) {
    const slice = report.legend.slice(index, index + 3);
    const values = slice.flatMap((item) => [item.code, item.meaning, "", ""]);
    while (values.length < 12) values.push("");
    const legendRow = sheet.addRow(values);
    legendRow.font = { size: 9 };
  }
  return workbook.xlsx.writeBuffer();
}

function writeLegendGrid(sheet: ExcelJS.Worksheet, legend: Array<{ code: string; meaning: string; lastChar: string }>, startRow: number) {
  const header = sheet.getRow(startRow);
  header.getCell(1).value = "Trx No. Last Character:";
  header.getCell(1).font = { bold: true };
  let rowNumber = startRow + 1;
  for (let index = 0; index < legend.length; index += 5) {
    const slice = legend.slice(index, index + 5);
    const row = sheet.getRow(rowNumber++);
    slice.forEach((item, position) => {
      const base = position * 2 + 1;
      row.getCell(base).value = item.code;
      row.getCell(base + 1).value = item.meaning;
      row.getCell(base).font = { bold: true };
      row.getCell(base + 1).font = { size: 9 };
    });
  }
}

export async function buildGeneralTransactionRegisterWorkbook(report: GeneralTransactionRegisterReport) {
  const workbook = baseWorkbook(report);
  const sheet = workbook.addWorksheet("General Register");
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "12:12",
  };
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.columns = [
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 24 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("K2").value = format(new Date(report.report_meta.generated_at), "dd/MM/yyyy");
  sheet.getCell("K2").alignment = { horizontal: "right" };
  sheet.getCell("K3").value = format(new Date(report.report_meta.generated_at), "HH:mm:ss");
  sheet.getCell("K3").alignment = { horizontal: "right" };
  sheet.mergeCells("A5:K5");
  sheet.getCell("A5").value = report.report_meta.branch;
  sheet.getCell("A5").alignment = { horizontal: "left" };
  sheet.mergeCells("A8:K8");
  sheet.getCell("A8").value = report.report_title;
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };
  sheet.mergeCells("A10:K10");
  sheet.getCell("A10").value = `Reporting Date From: ${formatISODate(report.report_meta.from_date)} To: ${formatISODate(report.report_meta.to_date)}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  sheet.addRow([]);
  const header = sheet.addRow([
    "Trx No.",
    "GL A/C No.",
    "A/C No.",
    "Name",
    "Trx Code",
    "Voucher No.",
    "Session Date",
    "Trx Date",
    "Debit",
    "Credit",
    "User Name",
  ]);
  header.eachCell((cell) => headerStyle(cell));

  report.transactions.forEach((row) => {
    const excelRow = sheet.addRow([
      row.trx_number,
      row.gl_account_no,
      row.account_no,
      row.name,
      row.trx_code,
      row.voucher_no,
      row.session_date,
      row.trx_date,
      row.debit,
      row.credit,
      row.user_name,
    ]);
    excelRow.getCell(1).font = { name: "Consolas" };
    excelRow.getCell(7).numFmt = "dd/MM/yyyy";
    excelRow.getCell(8).numFmt = "dd/MM/yyyy";
    excelRow.getCell(9).numFmt = "#,##0";
    excelRow.getCell(10).numFmt = "#,##0";
  });

  const totalRow = sheet.addRow([
    `Total: ${report.summary.row_count}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    report.summary.total_debit,
    report.summary.total_credit,
    "",
  ]);
  totalRow.font = { bold: true };

  const balanceRow = sheet.addRow([
    report.summary.is_balanced
      ? `BALANCED - Debit = Credit = ${money(report.summary.total_debit)}`
      : `UNBALANCED - Difference: ${money(Math.abs(report.summary.imbalance_amount))}`,
  ]);
  sheet.mergeCells(`A${balanceRow.number}:K${balanceRow.number}`);
  balanceRow.font = { bold: true };
  balanceRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: report.summary.is_balanced ? "FFC6EFCE" : "FFFFC7CE" },
  };

  sheet.addRow([]);
  writeLegendGrid(sheet, report.legend, sheet.rowCount + 1);

  return workbook.xlsx.writeBuffer();
}

export async function buildTransactionJournalListingWorkbook(report: TransactionJournalListingReport) {
  const workbook = baseWorkbook(report);
  const sheet = workbook.addWorksheet("Journal Listing");
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "12:13",
  };
  sheet.headerFooter = {
    oddFooter: "&RPage &P of &N   Finance Solutions® 08.45.u",
  };
  sheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = report.report_meta.sacco_name;
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("L2").value = format(new Date(report.report_meta.generated_at), "dd/MM/yyyy");
  sheet.getCell("L2").alignment = { horizontal: "right" };
  sheet.getCell("L3").value = format(new Date(report.report_meta.generated_at), "HH:mm:ss");
  sheet.getCell("L3").alignment = { horizontal: "right" };
  sheet.mergeCells("A5:L5");
  sheet.getCell("A5").value = report.report_meta.branch;
  sheet.getCell("A5").alignment = { horizontal: "left" };
  sheet.mergeCells("A8:L8");
  sheet.getCell("A8").value = report.report_title;
  sheet.getCell("A8").font = { bold: true, size: 14 };
  sheet.getCell("A8").alignment = { horizontal: "center" };
  sheet.mergeCells("A10:L10");
  sheet.getCell("A10").value = `Reporting Date From: ${formatISODate(report.report_meta.from_date)} To: ${formatISODate(report.report_meta.to_date)}`;
  sheet.getCell("A10").alignment = { horizontal: "center" };

  sheet.addRow([]);
  const header = sheet.addRow([
    "GL A/C No.",
    "A/C No.",
    "Name",
    "Voucher No.",
    "Trx No.",
    "Trx Code",
    "Session Date",
    "Trx Date",
    "Debit",
    "Credit",
    "Supervisor Name",
    "User Name",
  ]);
  header.eachCell((cell) => headerStyle(cell));
  const textLabelRow = sheet.addRow(["", "", "", "Text"]);
  textLabelRow.getCell(4).font = { italic: true, bold: true };

  report.transactions.forEach((row) => {
    const excelRow = sheet.addRow([
      row.gl_account_no,
      row.account_no,
      row.name,
      row.voucher_no,
      row.trx_number,
      row.trx_code,
      row.session_date,
      row.trx_date,
      row.debit,
      row.credit,
      row.supervisor_name || "",
      row.user_name,
    ]);
    excelRow.getCell(5).font = { name: "Consolas" };
    excelRow.getCell(7).numFmt = "dd/MM/yyyy";
    excelRow.getCell(8).numFmt = "dd/MM/yyyy";
    excelRow.getCell(9).numFmt = "#,##0";
    excelRow.getCell(10).numFmt = "#,##0";
  });

  const totalRow = sheet.addRow([
    `Total: ${report.summary.row_count}   ${money(report.summary.total_debit)}`,
    "",
    "",
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
  totalRow.font = { bold: true };

  sheet.addRow([]);
  writeLegendGrid(sheet, report.legend, sheet.rowCount + 1);

  return workbook.xlsx.writeBuffer();
}

function formatISODate(value: string) {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "dd/MM/yyyy");
}

export const transactionCodeLegend = LEGEND;

export async function getTransactionTellerOptions(user: AuthUserLike, branchId?: string) {
  const branchMeta = await resolveBranchMeta(user, branchId);
  const tellers = await db.user.findMany({
    where: {
      role: { in: [UserRole.TELLER, UserRole.AGENT] },
      ...(branchMeta.branchId ? { branchId: branchMeta.branchId } : {}),
    },
    select: {
      id: true,
      name: true,
      branch: { select: { name: true } },
      userFloat: {
        select: {
          balance: true,
          isActiveForDay: true,
          currentDayStarted: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return tellers.map((teller) => ({
    id: teller.id,
    name: teller.name,
    branch_name: teller.branch?.name || branchMeta.branchName,
    balance: teller.userFloat?.balance ?? 0,
    is_active_for_day: teller.userFloat?.isActiveForDay ?? false,
    current_day_started: teller.userFloat?.currentDayStarted?.toISOString() || null,
  }));
}
