import ExcelJS from "exceljs";
import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";
import {
  COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME,
  FIXED_DEPOSIT_ACCOUNT_TYPE_NAME,
  JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME,
  VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME,
  getCanonicalSavingsAccountTypeName,
  isCompulsorySavingsAccountTypeName,
  isJuniorSavingsAccountTypeName,
  isVoluntarySavingsAccountTypeName,
} from "@/lib/accounting/account-type-rules";
import {
  BRANCH_LABEL,
  SACCO_NAME,
  formatDate,
  formatDateTime,
  formatUGXPlain,
  generateDescription,
  getDateOnly,
  inferMemberTypeFromShareCode,
  inferProductCode,
  inferSavingsProductName,
  inferShareProductName,
  normalize,
  phoneLooksSuspicious,
  toNumber,
} from "@/lib/reports/member-ledger-utils";

export type PersonalLedgerFilters = {
  memberId?: string;
  memberName?: string;
  institutionId?: string;
  institutionName?: string;
  accountNo?: string;
  fromDate: string;
  toDate: string;
  accountType?: "all" | "savings" | "voluntary" | "compulsory" | "shares" | "fixed" | "loans";
  includeClosed?: boolean;
  branchId?: string;
  user?: any;
};

export type PersonalLedgerMemberProfile = {
  member_id: string;
  full_name: string;
  physical_address: string;
  postal_address: string;
  sex: string;
  date_of_birth: string | null;
  id_card: string;
  ref_no: number | null;
  phone: string;
  mobile: string | null;
  email: string | null;
  occupation: string | null;
  employer: string | null;
  area_code: string | null;
  next_of_kin: string | null;
  kyc_status: "Verified" | "Pending" | "Incomplete";
  member_since: string;
  member_type: "Affiliate" | "Ordinary" | "Associate";
  batch_no: number | null;
  is_active: boolean;
  is_staff: boolean;
};

export type PersonalLedgerInstitutionProfile = {
  institution_id: string;
  institution_number: string;
  institution_name: string;
  institution_type: string;
  registration_number: string | null;
  tin_number: string | null;
  legal_status: string | null;
  physical_address: string;
  postal_address: string;
  primary_contact_person: string;
  primary_contact_title: string | null;
  primary_contact_phone: string;
  primary_contact_email: string | null;
  institution_phone: string;
  institution_email: string | null;
  member_since: string;
  approval_status: "Verified" | "Pending" | "Incomplete";
  is_active: boolean;
  is_staff: boolean;
};

export type PersonalLedgerTransaction = {
  trx_date: string;
  session_date: string;
  trx_number: string;
  trx_code: string;
  voucher_no: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  user_name: string;
};

export type PersonalLedgerAccountSection = {
  account_no: string;
  product_code: string;
  product_name: string;
  date_opened: string;
  status: string;
  account_type: "savings" | "shares" | "fixed" | "loans";
  savings_variant?: "voluntary" | "compulsory" | "junior" | null;
  opening_balance: number;
  transactions: PersonalLedgerTransaction[];
  summary: {
    transaction_count: number;
    total_debit: number;
    total_credit: number;
    closing_balance: number;
  };
  loan_details?: {
    loan_amount: number;
    outstanding_balance: number;
    interest_rate: number;
    maturity_date: string;
    loan_status: string;
  };
};

export type PersonalLedgerReport = {
  report_meta: {
    sacco_name: string;
    branch: string;
    generated_at: string;
    from_date: string;
    to_date: string;
  };
  subject_type: "member" | "institution";
  member?: PersonalLedgerMemberProfile;
  institution?: PersonalLedgerInstitutionProfile;
  accounts: PersonalLedgerAccountSection[];
  grand_summary: {
    total_savings_balance: number;
    total_shares_balance: number;
    total_fixed_deposit_balance: number;
    total_loan_balance: number;
    net_worth: number;
  };
};

type MemberRecord = Prisma.MemberGetPayload<{
  include: {
    user: true;
    accounts: {
      include: {
        accountType: {
          include: {
            ledgerAccount: true;
          };
        };
        branch: true;
        transactions: {
          include: {
            processedByUser: true;
          };
        };
      };
    };
    savingsAccounts: {
      include: {
        accountType: true;
      };
    };
    shareAccounts: {
      include: {
        accountType: true;
      };
    };
    fixedDeposits: true;
    loans: {
      include: {
        loanApplication: {
          include: {
            loanProduct: {
              include: {
                ledgerAccount: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type InstitutionRecord = Prisma.InstitutionGetPayload<{
  include: {
    user: true;
    accounts: {
      include: {
        accountType: {
          include: {
            ledgerAccount: true;
          };
        };
        branch: true;
        transactions: {
          include: {
            processedByUser: true;
          };
        };
      };
    };
    fixedDeposits: true;
    institutionLoans: {
      include: {
        application: {
          include: {
            loanProduct: {
              include: {
                ledgerAccount: true;
              };
            };
          };
        };
        allocatedTeller: true;
        ledgerTransactions: true;
      };
    };
  };
}>;

const OPEN_SAVINGS_STATUSES = new Set(["ACTIVE", "ON_HOLD", "DORMANT", "FROZEN"]);
const OPEN_SHARE_STATUSES = new Set(["ACTIVE", "ON_HOLD", "DORMANT", "FROZEN"]);
const OPEN_FIXED_STATUSES = new Set(["ACTIVE", "RENEWED", "MATURED"]);
const OPEN_LOAN_STATUSES = new Set(["DISBURSED", "OVERDUE", "APPROVED", "UNDER_REVIEW"]);

function sameDayOrBefore(value: Date, cutoff: Date) {
  return value.getTime() <= cutoff.getTime();
}

function normalizeSavingsAccountTypeName(name: string | null | undefined, accountCode?: string | null) {
  const canonical = getCanonicalSavingsAccountTypeName(name);
  if (canonical) return canonical;

  const normalizedCode = String(accountCode || "").trim();
  if (normalizedCode === "201003") return VOLUNTARY_SAVINGS_ACCOUNT_TYPE_NAME;
  if (normalizedCode === "201004") return COMPULSORY_SAVINGS_ACCOUNT_TYPE_NAME;
  if (normalizedCode === "201002") return JUNIOR_SAVINGS_ACCOUNT_TYPE_NAME;
  if (normalizedCode === "201001") return FIXED_DEPOSIT_ACCOUNT_TYPE_NAME;

  return name?.trim() || "Savings";
}

function resolveSavingsVariant(name: string | null | undefined, accountCode?: string | null) {
  const canonical = normalizeSavingsAccountTypeName(name, accountCode);
  if (isVoluntarySavingsAccountTypeName(canonical)) return "voluntary" as const;
  if (isCompulsorySavingsAccountTypeName(canonical)) return "compulsory" as const;
  if (isJuniorSavingsAccountTypeName(canonical)) return "junior" as const;
  return null;
}

function resolveTransactionDirection(type: string) {
  const normalized = String(type || "").toUpperCase();
  const debitTypes = new Set([
    TransactionType.WITHDRAWAL,
    TransactionType.FEE,
    TransactionType.LOAN_REPAYMENT,
    TransactionType.LOAN_FEE,
    TransactionType.SHARES_PURCHASE,
    TransactionType.INSURANCE_PREMIUM,
    TransactionType.FLOAT_PURCHASE,
    "TRANSFER_OUT",
  ]);
  if (debitTypes.has(normalized)) return "debit" as const;
  return "credit" as const;
}

function resolveTransactionDescription(type: string, description: string | null | undefined) {
  if (description?.trim()) return description.trim();

  const normalized = String(type || "").toUpperCase();
  switch (normalized) {
    case TransactionType.DEPOSIT:
      return "Deposit";
    case TransactionType.WITHDRAWAL:
      return "Withdrawal";
    case TransactionType.LOAN_DISBURSEMENT:
      return "Loan Disbursement";
    case TransactionType.LOAN_REPAYMENT:
      return "Loan Repayment";
    case TransactionType.FLOAT_ALLOCATION:
      return "Float Allocation";
    case TransactionType.FLOAT_PURCHASE:
      return "Float Purchase";
    case TransactionType.FLOAT_RECONCILIATION:
      return "Float Reconciliation";
    case TransactionType.FEE:
      return "Fee";
    case TransactionType.TRANSFER:
      return "Transfer";
    case TransactionType.SHARES_PURCHASE:
      return "Shares Purchase";
    case TransactionType.INSURANCE_PREMIUM:
      return "Insurance Premium";
    case TransactionType.LOAN_FEE:
      return "Loan Fee";
    default:
      return "Transaction";
  }
}

function getTransactionUserName(
  user: { name?: string | null; firstName?: string | null; lastName?: string | null } | null | undefined,
) {
  if (!user) return "System";
  return user.name?.trim() || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "System";
}

function amountDeltaFromSavings(tx: any): number {
  const before = toNumber(tx.balanceBefore);
  const after = toNumber(tx.balanceAfter);
  if (Number.isFinite(before) && Number.isFinite(after) && (before !== 0 || after !== 0)) {
    return after - before;
  }

  const amount = toNumber(tx.amount);
  switch (String(tx.transactionType || "").toUpperCase()) {
    case "DEPOSIT":
    case "INTEREST":
    case "TRANSFER_IN":
      return amount;
    case "WITHDRAWAL":
    case "FEE":
    case "TRANSFER_OUT":
      return -amount;
    default:
      return amount;
  }
}

function amountDeltaFromShares(tx: any): number {
  const amount = toNumber(tx.amount);
  switch (String(tx.transactionType || "").toUpperCase()) {
    case "PURCHASE":
    case "TRANSFER_IN":
    case "DIVIDEND":
      return amount;
    case "SALE":
    case "TRANSFER_OUT":
      return -amount;
    default:
      return amount;
  }
}

function amountDeltaFromLoan(tx: any): number {
  return toNumber(tx.debitPrincipal) + toNumber(tx.debitInterest) - toNumber(tx.creditPrincipal) - toNumber(tx.creditInterest);
}

function latestBalanceBeforeSavings(transactions: any[], fromDate: Date): number {
  const prior = transactions
    .filter((tx) => new Date(tx.transactionDate).getTime() < fromDate.getTime())
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
  if (!prior.length) return 0;
  const last = prior[prior.length - 1];
  if (last.balanceAfter !== null && last.balanceAfter !== undefined) return toNumber(last.balanceAfter);
  return prior.reduce((sum, tx) => sum + amountDeltaFromSavings(tx), 0);
}

function latestBalanceBeforeShares(transactions: any[], fromDate: Date): number {
  const prior = transactions
    .filter((tx) => new Date(tx.transactionDate).getTime() < fromDate.getTime())
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
  if (!prior.length) return 0;
  const last = prior[prior.length - 1];
  if (last.sharesAfter !== null && last.sharesAfter !== undefined) return toNumber(last.sharesAfter);
  return prior.reduce((sum, tx) => sum + amountDeltaFromShares(tx), 0);
}

function latestBalanceBeforeLoan(transactions: any[], fromDate: Date): number {
  const prior = transactions
    .filter((tx) => new Date(tx.transactionDate).getTime() < fromDate.getTime())
    .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
  if (!prior.length) return 0;
  const last = prior[prior.length - 1];
  if (last.balanceTotal !== null && last.balanceTotal !== undefined) return toNumber(last.balanceTotal);
  return prior.reduce((sum, tx) => sum + amountDeltaFromLoan(tx), 0);
}

function dateKey(value: Date | string) {
  return new Date(value).toISOString();
}

function sortByDateThenId<T extends { transactionDate?: Date | string; id?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const left = new Date(a.transactionDate || 0).getTime();
    const right = new Date(b.transactionDate || 0).getTime();
    if (left !== right) return left - right;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function deriveMemberType(member: MemberRecord, accounts: PersonalLedgerAccountSection[]): "Affiliate" | "Ordinary" | "Associate" {
  const shareSection = accounts.find((section) => section.account_type === "shares");
  if (shareSection) {
    const inferred = inferMemberTypeFromShareCode(shareSection.product_code);
    if (inferred === "Affiliate" || inferred === "Ordinary" || inferred === "Associate") {
      return inferred;
    }
  }

  const raw = normalize(member.user?.role);
  if (raw.includes("affiliate")) return "Affiliate";
  if (raw.includes("associate")) return "Associate";
  return "Ordinary";
}

function buildProfile(member: MemberRecord, accounts: PersonalLedgerAccountSection[]): PersonalLedgerMemberProfile {
  const fullName =
    member.user?.name?.trim() ||
    [member.surname, member.otherNames].filter(Boolean).join(" ").trim() ||
    member.memberNumber;

  const physicalAddress =
    member.user?.address?.trim() ||
    member.town?.trim() ||
    member.village?.trim() ||
    member.subCounty?.trim() ||
    "";

  const postalAddress = member.postalAddress?.trim() || physicalAddress;
  const dateOfBirth = member.user?.dateOfBirth || null;
  const refNoText = String(member.memberNumber || "").match(/\d+/)?.[0] || "";
  const refNo = refNoText ? Number(refNoText) : null;

  const batchAccount = accounts.find((section) => section.account_type === "shares");
  const batchNoText = batchAccount?.loan_details ? null : String((member as any).batchNo ?? batchAccount?.product_code ?? "");
  const batchNo = batchNoText && /^\d+$/.test(batchNoText) ? Number(batchNoText) : null;

  const isStaff = normalize(member.user?.role) !== "member";
  const kycStatus = member.approvalStatus === "APPROVED" || member.isApproved ? "Verified" : member.idCopyPath || member.passportPhoto ? "Pending" : "Incomplete";

  return {
    member_id: member.id,
    full_name: fullName,
    physical_address: physicalAddress,
    postal_address: postalAddress,
    sex: member.gender ? String(member.gender).charAt(0) + String(member.gender).slice(1).toLowerCase() : "Unknown",
    date_of_birth: dateOfBirth ? dateKey(dateOfBirth).slice(0, 10) : null,
    id_card: member.nin || member.user?.nationalId || member.typeOfId || "",
    ref_no: refNo,
    phone: member.user?.phone || member.certifierPhone || "",
    mobile: null,
    email: member.user?.email || null,
    occupation: member.occupation || member.user?.jobTitle || null,
    employer: null,
    area_code: member.subCounty || member.user?.areaOfOperation || null,
    next_of_kin: member.nokName || member.nominee || null,
    kyc_status: kycStatus,
    member_since: formatDate(
      accounts.reduce<Date | null>((earliest, section) => {
        const sectionDate = new Date(section.date_opened);
        if (Number.isNaN(sectionDate.getTime())) return earliest;
        if (!earliest || sectionDate.getTime() < earliest.getTime()) return sectionDate;
        return earliest;
      }, member.registrationDate),
    ),
    member_type: deriveMemberType(member, accounts),
    batch_no: batchNo,
    is_active: member.user?.isActive ?? true,
    is_staff: isStaff,
  };
}

function buildInstitutionProfile(
  institution: InstitutionRecord,
  accounts: PersonalLedgerAccountSection[],
): PersonalLedgerInstitutionProfile {
  const physicalAddress =
    institution.postalAddress?.trim() ||
    institution.town?.trim() ||
    institution.village?.trim() ||
    institution.subCounty?.trim() ||
    institution.district?.trim() ||
    "";

  const memberSince = formatDate(
    accounts.reduce<Date | null>((earliest, section) => {
      const sectionDate = new Date(section.date_opened);
      if (Number.isNaN(sectionDate.getTime())) return earliest;
      if (!earliest || sectionDate.getTime() < earliest.getTime()) return sectionDate;
      return earliest;
    }, institution.registrationDate),
  );

  return {
    institution_id: institution.id,
    institution_number: institution.institutionNumber,
    institution_name: institution.institutionName,
    institution_type: institution.institutionType,
    registration_number: institution.registrationNumber || null,
    tin_number: institution.tinNumber || null,
    legal_status: institution.legalStatus || null,
    physical_address: physicalAddress,
    postal_address: institution.postalAddress?.trim() || physicalAddress,
    primary_contact_person: institution.primaryContactPerson,
    primary_contact_title: institution.primaryContactTitle || null,
    primary_contact_phone: institution.primaryContactPhone,
    primary_contact_email: institution.primaryContactEmail || null,
    institution_phone: institution.institutionPhone,
    institution_email: institution.institutionEmail || null,
    member_since: memberSince,
    approval_status: institution.isApproved || institution.approvalDate ? "Verified" : institution.rejectionReason ? "Incomplete" : "Pending",
    is_active: institution.user?.isActive ?? true,
    is_staff: true,
  };
}

function toTransactionRow(args: {
  transactionDate: Date;
  sessionDate?: Date | string | null;
  trxNumber: string;
  trxCode: string;
  voucherNo?: string | null;
  voucherText?: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  userName?: string | null;
  descriptionOverride?: string | null;
}): PersonalLedgerTransaction {
  return {
    trx_date: formatDate(args.transactionDate),
    session_date: formatDate(args.sessionDate || args.transactionDate),
    trx_number: args.trxNumber,
    trx_code: args.trxCode,
    voucher_no: args.voucherNo || "",
    description: args.descriptionOverride || generateDescription(args.trxCode, args.voucherText || args.voucherNo || ""),
    debit: Math.round(args.debit),
    credit: Math.round(args.credit),
    running_balance: Math.round(args.runningBalance),
    user_name: args.userName || "System",
  };
}

async function buildSavingsSection(account: any, fromDate: Date, toDate: Date): Promise<PersonalLedgerAccountSection> {
  const savingsTransactions = sortByDateThenId(
    await db.savingsTransaction.findMany({
      where: {
        accountId: account.id,
        transactionDate: {
          lte: toDate,
        },
        isReversed: false,
      },
      include: {
        teller: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  );

  if (savingsTransactions.length > 0) {
    const periodTransactions = savingsTransactions.filter((tx) => {
      const date = new Date(tx.transactionDate);
      return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime();
    });

    const openingBalance = latestBalanceBeforeSavings(savingsTransactions, fromDate);
    let runningBalance = openingBalance;
    const rows = periodTransactions.map((tx: any) => {
      const delta = amountDeltaFromSavings(tx);
      runningBalance += delta;
      const debit = delta < 0 ? Math.abs(delta) : 0;
      const credit = delta > 0 ? delta : 0;
      const trxCode =
        String(tx.transactionType || "").toUpperCase() === "DEPOSIT"
          ? "SD"
          : String(tx.transactionType || "").toUpperCase() === "WITHDRAWAL"
            ? "SW"
            : String(tx.transactionType || "").toUpperCase() === "FEE"
              ? "SWF"
              : String(tx.transactionType || "").toUpperCase() === "TRANSFER_IN"
                ? "SD"
                : String(tx.transactionType || "").toUpperCase() === "TRANSFER_OUT"
                  ? "SW"
                  : "GJ";

      return toTransactionRow({
        transactionDate: tx.transactionDate,
        sessionDate: tx.createdAt || tx.transactionDate,
        trxNumber: (tx.reference || tx.id || "").slice(0, 18),
        trxCode,
        voucherNo: tx.reference || tx.batchId || "",
        voucherText: tx.description || tx.reference || tx.batchId || "",
        debit,
        credit,
        runningBalance,
        userName: tx.teller?.name || [tx.teller?.firstName, tx.teller?.lastName].filter(Boolean).join(" ").trim() || "System",
        descriptionOverride: tx.description || null,
      });
    });

    return {
      account_no: account.accountNumber,
      product_code: inferProductCode(account.accountNumber, account.accountType?.ledgerAccount?.accountCode || "201003"),
      product_name: normalizeSavingsAccountTypeName(account.accountType?.name, account.accountType?.ledgerAccount?.accountCode) || inferSavingsProductName(inferProductCode(account.accountNumber, "201003")),
      date_opened: formatDate(account.openedDate || account.openedAt || account.createdAt || new Date()),
      status: account.status,
      account_type: "savings",
      savings_variant: resolveSavingsVariant(account.accountType?.name, account.accountType?.ledgerAccount?.accountCode),
      opening_balance: openingBalance,
      transactions: rows,
      summary: {
        transaction_count: rows.length,
        total_debit: rows.reduce((sum: number, row) => sum + row.debit, 0),
        total_credit: rows.reduce((sum: number, row) => sum + row.credit, 0),
        closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
      },
    };
  }

  const coreAccount = await db.account.findFirst({
    where: {
      accountNumber: account.accountNumber,
      ...(account.memberId ? { memberId: account.memberId } : {}),
    },
    select: {
      accountNumber: true,
      balance: true,
      status: true,
      openedAt: true,
      memberId: true,
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
        where: {
          status: { not: TransactionStatus.REVERSED },
        },
        orderBy: {
          transactionDate: "asc",
        },
        select: {
          id: true,
          transactionDate: true,
          valueDate: true,
          transactionRef: true,
          type: true,
          amount: true,
          description: true,
          processedByUser: {
            select: {
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!coreAccount) {
    return {
      account_no: account.accountNumber,
      product_code: inferProductCode(account.accountNumber, account.accountType?.ledgerAccount?.accountCode || "201003"),
      product_name: normalizeSavingsAccountTypeName(account.accountType?.name, account.accountType?.ledgerAccount?.accountCode) || inferSavingsProductName(inferProductCode(account.accountNumber, "201003")),
      date_opened: formatDate(account.openedDate || account.openedAt || account.createdAt || new Date()),
      status: account.status,
      account_type: "savings",
      savings_variant: resolveSavingsVariant(account.accountType?.name, account.accountType?.ledgerAccount?.accountCode),
      opening_balance: toNumber(account.balance || 0),
      transactions: [],
      summary: {
        transaction_count: 0,
        total_debit: 0,
        total_credit: 0,
        closing_balance: toNumber(account.balance || 0),
      },
    };
  }

  const allTransactions = [...(coreAccount.transactions || [])].sort(
    (left, right) => new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime(),
  );
  const balanceRows: Array<PersonalLedgerTransaction & { transactionDateValue: Date; openingBalance: number }> = [];
  let runningBalance = toNumber(coreAccount.balance || 0);

  for (let index = allTransactions.length - 1; index >= 0; index -= 1) {
    const tx: any = allTransactions[index];
    const amount = toNumber(tx.amount);
    const direction = resolveTransactionDirection(tx.type);
    const balanceAfter = runningBalance;
    const balanceBefore = direction === "credit" ? balanceAfter - amount : balanceAfter + amount;
    const transactionDate = new Date(tx.transactionDate);

    balanceRows.unshift({
      transactionDateValue: transactionDate,
      openingBalance: balanceBefore,
      ...toTransactionRow({
        transactionDate,
        sessionDate: tx.valueDate || tx.transactionDate,
        trxNumber: String(tx.transactionRef || tx.id || "").slice(0, 18),
        trxCode: direction === "debit" ? "SW" : "SD",
        voucherNo: tx.transactionRef || tx.id || "",
        voucherText: tx.description || tx.type || "",
        debit: direction === "debit" ? amount : 0,
        credit: direction === "credit" ? amount : 0,
        runningBalance: balanceAfter,
        userName: getTransactionUserName(tx.processedByUser),
        descriptionOverride: resolveTransactionDescription(tx.type, tx.description),
      }),
    });

    runningBalance = balanceBefore;
  }

  const periodTransactions = balanceRows.filter((row) => {
    const time = row.transactionDateValue.getTime();
    return time >= fromDate.getTime() && time <= toDate.getTime();
  });

  const openingBalance =
    periodTransactions[0]?.openingBalance ??
    balanceRows.find((row) => row.transactionDateValue.getTime() >= fromDate.getTime())?.openingBalance ??
    (() => {
      const priorRows = balanceRows.filter((row) => row.transactionDateValue.getTime() < fromDate.getTime());
      return priorRows[priorRows.length - 1]?.running_balance;
    })() ??
    toNumber(coreAccount.balance || 0);

  const rows = periodTransactions.map(({ transactionDateValue: _transactionDateValue, openingBalance: _openingBalance, ...row }) => row);

  return {
    account_no: coreAccount.accountNumber,
    product_code: coreAccount.accountType?.ledgerAccount?.accountCode || inferProductCode(coreAccount.accountNumber, "201003"),
    product_name: normalizeSavingsAccountTypeName(coreAccount.accountType?.name, coreAccount.accountType?.ledgerAccount?.accountCode) || coreAccount.accountType?.ledgerAccount?.accountName || coreAccount.accountType?.name || "Savings",
    date_opened: formatDate(coreAccount.openedAt),
    status: coreAccount.status,
    account_type: "savings",
    savings_variant: resolveSavingsVariant(coreAccount.accountType?.name, coreAccount.accountType?.ledgerAccount?.accountCode),
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum: number, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum: number, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
  };
}

async function buildShareSection(account: any, fromDate: Date, toDate: Date): Promise<PersonalLedgerAccountSection> {
  const transactions = sortByDateThenId(
    await db.shareTransaction.findMany({
      where: {
        accountId: account.id,
        transactionDate: {
          lte: toDate,
        },
        isReversed: false,
      },
      include: {
        teller: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  );

  const openingBalance = latestBalanceBeforeShares(transactions, fromDate);
  let runningBalance = openingBalance;
  const periodTransactions = transactions.filter((tx) => {
    const date = new Date(tx.transactionDate);
    return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime();
  });

  const rows = periodTransactions.map((tx: any) => {
    const delta = amountDeltaFromShares(tx);
    runningBalance += delta;
    const debit = delta < 0 ? Math.abs(delta) : 0;
    const credit = delta > 0 ? delta : 0;
    const trxCode =
      String(tx.transactionType || "").toUpperCase() === "PURCHASE"
        ? "SD"
        : String(tx.transactionType || "").toUpperCase() === "SALE"
          ? "SW"
          : String(tx.transactionType || "").toUpperCase() === "TRANSFER_IN"
            ? "SD"
            : String(tx.transactionType || "").toUpperCase() === "TRANSFER_OUT"
              ? "SW"
              : String(tx.transactionType || "").toUpperCase() === "DIVIDEND"
                ? "GJ"
                : "GJ";

    return toTransactionRow({
      transactionDate: tx.transactionDate,
      sessionDate: tx.createdAt || tx.transactionDate,
      trxNumber: (tx.reference || tx.id || "").slice(0, 18),
      trxCode,
      voucherNo: tx.reference || tx.batchId || "",
      voucherText: tx.description || tx.reference || tx.batchId || "",
      debit,
      credit,
      runningBalance,
      userName: tx.teller?.name || [tx.teller?.firstName, tx.teller?.lastName].filter(Boolean).join(" ").trim() || "System",
      descriptionOverride: tx.description || null,
    });
  });

  return {
    account_no: account.accountNumber,
    product_code: inferProductCode(account.accountNumber, account.accountType?.ledgerAccount?.accountCode || "300502"),
    product_name: account.accountType?.name || inferShareProductName(inferProductCode(account.accountNumber, "300502")),
    date_opened: formatDate(account.openedDate),
    status: account.status,
    account_type: "shares",
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum: number, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum: number, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
  };
}

const ACCOUNT_NAME_TO_PRODUCT: Record<string, string> = {
  "affiliate shares": "300501",
  "ordinary shares": "300502",
  "associate shares": "300503",
};

function resolveShareProductCode(typeName: string): string {
  const key = typeName.toLowerCase().trim();
  return ACCOUNT_NAME_TO_PRODUCT[key] || "";
}

async function buildInstitutionShareSection(account: any, fromDate: Date, toDate: Date): Promise<PersonalLedgerAccountSection> {
  const transactions = sortByDateThenId(
    await db.transaction.findMany({
      where: {
        accountId: account.id,
        type: { in: ["SHARES_PURCHASE" as any, "DEPOSIT" as any] },
        status: "COMPLETED" as any,
        transactionDate: { lte: toDate },
      },
      include: {
        processedByUser: {
          select: { name: true, firstName: true, lastName: true },
        },
      },
    }),
  );

  const openingBalance = latestBalanceBeforeShares(transactions, fromDate);
  let runningBalance = openingBalance;
  const periodTransactions = transactions.filter((tx) => {
    const date = new Date(tx.transactionDate);
    return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime();
  });

  const rows = periodTransactions.map((tx: any) => {
    const delta = toNumber(tx.amount);
    runningBalance += delta;
    const credit = delta;
    const debit = 0;
    const trxCode = "SD";

    return toTransactionRow({
      transactionDate: tx.transactionDate,
      sessionDate: tx.valueDate || tx.transactionDate,
      trxNumber: (tx.transactionRef || tx.id || "").slice(0, 18),
      trxCode,
      voucherNo: tx.transactionRef || "",
      voucherText: tx.description || tx.transactionRef || "",
      debit,
      credit,
      runningBalance,
      userName: tx.processedByUser?.name || [tx.processedByUser?.firstName, tx.processedByUser?.lastName].filter(Boolean).join(" ").trim() || "System",
      descriptionOverride: tx.description || null,
    });
  });

  const typeName = account.accountType?.name || "";
  const productCode = resolveShareProductCode(typeName) || account.accountNumber.split(".")[0] || "300502";

  return {
    account_no: account.accountNumber,
    product_code: productCode,
    product_name: account.accountType?.name || "SHARES",
    date_opened: formatDate(account.openedAt),
    status: account.status,
    account_type: "shares",
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum: number, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum: number, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
  };
}

async function buildFixedDepositSection(account: any, fromDate: Date, toDate: Date): Promise<PersonalLedgerAccountSection> {
  const openingDate = new Date(account.startDate);
  const rows: PersonalLedgerTransaction[] = [];
  const openingBalance = sameDayOrBefore(openingDate, fromDate) ? toNumber(account.principalAmount) : 0;
  let runningBalance = openingBalance;

  if (openingDate.getTime() >= fromDate.getTime() && openingDate.getTime() <= toDate.getTime()) {
    runningBalance += toNumber(account.principalAmount);
    rows.push(
      toTransactionRow({
        transactionDate: openingDate,
        sessionDate: account.createdAt || openingDate,
        trxNumber: account.accountNumber.slice(0, 18),
        trxCode: "AOF",
        voucherNo: account.accountNumber,
        voucherText: account.status,
        debit: 0,
        credit: toNumber(account.principalAmount),
        runningBalance,
        userName: "System",
        descriptionOverride: "Fixed Deposit Opening",
      }),
    );
  }

  if (account.withdrawnDate) {
    const withdrawnDate = new Date(account.withdrawnDate);
    if (withdrawnDate.getTime() >= fromDate.getTime() && withdrawnDate.getTime() <= toDate.getTime()) {
      const amount = toNumber(account.withdrawnAmount || account.principalAmount);
      runningBalance -= amount;
      rows.push(
        toTransactionRow({
          transactionDate: withdrawnDate,
          sessionDate: account.updatedAt || withdrawnDate,
          trxNumber: account.accountNumber.slice(0, 18),
          trxCode: "GJ",
          voucherNo: account.accountNumber,
          voucherText: "Fixed deposit withdrawn",
          debit: amount,
          credit: 0,
          runningBalance,
          userName: "System",
          descriptionOverride: "Fixed Deposit Withdrawal",
        }),
      );
    }
  }

  if (account.maturityDate) {
    const maturityDate = new Date(account.maturityDate);
    if (maturityDate.getTime() >= fromDate.getTime() && maturityDate.getTime() <= toDate.getTime() && !account.withdrawnDate) {
      rows.push(
        toTransactionRow({
          transactionDate: maturityDate,
          sessionDate: account.updatedAt || maturityDate,
          trxNumber: account.accountNumber.slice(0, 18),
          trxCode: "GJ",
          voucherNo: account.accountNumber,
          voucherText: "Fixed deposit matured",
          debit: 0,
          credit: 0,
          runningBalance,
          userName: "System",
          descriptionOverride: "Fixed Deposit Matured",
        }),
      );
    }
  }

  return {
    account_no: account.accountNumber,
    product_code: "201001",
    product_name: "FIXED DEPOSIT SAVINGS",
    date_opened: formatDate(account.startDate),
    status: account.status,
    account_type: "fixed",
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
  };
}

async function buildLoanSection(account: any, fromDate: Date, toDate: Date): Promise<PersonalLedgerAccountSection> {
  const transactions = sortByDateThenId(
    await db.loanLedgerTransaction.findMany({
      where: {
        loanId: account.id,
        transactionDate: {
          lte: toDate,
        },
      },
      orderBy: [
        {
          transactionDate: "asc",
        },
      ],
    }),
  );

  const openingBalance = latestBalanceBeforeLoan(transactions, fromDate);
  let runningBalance = openingBalance;
  const periodTransactions = transactions.filter((tx) => {
    const date = new Date(tx.transactionDate);
    return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime();
  });

  const rows = periodTransactions.map((tx: any) => {
    const debit = toNumber(tx.debitPrincipal) + toNumber(tx.debitInterest);
    const credit = toNumber(tx.creditPrincipal) + toNumber(tx.creditInterest);
    const delta = debit - credit;
    runningBalance += delta;

    return toTransactionRow({
      transactionDate: tx.transactionDate,
      sessionDate: tx.createdAt || tx.transactionDate,
      trxNumber: (tx.id || tx.voucherNo || "").slice(0, 18),
      trxCode: String(tx.transactionType || "LP").toUpperCase(),
      voucherNo: tx.voucherNo || "",
      voucherText: tx.voucherNo || tx.transactionType || "",
      debit,
      credit,
      runningBalance: tx.balanceTotal !== null && tx.balanceTotal !== undefined ? toNumber(tx.balanceTotal) : runningBalance,
      userName: account.allocatedTeller?.name || account.disbursedByUser?.name || "System",
      descriptionOverride: generateDescription(String(tx.transactionType || "LP").toUpperCase(), tx.voucherNo || ""),
    });
  });

  const loanProduct = account.loanApplication?.loanProduct;
  const productCode = loanProduct?.ledgerAccount?.accountCode || inferProductCode(loanProduct?.ledgerAccount?.accountCode || "", "107001");

  return {
    account_no: account.loanApplication?.loanProduct?.ledgerAccount?.accountCode || account.id.slice(0, 18),
    product_code: productCode,
    product_name: loanProduct?.name || "LOAN",
    date_opened: formatDate(account.disbursementDate || account.createdAt),
    status: account.status,
    account_type: "loans",
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
    loan_details: {
      loan_amount: toNumber(account.amountGranted),
      outstanding_balance: toNumber(account.outstandingBalance),
      interest_rate: toNumber(account.interestRate),
      maturity_date: formatDate(account.dueDate),
      loan_status: String(account.status || ""),
    },
  };
}

async function buildInstitutionLoanSection(
  loan: any,
  fromDate: Date,
  toDate: Date,
): Promise<PersonalLedgerAccountSection> {
  const transactions = sortByDateThenId(
    await db.institutionLoanLedgerTransaction.findMany({
      where: {
        loanId: loan.id,
        transactionDate: {
          lte: toDate,
        },
      },
      orderBy: [
        {
          transactionDate: "asc",
        },
      ],
    }),
  );

  const openingBalance = latestBalanceBeforeLoan(transactions, fromDate);
  let runningBalance = openingBalance;
  const periodTransactions = transactions.filter((tx) => {
    const date = new Date(tx.transactionDate);
    return date.getTime() >= fromDate.getTime() && date.getTime() <= toDate.getTime();
  });

  const rows = periodTransactions.map((tx: any) => {
    const debit = toNumber(tx.debitPrincipal) + toNumber(tx.debitInterest);
    const credit = toNumber(tx.creditPrincipal) + toNumber(tx.creditInterest);
    runningBalance = tx.balanceTotal !== null && tx.balanceTotal !== undefined ? toNumber(tx.balanceTotal) : runningBalance + debit - credit;

    return toTransactionRow({
      transactionDate: tx.transactionDate,
      sessionDate: tx.createdAt || tx.transactionDate,
      trxNumber: (tx.id || tx.voucherNo || "").slice(0, 18),
      trxCode: String(tx.transactionType || "IL").toUpperCase(),
      voucherNo: tx.voucherNo || "",
      voucherText: tx.voucherNo || tx.transactionType || "",
      debit,
      credit,
      runningBalance,
      userName: loan.allocatedTeller?.name || "System",
      descriptionOverride: generateDescription(String(tx.transactionType || "IL").toUpperCase(), tx.voucherNo || ""),
    });
  });

  const loanProduct = loan.application?.loanProduct;
  const productCode = loanProduct?.ledgerAccount?.accountCode || inferProductCode(loanProduct?.ledgerAccount?.accountCode || "", "107001");

  return {
    account_no: loan.application?.loanProduct?.ledgerAccount?.accountCode || loan.id.slice(0, 18),
    product_code: productCode,
    product_name: loanProduct?.name || "INSTITUTION LOAN",
    date_opened: formatDate(loan.disbursementDate || loan.createdAt),
    status: loan.status,
    account_type: "loans",
    opening_balance: openingBalance,
    transactions: rows,
    summary: {
      transaction_count: rows.length,
      total_debit: rows.reduce((sum: number, row) => sum + row.debit, 0),
      total_credit: rows.reduce((sum: number, row) => sum + row.credit, 0),
      closing_balance: rows.length ? rows[rows.length - 1].running_balance : openingBalance,
    },
    loan_details: {
      loan_amount: toNumber(loan.amountGranted),
      outstanding_balance: toNumber(loan.outstandingBalance),
      interest_rate: toNumber(loan.interestRate),
      maturity_date: formatDate(loan.dueDate),
      loan_status: String(loan.status || ""),
    },
  };
}

async function resolveMember(filters: PersonalLedgerFilters): Promise<MemberRecord> {
  const memberId = filters.memberId?.trim();
  const memberName = filters.memberName?.trim();
  const accountNo = filters.accountNo?.trim();

  if (memberId) {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
        accounts: {
          include: {
            accountType: {
              include: {
                ledgerAccount: true,
              },
            },
            branch: true,
            transactions: {
              include: {
                processedByUser: true,
              },
            },
          },
        },
        savingsAccounts: { include: { accountType: true } },
        shareAccounts: { include: { accountType: true } },
        fixedDeposits: true,
        loans: {
          include: {
            loanApplication: {
              include: {
                loanProduct: {
                  include: {
                    ledgerAccount: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (member) return member;
  }

  if (accountNo) {
    // Account is the master source (TXN-001) — look up via Account not SavingsAccount.
    const acct = await db.account.findUnique({
      where: { accountNumber: accountNo },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: {
                  include: {
                    ledgerAccount: true,
                  },
                },
                branch: true,
                transactions: {
                  include: {
                    processedByUser: true,
                  },
                },
              },
            },
            savingsAccounts: { include: { accountType: true } },
            shareAccounts: { include: { accountType: true } },
            fixedDeposits: true,
            loans: {
              include: {
                loanApplication: {
                  include: {
                    loanProduct: {
                      include: { ledgerAccount: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (acct?.member) return acct.member;

    const share = await db.shareAccount.findUnique({
      where: { accountNumber: accountNo },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: {
                  include: {
                    ledgerAccount: true,
                  },
                },
                branch: true,
                transactions: {
                  include: {
                    processedByUser: true,
                  },
                },
              },
            },
            savingsAccounts: { include: { accountType: true } },
            shareAccounts: { include: { accountType: true } },
            fixedDeposits: true,
            loans: {
              include: {
                loanApplication: {
                  include: {
                    loanProduct: {
                      include: { ledgerAccount: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (share?.member) return share.member;

    const fixedDeposit = await db.fixedDeposit.findUnique({
      where: { accountNumber: accountNo },
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: {
                  include: {
                    ledgerAccount: true,
                  },
                },
                branch: true,
                transactions: {
                  include: {
                    processedByUser: true,
                  },
                },
              },
            },
            savingsAccounts: { include: { accountType: true } },
            shareAccounts: { include: { accountType: true } },
            fixedDeposits: true,
            loans: {
              include: {
                loanApplication: {
                  include: {
                    loanProduct: {
                      include: { ledgerAccount: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (fixedDeposit?.member) return fixedDeposit.member;
  }

  if (memberName) {
    const member = await db.member.findFirst({
      where: {
        OR: [
          {
            user: {
              name: {
                contains: memberName,
                mode: "insensitive",
              },
            },
          },
          {
            memberNumber: {
              contains: memberName,
              mode: "insensitive",
            },
          },
          {
            surname: {
              contains: memberName,
              mode: "insensitive",
            },
          },
          {
            otherNames: {
              contains: memberName,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        user: true,
        accounts: {
          include: {
            accountType: {
              include: {
                ledgerAccount: true,
              },
            },
            branch: true,
            transactions: {
              include: {
                processedByUser: true,
              },
            },
          },
        },
        savingsAccounts: { include: { accountType: true } },
        shareAccounts: { include: { accountType: true } },
        fixedDeposits: true,
        loans: {
          include: {
            loanApplication: {
              include: {
                loanProduct: {
                  include: {
                    ledgerAccount: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (member) return member;
  }

  throw new Error("Member not found");
}

async function resolveInstitution(filters: PersonalLedgerFilters): Promise<InstitutionRecord> {
  const institutionId = filters.institutionId?.trim();
  const institutionName = filters.institutionName?.trim();
  const accountNo = filters.accountNo?.trim();

  const include = {
    user: true,
    accounts: {
      include: {
        accountType: {
          include: {
            ledgerAccount: true,
          },
        },
        branch: true,
        transactions: {
          include: {
            processedByUser: true,
          },
        },
      },
    },
    fixedDeposits: true,
    institutionLoans: {
      include: {
        application: {
          include: {
            loanProduct: {
              include: {
                ledgerAccount: true,
              },
            },
          },
        },
        allocatedTeller: true,
        ledgerTransactions: true,
      },
    },
  } as const;

  if (institutionId) {
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      include,
    });
    if (institution) return institution as InstitutionRecord;
  }

  if (accountNo) {
    const account = await db.account.findUnique({
      where: { accountNumber: accountNo },
      include: {
        institution: {
          include,
        },
      },
    });
    if (account?.institution) return account.institution as InstitutionRecord;

    const fixedDeposit = await db.fixedDeposit.findUnique({
      where: { accountNumber: accountNo },
      include: {
        institution: {
          include,
        },
      },
    });
    if (fixedDeposit?.institution) return fixedDeposit.institution as InstitutionRecord;
  }

  if (institutionName) {
    const institution = await db.institution.findFirst({
      where: {
        OR: [
          {
            institutionName: {
              contains: institutionName,
              mode: "insensitive",
            },
          },
          {
            institutionNumber: {
              contains: institutionName,
              mode: "insensitive",
            },
          },
          {
            institutionPhone: {
              contains: institutionName,
              mode: "insensitive",
            },
          },
          {
            institutionEmail: {
              contains: institutionName,
              mode: "insensitive",
            },
          },
        ],
      },
      include,
    });
    if (institution) return institution as InstitutionRecord;
  }

  throw new Error("Institution not found");
}

async function resolveLedgerSubject(
  filters: PersonalLedgerFilters,
): Promise<{ kind: "member"; member: MemberRecord } | { kind: "institution"; institution: InstitutionRecord }> {
  if (filters.institutionId || filters.institutionName) {
    return { kind: "institution", institution: await resolveInstitution(filters) };
  }

  try {
    return { kind: "member", member: await resolveMember(filters) };
  } catch {
    if (filters.accountNo) {
      const accountNo = filters.accountNo.trim();
      const account = await db.account.findUnique({
        where: { accountNumber: accountNo },
        include: {
          member: {
            include: {
              user: true,
              accounts: {
                include: {
                  accountType: {
                    include: {
                      ledgerAccount: true,
                    },
                  },
                  branch: true,
                  transactions: {
                    include: {
                      processedByUser: true,
                    },
                  },
                },
              },
              savingsAccounts: { include: { accountType: true } },
              shareAccounts: { include: { accountType: true } },
              fixedDeposits: true,
              loans: {
                include: {
                  loanApplication: {
                    include: {
                      loanProduct: {
                        include: { ledgerAccount: true },
                      },
                    },
                  },
                },
              },
            },
          },
          institution: {
            include: {
              user: true,
              accounts: {
                include: {
                  accountType: {
                    include: {
                      ledgerAccount: true,
                    },
                  },
                  branch: true,
                  transactions: {
                    include: {
                      processedByUser: true,
                    },
                  },
                },
              },
              fixedDeposits: true,
              institutionLoans: {
                include: {
                  application: {
                    include: {
                      loanProduct: {
                        include: {
                          ledgerAccount: true,
                        },
                      },
                    },
                  },
                  allocatedTeller: true,
                  ledgerTransactions: true,
                },
              },
            },
          },
        },
      });
      if (account?.member) return { kind: "member", member: account.member as MemberRecord };
      if (account?.institution) return { kind: "institution", institution: account.institution as InstitutionRecord };
    }
    throw new Error("Ledger subject not found");
  }
}

function filterSavingsAccounts(member: MemberRecord, includeClosed: boolean) {
  return member.savingsAccounts.filter((account) => includeClosed || OPEN_SAVINGS_STATUSES.has(String(account.status)));
}

function filterShareAccounts(member: MemberRecord, includeClosed: boolean) {
  return member.shareAccounts.filter((account) => includeClosed || OPEN_SHARE_STATUSES.has(String(account.status)));
}

function filterFixedDeposits(member: MemberRecord, includeClosed: boolean) {
  return member.fixedDeposits.filter((account) => includeClosed || OPEN_FIXED_STATUSES.has(String(account.status)));
}

function filterLoans(member: MemberRecord, includeClosed: boolean) {
  return member.loans.filter((loan) => includeClosed || OPEN_LOAN_STATUSES.has(String(loan.status)));
}

function matchesAccountType(
  accountType: PersonalLedgerAccountSection["account_type"],
  filter?: PersonalLedgerFilters["accountType"],
  savingsVariant?: PersonalLedgerAccountSection["savings_variant"],
) {
  if (!filter || filter === "all") return true;
  if (filter === "savings") return accountType === "savings";
  if (filter === "voluntary") return accountType === "savings" && savingsVariant === "voluntary";
  if (filter === "compulsory") return accountType === "savings" && savingsVariant === "compulsory";
  return accountType === filter;
}

export async function buildPersonalLedgerReport(filters: PersonalLedgerFilters): Promise<PersonalLedgerReport> {
  if (!filters.fromDate || !filters.toDate) {
    throw new Error("fromDate and toDate are required");
  }

  const fromDate = getDateOnly(filters.fromDate);
  const toDate = getDateOnly(filters.toDate);
  toDate.setHours(23, 59, 59, 999);
  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("fromDate cannot be later than toDate");
  }

  const accounts: PersonalLedgerAccountSection[] = [];
  const subject = await resolveLedgerSubject(filters);

  const effectiveBranchId = filters.user
    ? (await getBranchFilterForService(filters.user, filters.branchId)).branchId
    : filters.branchId;

  if (subject.kind === "member") {
    const member = subject.member;
    const seenSavingsAccountNumbers = new Set<string>();

    for (const account of filterSavingsAccounts(member, !!filters.includeClosed)) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      const savingsVariant = resolveSavingsVariant(account.accountType?.name);
      if (!matchesAccountType("savings", filters.accountType, savingsVariant)) continue;
      seenSavingsAccountNumbers.add(account.accountNumber);
      accounts.push(await buildSavingsSection(account, fromDate, toDate));
    }

    for (const account of member.accounts.filter((item) => {
      const variant = resolveSavingsVariant(item.accountType?.name);
      if (!variant) return false;
      if (seenSavingsAccountNumbers.has(item.accountNumber)) return false;
      if (!filters.includeClosed && !OPEN_SAVINGS_STATUSES.has(String(item.status))) return false;
      return true;
    })) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      const variant = resolveSavingsVariant(account.accountType?.name);
      if (!variant) continue;
      if (!matchesAccountType("savings", filters.accountType, variant)) continue;
      accounts.push(await buildSavingsSection(account, fromDate, toDate));
    }

    for (const account of filterShareAccounts(member, !!filters.includeClosed)) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("shares", filters.accountType)) continue;
      accounts.push(await buildShareSection(account, fromDate, toDate));
    }

    for (const account of filterFixedDeposits(member, !!filters.includeClosed)) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("fixed", filters.accountType)) continue;
      accounts.push(await buildFixedDepositSection(account, fromDate, toDate));
    }

    for (const account of filterLoans(member, !!filters.includeClosed)) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("loans", filters.accountType)) continue;
      accounts.push(await buildLoanSection(account, fromDate, toDate));
    }
  } else {
    const institution = subject.institution;
    const seenSavingsAccountNumbers = new Set<string>();

    for (const account of institution.accounts) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      const savingsVariant = resolveSavingsVariant(account.accountType?.name, account.accountType?.ledgerAccount?.accountCode);
      if (!savingsVariant) continue;
      if (!filters.includeClosed && !OPEN_SAVINGS_STATUSES.has(String(account.status))) continue;
      if (!matchesAccountType("savings", filters.accountType, savingsVariant)) continue;
      seenSavingsAccountNumbers.add(account.accountNumber);
      accounts.push(await buildSavingsSection(account, fromDate, toDate));
    }

    for (const account of institution.fixedDeposits) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("fixed", filters.accountType)) continue;
      if (!filters.includeClosed && !OPEN_FIXED_STATUSES.has(String(account.status))) continue;
      accounts.push(await buildFixedDepositSection(account, fromDate, toDate));
    }

    for (const loan of institution.institutionLoans) {
      if (effectiveBranchId && effectiveBranchId !== "all" && (loan as any).branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("loans", filters.accountType)) continue;
      if (!filters.includeClosed && !OPEN_LOAN_STATUSES.has(String(loan.status))) continue;
      accounts.push(await buildInstitutionLoanSection(loan, fromDate, toDate));
    }

    // Institution share accounts live in Account model (ShareAccount requires memberId)
    const institutionShareAccounts = await db.account.findMany({
      where: {
        institutionId: institution.id,
        accountType: { isShareAccount: true },
      },
      include: {
        accountType: true,
        branch: true,
      },
    });
    for (const account of institutionShareAccounts) {
      if (effectiveBranchId && effectiveBranchId !== "all" && account.branchId !== effectiveBranchId) continue;
      if (!matchesAccountType("shares", filters.accountType)) continue;
      if (!filters.includeClosed && !OPEN_SHARE_STATUSES.has(String(account.status))) continue;
      accounts.push(await buildInstitutionShareSection(account, fromDate, toDate));
    }
  }

  const memberProfile = subject.kind === "member" ? buildProfile(subject.member, accounts) : undefined;
  const institutionProfile = subject.kind === "institution" ? buildInstitutionProfile(subject.institution, accounts) : undefined;

  const totalSavings = accounts
    .filter((account) => account.account_type === "savings")
    .reduce((sum, account) => sum + account.summary.closing_balance, 0);
  const totalShares = accounts
    .filter((account) => account.account_type === "shares")
    .reduce((sum, account) => sum + account.summary.closing_balance, 0);
  const totalFixed = accounts
    .filter((account) => account.account_type === "fixed")
    .reduce((sum, account) => sum + account.summary.closing_balance, 0);
  const totalLoans = accounts
    .filter((account) => account.account_type === "loans")
    .reduce((sum, account) => sum + account.summary.closing_balance, 0);

  return {
    report_meta: {
      sacco_name: SACCO_NAME,
      branch: BRANCH_LABEL,
      generated_at: new Date().toISOString(),
      from_date: formatDate(fromDate),
      to_date: formatDate(toDate),
    },
    subject_type: subject.kind,
    member: memberProfile,
    institution: institutionProfile,
    accounts: accounts.sort((left, right) => {
      const order = { savings: 0, shares: 1, fixed: 2, loans: 3 } as const;
      return order[left.account_type] - order[right.account_type] || left.date_opened.localeCompare(right.date_opened);
    }),
    grand_summary: {
      total_savings_balance: totalSavings,
      total_shares_balance: totalShares,
      total_fixed_deposit_balance: totalFixed,
      total_loan_balance: totalLoans,
      net_worth: totalSavings + totalShares + totalFixed - totalLoans,
    },
  };
}

export async function searchPersonalLedgerMembers(query: string) {
  const q = query.trim();
  if (!q) return [];

  const like = `%${q}%`;
  const members = await db.$queryRaw<
    Array<{
      member_id: string;
      member_number: string;
      full_name: string | null;
      phone: string | null;
      account_number: string | null;
      account_kind: string | null;
    }>
  >`
    SELECT DISTINCT ON (m."id")
      m."id" AS member_id,
      m."memberNumber" AS member_number,
      u."name" AS full_name,
      u."phone" AS phone,
      COALESCE(sa."accountNumber", sha."accountNumber", fd."accountNumber", a."accountNumber") AS account_number,
      CASE
        WHEN sa."accountNumber" IS NOT NULL THEN 'savings'
        WHEN sha."accountNumber" IS NOT NULL THEN 'shares'
        WHEN fd."accountNumber" IS NOT NULL THEN 'fixed'
        WHEN a."accountNumber" IS NOT NULL THEN 'general'
        ELSE 'member'
      END AS account_kind
    FROM "Member" m
    LEFT JOIN "User" u ON u."id" = m."userId"
    LEFT JOIN "SavingsAccount" sa ON sa."memberId" = m."id" AND (sa."accountNumber" ILIKE ${like})
    LEFT JOIN "ShareAccount" sha ON sha."memberId" = m."id" AND (sha."accountNumber" ILIKE ${like})
    LEFT JOIN "FixedDeposit" fd ON fd."memberId" = m."id" AND (fd."accountNumber" ILIKE ${like})
    LEFT JOIN "Account" a ON a."memberId" = m."id" AND (a."accountNumber" ILIKE ${like})
    WHERE
      m."memberNumber" ILIKE ${like}
      OR u."name" ILIKE ${like}
      OR u."phone" ILIKE ${like}
      OR sa."accountNumber" IS NOT NULL
      OR sha."accountNumber" IS NOT NULL
      OR fd."accountNumber" IS NOT NULL
      OR a."accountNumber" IS NOT NULL
    ORDER BY m."id", u."name" ASC NULLS LAST
    LIMIT 20
  `;

  const institutions = await db.institution.findMany({
    where: {
      OR: [
        {
          institutionName: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          institutionNumber: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          institutionPhone: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          institutionEmail: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          primaryContactPerson: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionPhone: true,
      institutionEmail: true,
      primaryContactPhone: true,
      accounts: {
        select: {
          accountNumber: true,
          accountType: {
            select: {
              name: true,
            },
          },
        },
        take: 1,
      },
      fixedDeposits: {
        select: {
          accountNumber: true,
        },
        take: 1,
      },
    },
  });

  const institutionResults = institutions.map((institution) => {
    const accountNumber = institution.accounts[0]?.accountNumber || institution.fixedDeposits[0]?.accountNumber || "";
    return {
      kind: "institution" as const,
      member_id: institution.id,
      member_number: institution.institutionNumber,
      full_name: institution.institutionName,
      phone: institution.institutionPhone || institution.primaryContactPhone || "",
      account_number: accountNumber,
      account_kind: institution.accounts[0]?.accountType?.name?.toLowerCase() || (institution.fixedDeposits[0]?.accountNumber ? "fixed" : "institution"),
      label: accountNumber
        ? `${institution.institutionName} - ${accountNumber}`
        : `${institution.institutionName}`,
    };
  });

  return [...members.map((row) => ({
    kind: "member" as const,
    member_id: row.member_id,
    member_number: row.member_number,
    full_name: row.full_name || row.member_number,
    phone: row.phone || "",
    account_number: row.account_number || "",
    account_kind: row.account_kind || "member",
    label: row.account_number
      ? `${row.full_name || row.member_number} - ${row.account_number}`
      : `${row.full_name || row.member_number}`,
  })), ...institutionResults];
}

export async function buildPersonalLedgerWorkbook(report: PersonalLedgerReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = SACCO_NAME;
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Personal Ledger", {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.headerFooter.oddFooter = "Page No.: &P  |  Finance Solutions® 08.45.u";
  sheet.pageSetup.printTitlesRow = "1:12";
  sheet.columns = [
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 18 },
    { width: 32 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
  ];

  const titleRow = sheet.addRow([SACCO_NAME]);
  titleRow.getCell(1).font = { size: 14, bold: true };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(`A1:J1`);

  const dateRow = sheet.addRow(["", "", "", "", "", "", "", "", "Date:", formatDate(new Date())]);
  dateRow.getCell(9).alignment = { horizontal: "right" };
  dateRow.getCell(10).alignment = { horizontal: "right" };

  sheet.addRow([]);
  const branchRow = sheet.addRow(["Branch:", BRANCH_LABEL]);
  branchRow.getCell(1).font = { bold: true };
  branchRow.getCell(2).font = { bold: true };

  const timeRow = sheet.addRow(["", "", "", "", "", "", "", "", "Time:", formatDateTime(new Date()).split(" ").slice(1).join(" ")]);
  timeRow.getCell(9).alignment = { horizontal: "right" };
  timeRow.getCell(10).alignment = { horizontal: "right" };

  sheet.addRow([]);
  const reportTitleRow = sheet.addRow(["Personal Ledger"]);
  reportTitleRow.getCell(1).font = { size: 13, bold: true };
  sheet.mergeCells(`A7:J7`);

  sheet.addRow([]);
  if (report.subject_type === "institution" && report.institution) {
    sheet.addRow(["Institution Name:", report.institution.institution_name, "", "", "", "", "Institution No.:", report.institution.institution_number]);
    sheet.addRow(["Physical/Postal Address:", report.institution.physical_address || report.institution.postal_address, "", "", "", "", "Registration No.:", report.institution.registration_number || ""]);
    sheet.addRow(["Primary Contact:", report.institution.primary_contact_person, "", "", "", "", "Contact Phone:", report.institution.primary_contact_phone]);
    sheet.addRow(["Contact Email:", report.institution.primary_contact_email || "", "", "", "", "", "Institution Phone:", report.institution.institution_phone || ""]);
    sheet.addRow(["Institution Email:", report.institution.institution_email || "", "", "", "", "", "Registered Since:", report.institution.member_since]);
    sheet.addRow(["Legal Status:", report.institution.legal_status || "", "", "", "", "", "Status:", report.institution.approval_status]);
  } else if (report.member) {
    sheet.addRow(["Name:", report.member.full_name, "", "", "", "", "ID Card:", report.member.id_card || ""]);
    sheet.addRow(["Physical/Postal Address:", report.member.physical_address || report.member.postal_address, "", "", "", "", "Ref. No.:", report.member.ref_no ?? ""]);
    sheet.addRow(["Sex:", report.member.sex, "", "", "", "", "Phone:", report.member.phone || ""]);
    sheet.addRow(["Date of Birth:", report.member.date_of_birth || "", "", "", "", "", "Mobile:", report.member.mobile || ""]);
    sheet.addRow(["Email:", report.member.email || "", "", "", "", "", "Occupation:", report.member.occupation || ""]);
    sheet.addRow(["Employer:", report.member.employer || "", "", "", "", "", "Area Code:", report.member.area_code || ""]);
    sheet.addRow(["Next of Kin:", report.member.next_of_kin || "", "", "", "", "", "KYC Status:", report.member.kyc_status]);
    sheet.addRow(["Member Since:", report.member.member_since, "", "", "", "", "Member Type:", report.member.member_type]);
    sheet.addRow(["Batch No.:", report.member.batch_no ?? "", "", "", "", "", "Staff Status:", report.member.is_staff ? "Also a Teller" : "Member"]);
  }

  let rowIndex = sheet.rowCount + 2;
  for (const account of report.accounts) {
    const headerRow = sheet.addRow([
      `A/C No.: ${account.account_no}   Product: ${account.product_code} - ${account.product_name}   Opened: ${account.date_opened}   Status: ${account.status}`,
    ]);
    sheet.mergeCells(`A${headerRow.number}:J${headerRow.number}`);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    const openingRow = sheet.addRow([`Opening Balance: ${formatUGXPlain(account.opening_balance)}`]);
    sheet.mergeCells(`A${openingRow.number}:J${openingRow.number}`);
    openingRow.font = { bold: true };
    openingRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBFF" } };

    if (account.loan_details) {
      const loanRow = sheet.addRow([
        `Loan Amount: ${formatUGXPlain(account.loan_details.loan_amount)} | Outstanding Balance: ${formatUGXPlain(account.loan_details.outstanding_balance)} | Interest Rate: ${account.loan_details.interest_rate}% | Maturity Date: ${account.loan_details.maturity_date} | Loan Status: ${account.loan_details.loan_status}`,
      ]);
      sheet.mergeCells(`A${loanRow.number}:J${loanRow.number}`);
      loanRow.font = { italic: true };
    }

    const columns = ["Trx Date", "Session Date", "Trx No.", "Trx Code", "Voucher No.", "Description", "Debit", "Credit", "Balance", "User Name"];
    const columnRow = sheet.addRow(columns);
    columnRow.font = { bold: true };
    columnRow.alignment = { horizontal: "center" };
    columnRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
      };
    });

    for (const tx of account.transactions) {
      const txRow = sheet.addRow([
        tx.trx_date,
        tx.session_date,
        tx.trx_number,
        tx.trx_code,
        tx.voucher_no,
        tx.description,
        tx.debit ? formatUGXPlain(tx.debit) : "",
        tx.credit ? formatUGXPlain(tx.credit) : "",
        formatUGXPlain(tx.running_balance),
        tx.user_name,
      ]);
      if (tx.debit > 0) {
        txRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) return;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDEDEC" } };
        });
      } else if (tx.credit > 0) {
        txRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) return;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF7EE" } };
        });
      }
      txRow.getCell(3).font = { name: "Courier New" };
      txRow.getCell(7).alignment = { horizontal: "right" };
      txRow.getCell(8).alignment = { horizontal: "right" };
      txRow.getCell(9).alignment = { horizontal: "right" };
      txRow.getCell(9).font = { bold: true };
    }

    const totalRow = sheet.addRow([
      "Total Debit:",
      "",
      "",
      "",
      "",
      "",
      formatUGXPlain(account.summary.total_debit),
      formatUGXPlain(account.summary.total_credit),
      formatUGXPlain(account.summary.closing_balance),
      "",
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
      };
    });
    totalRow.getCell(7).alignment = { horizontal: "right" };
    totalRow.getCell(8).alignment = { horizontal: "right" };
    totalRow.getCell(9).alignment = { horizontal: "right" };

    sheet.addRow([]);
    rowIndex = sheet.rowCount + 1;
  }

  const summaryStart = sheet.rowCount + 2;
  const summaryTitle = sheet.addRow([`Summary as at ${report.report_meta.to_date}`]);
  sheet.mergeCells(`A${summaryTitle.number}:J${summaryTitle.number}`);
  summaryTitle.font = { bold: true, size: 12 };

  const summaryRows = [
    ["Savings Balance:", formatUGXPlain(report.grand_summary.total_savings_balance)],
    ["Shares Balance:", formatUGXPlain(report.grand_summary.total_shares_balance)],
    ["Fixed Deposits:", formatUGXPlain(report.grand_summary.total_fixed_deposit_balance)],
    ["Loan Balance:", formatUGXPlain(report.grand_summary.total_loan_balance)],
    ["Net Worth:", formatUGXPlain(report.grand_summary.net_worth)],
  ];

  for (const entry of summaryRows) {
    const row = sheet.addRow(entry);
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true };
  }

  sheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      if (colNumber === 3) {
        cell.font = { name: "Courier New" };
      }
      if (colNumber >= 7 && colNumber <= 9) {
        cell.alignment = { horizontal: "right" };
      }
      if (typeof cell.value === "string" && cell.value.startsWith("Opening Balance:")) {
        cell.font = { bold: true };
      }
      if (typeof cell.value === "string" && cell.value.startsWith("Total Debit:")) {
        cell.font = { bold: true };
      }
    });
  });

  return workbook.xlsx.writeBuffer();
}
