import { Prisma, SavingsTransactionType, TransactionStatus, TransactionType, UserRole } from "@prisma/client";
import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";

import { db } from "@/prisma/db";
import { getBranchFilterForService } from "@/lib/services/financial-reports";

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
  role?: UserRole | string | null;
};

export type SavingsTransactionReportFilters = {
  user: AuthUserLike;
  branchId?: string;
  productCode?: string;
  dateFrom?: string;
  dateTo?: string;
  accountNumber?: string;
  memberName?: string;
  teller?: string;
  type?: "all" | "deposit" | "withdrawal";
  minAmount?: number;
  maxAmount?: number;
  threshold?: number;
  includeReversed?: boolean;
};

export type SavingsTransactionRow = {
  id: string;
  accountId: string;
  accountNumber: string;
  memberId: string;
  memberName: string;
  passbookCount: number;
  trxNo: string;
  sessionDate: string;
  trxDate: string;
  debitAmount: number;
  creditAmount: number;
  netAmount: number;
  transactionType: SavingsTransactionType | "DEPOSIT" | "WITHDRAWAL";
  transactionTypeLabel: "Deposit" | "Withdrawal" | "Interest" | "Fee" | "Transfer In" | "Transfer Out" | "Reversal";
  processedBy: string;
  tellerId: string | null;
  accountType: string;
  productCode: string;
  productName: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
  openingDate: string | null;
  lastTransactionDate: string | null;
  runningBalance: number;
  largeTransactionFlag: boolean;
  groupAccountFlag: boolean;
  mixedFlowFlag: boolean;
  reversalFlag: boolean;
  description: string | null;
  valueDate: string | null;
  createdAt: string;
};

export type TellerSummaryRow = {
  tellerName: string;
  transactionCount: number;
  debits: number;
  credits: number;
  netMovement: number;
};

export type SavingsTransactionsSummary = {
  transactionCount: number;
  memberCount: number;
  totalDebits: number;
  totalCredits: number;
  netMovement: number;
  largestDeposit: SavingsTransactionRow | null;
  largestWithdrawal: SavingsTransactionRow | null;
};

export type SavingsTransactionsReport = {
  saccoName: string;
  location: string;
  reportTitle: string;
  generatedDate: string;
  generatedTime: string;
  generatedAt: Date;
  dateRange: {
    from: string;
    to: string;
  };
  product: {
    code: string;
    name: string;
  } | {
    code: "all";
    name: "All Savings Products";
  };
  branchScope: string;
  summary: SavingsTransactionsSummary;
  tellerSummary: TellerSummaryRow[];
  transactions: SavingsTransactionRow[];
  footer: {
    totalDebits: number;
    totalCredits: number;
    netMovement: number;
  };
};

type SavingsTransactionRecord = Prisma.SavingsTransactionGetPayload<{
  include: {
    account: {
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                firstName: true;
                lastName: true;
                nationalId: true;
                phone: true;
              };
            };
          };
        };
        accountType: {
          include: {
            ledgerAccount: {
              select: {
                accountCode: true;
                accountName: true;
              };
            };
          };
        };
        branch: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    teller: {
      select: {
        id: true;
        name: true;
        firstName: true;
        lastName: true;
        branchId: true;
      };
    };
  };
}>;

type GenericSavingsTransactionRecord = Prisma.TransactionGetPayload<{
  include: {
    account: {
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                firstName: true;
                lastName: true;
                nationalId: true;
                phone: true;
              };
            };
          };
        };
        accountType: {
          include: {
            ledgerAccount: {
              select: {
                accountCode: true;
                accountName: true;
              };
            };
          };
        };
        branch: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    processedByUser: {
      select: {
        id: true;
        name: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

const SACCO_NAME = "BUKONZO UNITED TEACHERS SACCO";
const LOCATION = "KISINGA, Kasese District, Uganda";
const DEFAULT_DATE = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "2026";
  const month = parts.find((part) => part.type === "month")?.value || "06";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
})();
const DEFAULT_THRESHOLD = 1_000_000;

const PRODUCT_NAMES: Record<string, string> = {
  "201001": "FIXED DEPOSIT SAVINGS",
  "201002": "JUNIOR SAVINGS A/C",
  "201003": "VOLUNTARY SAVINGS",
  "201004": "COMPULSORY SAVINGS",
  "200600": "LOAN INSURANCE",
};

const PRODUCT_NAME_KEYWORDS: Record<string, string> = {
  "201001": "fixed",
  "201002": "junior",
  "201003": "voluntary",
  "201004": "compulsory",
  "200600": "insurance",
};

const PASSBOOK_OVERRIDES: Record<string, number> = {};

const GROUP_KEYWORDS = [
  "church",
  "parish",
  "choir",
  "traders",
  "group",
  "association",
  "agency",
  "project",
  "cou",
  "school",
  "farmers",
  "committee",
  "development",
  "society",
];

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function parseInputDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
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

function resolveFullName(record: SavingsTransactionRecord) {
  const user = record.account.member.user;
  return (
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    record.account.member.memberNumber ||
    record.account.accountNumber
  );
}

function resolveProductCode(record: SavingsTransactionRecord) {
  return (
    record.account.accountType.ledgerAccount?.accountCode ||
    record.account.accountNumber.split(".")[0] ||
    "UNKNOWN"
  );
}

function resolveProductName(record: SavingsTransactionRecord) {
  return (
    record.account.accountType.ledgerAccount?.accountName ||
    PRODUCT_NAMES[resolveProductCode(record)] ||
    record.account.accountType.name ||
    "Savings"
  );
}

function resolvePassbookCount(accountNumber: string) {
  return PASSBOOK_OVERRIDES[accountNumber] ?? 1;
}

function resolveTransactionDirection(transaction: SavingsTransactionRecord) {
  if (transaction.transactionType === "DEPOSIT" || transaction.transactionType === "INTEREST" || transaction.transactionType === "TRANSFER_IN") {
    return "credit" as const;
  }
  if (transaction.transactionType === "WITHDRAWAL" || transaction.transactionType === "FEE" || transaction.transactionType === "TRANSFER_OUT") {
    return "debit" as const;
  }

  const delta = money(transaction.balanceAfter) - money(transaction.balanceBefore);
  return delta >= 0 ? "credit" : "debit";
}

function resolveTransactionTypeLabel(transaction: SavingsTransactionRecord): SavingsTransactionRow["transactionTypeLabel"] {
  switch (transaction.transactionType) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "INTEREST":
      return "Interest";
    case "FEE":
      return "Fee";
    case "TRANSFER_IN":
      return "Transfer In";
    case "TRANSFER_OUT":
      return "Transfer Out";
    case "REVERSAL":
      return "Reversal";
    default:
      return "Deposit";
  }
}

function isGroupAccount(name: string) {
  const value = normalize(name);
  return GROUP_KEYWORDS.some((keyword) => value.includes(keyword));
}

function resolveDisplayTeller(transaction: SavingsTransactionRecord) {
  const teller = transaction.teller;
  if (!teller) return "System";
  return (
    teller.name?.trim() ||
    [teller.firstName, teller.lastName].filter(Boolean).join(" ").trim() ||
    "System"
  );
}

function resolveGenericDisplayTeller(transaction: GenericSavingsTransactionRecord) {
  const teller = transaction.processedByUser;
  if (!teller) return "System";
  return (
    teller.name?.trim() ||
    [teller.firstName, teller.lastName].filter(Boolean).join(" ").trim() ||
    "System"
  );
}

function resolveGenericTransactionDirection(transactionType: TransactionType) {
  return transactionType === "WITHDRAWAL" || transactionType === "FEE"
    ? ("debit" as const)
    : ("credit" as const);
}

function resolveGenericTransactionTypeLabel(
  transactionType: TransactionType,
): SavingsTransactionRow["transactionTypeLabel"] {
  switch (transactionType) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "FEE":
      return "Fee";
    case "TRANSFER":
      return "Transfer In";
    default:
      return "Deposit";
  }
}

function resolveGenericFullName(transaction: GenericSavingsTransactionRecord) {
  const user = transaction.account.member?.user;
  const inst = (transaction.account as any).institution;
  return (
    user?.name?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    transaction.account.member?.memberNumber ||
    inst?.institutionName?.trim() ||
    inst?.user?.name?.trim() ||
    transaction.account.accountNumber
  );
}

function resolveDateRange(filters: SavingsTransactionReportFilters) {
  const from = parseInputDate(filters.dateFrom) || parseISO(DEFAULT_DATE);
  const to = parseInputDate(filters.dateTo) || parseISO(DEFAULT_DATE);
  to.setHours(23, 59, 59, 999);

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : parseISO(DEFAULT_DATE),
    to: to && !Number.isNaN(to.getTime()) ? to : parseISO(DEFAULT_DATE),
  };
}

function buildTransactionWhere(filters: SavingsTransactionReportFilters, branchId: string | null) {
  const dateRange = resolveDateRange(filters);
  const andConditions: Prisma.SavingsTransactionWhereInput[] = [
    {
      transactionDate: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
    },
  ];

  if (branchId) {
    andConditions.push({
      account: {
        is: {
          branchId,
        },
      },
    });
  }

  const productCode = normalize(filters.productCode);
  if (productCode && productCode !== "all") {
    const nameKeyword = PRODUCT_NAME_KEYWORDS[productCode];
    const productOrConditions: Prisma.SavingsTransactionWhereInput[] = [
      {
        account: {
          is: {
            accountNumber: {
              startsWith: `${productCode}.`,
            },
          },
        },
      },
      {
        account: {
          is: {
            accountType: {
              is: {
                ledgerAccount: {
                  is: {
                    accountCode: productCode,
                  },
                },
              },
            },
          },
        },
      },
    ];
    if (nameKeyword) {
      productOrConditions.push({
        account: {
          is: {
            accountType: {
              is: {
                name: {
                  contains: nameKeyword,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      });
    }
    andConditions.push({ OR: productOrConditions });
  }

  if (filters.accountNumber) {
    andConditions.push({
      account: {
        is: {
          accountNumber: {
            contains: filters.accountNumber.trim(),
            mode: "insensitive",
          },
        },
      },
    });
  }

  if (filters.memberName) {
    const search = filters.memberName.trim();
    andConditions.push({
      OR: [
        {
          account: {
            is: {
              member: {
                is: {
                  user: {
                    is: {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          account: {
            is: {
              member: {
                is: {
                  user: {
                    is: {
                      firstName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          account: {
            is: {
              member: {
                is: {
                  user: {
                    is: {
                      lastName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          account: {
            is: {
              accountNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (filters.teller && filters.teller !== "all") {
    andConditions.push({
      OR: [
        {
          teller: {
            is: {
              name: {
                contains: filters.teller.trim(),
                mode: "insensitive",
              },
            },
          },
        },
        {
          teller: {
            is: {
              firstName: {
                contains: filters.teller.trim(),
                mode: "insensitive",
              },
            },
          },
        },
        {
          teller: {
            is: {
              lastName: {
                contains: filters.teller.trim(),
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (filters.type && filters.type !== "all") {
    const direction = filters.type === "deposit" ? "credit" : "debit";
    andConditions.push(
      direction === "credit"
        ? {
            OR: [
              { transactionType: "DEPOSIT" },
              { transactionType: "INTEREST" },
              { transactionType: "TRANSFER_IN" },
            ],
          }
        : {
            OR: [
              { transactionType: "WITHDRAWAL" },
              { transactionType: "FEE" },
              { transactionType: "TRANSFER_OUT" },
            ],
          },
    );
  }

  if (typeof filters.minAmount === "number" && Number.isFinite(filters.minAmount)) {
    andConditions.push({
      amount: {
        gte: filters.minAmount,
      },
    });
  }

  if (typeof filters.maxAmount === "number" && Number.isFinite(filters.maxAmount)) {
    andConditions.push({
      amount: {
        lte: filters.maxAmount,
      },
    });
  }

  if (!filters.includeReversed) {
    andConditions.push({
      isReversed: false,
    });
  }

  return {
    AND: andConditions,
  } as Prisma.SavingsTransactionWhereInput;
}

function mapTransactionRow(transaction: SavingsTransactionRecord, threshold: number): SavingsTransactionRow {
  const direction = resolveTransactionDirection(transaction);
  const amount = money(transaction.amount);
  const debitAmount = direction === "debit" ? amount : 0;
  const creditAmount = direction === "credit" ? amount : 0;
  const netAmount = creditAmount - debitAmount;
  const accountNumber = transaction.account.accountNumber;
  const memberName = resolveFullName(transaction);
  const productCode = resolveProductCode(transaction);
  const productName = resolveProductName(transaction);
  const branchName = transaction.account.branch?.name || null;
  const tellerName = resolveDisplayTeller(transaction);
  const largeTransactionFlag = amount >= threshold;
  const groupAccountFlag = isGroupAccount(memberName);

  return {
    id: transaction.id,
    accountId: transaction.accountId,
    accountNumber,
    memberId: transaction.account.memberId,
    memberName,
    passbookCount: resolvePassbookCount(accountNumber),
    trxNo: transaction.reference || transaction.id,
    sessionDate: formatIsoDate(transaction.transactionDate),
    trxDate: formatIsoDate(transaction.valueDate || transaction.transactionDate),
    debitAmount,
    creditAmount,
    netAmount,
    transactionType: transaction.transactionType,
    transactionTypeLabel: resolveTransactionTypeLabel(transaction),
    processedBy: tellerName,
    tellerId: transaction.tellerId || null,
    accountType: transaction.account.accountType.name,
    productCode,
    productName,
    branchId: transaction.account.branchId || null,
    branchName,
    status: transaction.account.status,
    openingDate: transaction.account.openedDate ? formatIsoDate(transaction.account.openedDate) : null,
    lastTransactionDate: transaction.account.lastTransactionDate ? formatIsoDate(transaction.account.lastTransactionDate) : null,
    runningBalance: money(transaction.balanceAfter),
    largeTransactionFlag,
    groupAccountFlag,
    mixedFlowFlag: false,
    reversalFlag: transaction.transactionType === "REVERSAL" || transaction.isReversed,
    description: transaction.description || null,
    valueDate: transaction.valueDate ? formatIsoDate(transaction.valueDate) : null,
    createdAt: formatIsoDate(transaction.createdAt),
  };
}

function summarizeTransactions(transactions: SavingsTransactionRow[]): SavingsTransactionsSummary {
  const uniqueAccounts = new Set(transactions.map((row) => row.accountNumber));
  const totalDebits = transactions.reduce((sum, row) => sum + row.debitAmount, 0);
  const totalCredits = transactions.reduce((sum, row) => sum + row.creditAmount, 0);

  let largestDeposit: SavingsTransactionRow | null = null;
  let largestWithdrawal: SavingsTransactionRow | null = null;

  for (const row of transactions) {
    if (row.creditAmount > 0 && (!largestDeposit || row.creditAmount > largestDeposit.creditAmount)) {
      largestDeposit = row;
    }
    if (row.debitAmount > 0 && (!largestWithdrawal || row.debitAmount > largestWithdrawal.debitAmount)) {
      largestWithdrawal = row;
    }
  }

  return {
    transactionCount: transactions.length,
    memberCount: uniqueAccounts.size,
    totalDebits,
    totalCredits,
    netMovement: totalCredits - totalDebits,
    largestDeposit,
    largestWithdrawal,
  };
}

function buildTellerSummary(transactions: SavingsTransactionRow[]): TellerSummaryRow[] {
  const grouped = new Map<string, TellerSummaryRow>();

  for (const row of transactions) {
    const key = row.processedBy || "System";
    const current = grouped.get(key) || {
      tellerName: key,
      transactionCount: 0,
      debits: 0,
      credits: 0,
      netMovement: 0,
    };

    current.transactionCount += 1;
    current.debits += row.debitAmount;
    current.credits += row.creditAmount;
    current.netMovement = current.credits - current.debits;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.tellerName.localeCompare(b.tellerName));
}

function applyMixedFlowFlags(transactions: SavingsTransactionRow[]) {
  const flowMap = new Map<string, { debit: boolean; credit: boolean }>();

  for (const row of transactions) {
    const current = flowMap.get(row.accountNumber) || { debit: false, credit: false };
    current.debit = current.debit || row.debitAmount > 0;
    current.credit = current.credit || row.creditAmount > 0;
    flowMap.set(row.accountNumber, current);
  }

  return transactions.map((row) => ({
    ...row,
    mixedFlowFlag: (flowMap.get(row.accountNumber)?.debit ?? false) && (flowMap.get(row.accountNumber)?.credit ?? false),
  }));
}

function mapGenericTransactions(
  records: GenericSavingsTransactionRecord[],
  threshold: number,
) {
  const grouped = new Map<string, GenericSavingsTransactionRecord[]>();

  for (const record of records) {
    const group = grouped.get(record.accountId) || [];
    group.push(record);
    grouped.set(record.accountId, group);
  }

  const rows: SavingsTransactionRow[] = [];

  for (const group of grouped.values()) {
    const ordered = [...group].sort((a, b) => {
      const dateDiff = a.transactionDate.getTime() - b.transactionDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    });

    let runningBalance = money(ordered[ordered.length - 1]?.account.balance ?? 0);
    const latestTransactionDate = ordered[ordered.length - 1]?.transactionDate || null;
    const tempRows: SavingsTransactionRow[] = [];

    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      const transaction = ordered[index];
      const direction = resolveGenericTransactionDirection(transaction.type);
      const amount = money(transaction.amount);
      const balanceAfter = runningBalance;
      const balanceBefore = direction === "credit" ? balanceAfter - amount : balanceAfter + amount;
      runningBalance = balanceBefore;

      const debitAmount = direction === "debit" ? amount : 0;
      const creditAmount = direction === "credit" ? amount : 0;
      const productCode =
        transaction.account.accountType.ledgerAccount?.accountCode ||
        transaction.account.accountNumber.split(".")[0] ||
        "UNKNOWN";
      const productName =
        transaction.account.accountType.ledgerAccount?.accountName ||
        transaction.account.accountType.name ||
        "Savings";
      const memberName = resolveGenericFullName(transaction);

      tempRows.unshift({
        id: transaction.id,
        accountId: transaction.accountId,
        accountNumber: transaction.account.accountNumber,
        memberId: transaction.account.memberId || transaction.accountId,
        memberName,
        passbookCount: resolvePassbookCount(transaction.account.accountNumber),
        trxNo: transaction.transactionRef,
        sessionDate: formatIsoDate(transaction.transactionDate),
        trxDate: formatIsoDate(transaction.valueDate || transaction.transactionDate),
        debitAmount,
        creditAmount,
        netAmount: creditAmount - debitAmount,
        transactionType: transaction.type as SavingsTransactionRow["transactionType"],
        transactionTypeLabel: resolveGenericTransactionTypeLabel(transaction.type),
        processedBy: resolveGenericDisplayTeller(transaction),
        tellerId: transaction.processedByUserId || null,
        accountType: transaction.account.accountType.name,
        productCode,
        productName,
        branchId: transaction.account.branchId || null,
        branchName: transaction.account.branch?.name || null,
        status: transaction.status,
        openingDate: transaction.account.openedAt ? formatIsoDate(transaction.account.openedAt) : null,
        lastTransactionDate: latestTransactionDate ? formatIsoDate(latestTransactionDate) : null,
        runningBalance: balanceAfter,
        largeTransactionFlag: amount >= threshold,
        groupAccountFlag: isGroupAccount(memberName),
        mixedFlowFlag: false,
        reversalFlag: transaction.status === "REVERSED",
        description: transaction.description || null,
        valueDate: transaction.valueDate ? formatIsoDate(transaction.valueDate) : null,
        createdAt: formatIsoDate(transaction.transactionDate),
      });
    }

    rows.push(...tempRows);
  }

  return applyMixedFlowFlags(rows);
}

async function fetchTransactions(filters: SavingsTransactionReportFilters, user: AuthUserLike) {
  const branchFilter = await getBranchFilterForService(user as any, filters.branchId || undefined);
  const branchId = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : null;
  const where = buildTransactionWhere(filters, branchId);
  const threshold = typeof filters.threshold === "number" && Number.isFinite(filters.threshold)
    ? filters.threshold
    : DEFAULT_THRESHOLD;

  const savingsRecords = await db.savingsTransaction.findMany({
    where,
    include: {
      account: {
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  nationalId: true,
                  phone: true,
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
        },
      },
      teller: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          branchId: true,
        },
      },
    },
    orderBy: [
      { transactionDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  const savingsRows = savingsRecords.map((transaction) => mapTransactionRow(transaction as SavingsTransactionRecord, threshold));

  const genericWhere: Prisma.TransactionWhereInput = {
    transactionDate: {
      gte: resolveDateRange(filters).from,
      lte: resolveDateRange(filters).to,
    },
    type: { in: [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL, TransactionType.FEE, TransactionType.TRANSFER] },
    ...(branchId
      ? {
          account: {
            is: {
              branchId,
            },
          },
        }
      : {}),
  };

  if (filters.accountNumber) {
    genericWhere.account = {
      is: {
        ...(genericWhere.account && "is" in genericWhere.account ? (genericWhere.account as any).is : {}),
        accountNumber: {
          contains: filters.accountNumber.trim(),
          mode: "insensitive",
        },
      },
    };
  }

  if (filters.memberName) {
    const search = filters.memberName.trim();
    genericWhere.account = {
      is: {
        ...(genericWhere.account && "is" in genericWhere.account ? (genericWhere.account as any).is : {}),
        OR: [
          {
            member: {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            member: {
              user: {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            member: {
              user: {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            institution: {
              institutionName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            institution: {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
    };
  }

  const productCode = normalize(filters.productCode);
  if (productCode && productCode !== "all") {
    const nameKeyword = PRODUCT_NAME_KEYWORDS[productCode];
    const genericProductOrConditions: any[] = [
      { accountNumber: { startsWith: `${productCode}.` } },
      { accountType: { ledgerAccount: { accountCode: productCode } } },
    ];
    if (nameKeyword) {
      genericProductOrConditions.push({
        accountType: { name: { contains: nameKeyword, mode: "insensitive" } },
      });
    }
    genericWhere.account = {
      is: {
        ...(genericWhere.account && "is" in genericWhere.account ? (genericWhere.account as any).is : {}),
        OR: genericProductOrConditions,
      },
    };
  }

  if (filters.teller && filters.teller !== "all") {
    genericWhere.processedByUser = {
      OR: [
        {
          name: {
            contains: filters.teller.trim(),
            mode: "insensitive",
          },
        },
        {
          firstName: {
            contains: filters.teller.trim(),
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: filters.teller.trim(),
            mode: "insensitive",
          },
        },
      ],
    };
  }

  if (filters.type && filters.type !== "all") {
    genericWhere.type = filters.type === "deposit"
      ? TransactionType.DEPOSIT
      : TransactionType.WITHDRAWAL;
  }

  if (typeof filters.minAmount === "number" && Number.isFinite(filters.minAmount)) {
    genericWhere.amount = { ...(genericWhere.amount as any), gte: filters.minAmount };
  }

  if (typeof filters.maxAmount === "number" && Number.isFinite(filters.maxAmount)) {
    genericWhere.amount = { ...(genericWhere.amount as any), lte: filters.maxAmount };
  }

  if (!filters.includeReversed) {
    genericWhere.status = { not: TransactionStatus.REVERSED };
  }

  const genericRecords = await db.transaction.findMany({
    where: genericWhere,
    include: {
      account: {
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  nationalId: true,
                  phone: true,
                },
              },
            },
          },
          institution: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
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
        },
      },
      processedByUser: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      { transactionDate: "asc" },
      { id: "asc" },
    ],
  });

  const genericRows = mapGenericTransactions(genericRecords as GenericSavingsTransactionRecord[], threshold);

  const savingsRefSet = new Set(savingsRows.map((r) => r.trxNo).filter(Boolean));
  const dedupedGenericRows = genericRows.filter((r) => !r.trxNo || !savingsRefSet.has(r.trxNo));

  const merged = [...savingsRows, ...dedupedGenericRows].sort((a, b) => {
    const dateDiff = new Date(a.trxDate).getTime() - new Date(b.trxDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return (a.id || "").localeCompare(b.id || "");
  });

  const transactions = applyMixedFlowFlags(merged);
  const summary = summarizeTransactions(transactions);
  const tellerSummary = buildTellerSummary(transactions);

  return {
    branchScope: branchId || "all",
    transactions,
    summary,
    tellerSummary,
  };
}

export async function buildSavingsTransactionsReport(filters: SavingsTransactionReportFilters) {
  const generatedAt = new Date();
  const effectiveRange = resolveDateRange(filters);
  const branchFilter = await getBranchFilterForService(filters.user as any, filters.branchId || undefined);
  const branchScope = branchFilter.branchId && branchFilter.branchId !== "all" ? branchFilter.branchId : "all";
  const productCode = normalize(filters.productCode);
  const product = !productCode || productCode === "all"
    ? { code: "all" as const, name: "All Savings Products" as const }
    : {
        code: productCode,
        name: PRODUCT_NAMES[productCode] || "Savings Product",
      };

  const { transactions, summary, tellerSummary } = await fetchTransactions(filters, filters.user);

  return {
    saccoName: SACCO_NAME,
    location: LOCATION,
    reportTitle: "Savings Transactions Report",
    generatedDate: formatDate(generatedAt),
    generatedTime: formatTime(generatedAt),
    generatedAt,
    dateRange: {
      from: formatDate(effectiveRange.from),
      to: formatDate(effectiveRange.to),
    },
    product,
    branchScope,
    summary,
    tellerSummary,
    transactions,
    footer: {
      totalDebits: summary.totalDebits,
      totalCredits: summary.totalCredits,
      netMovement: summary.netMovement,
    },
  } satisfies SavingsTransactionsReport;
}

export async function buildSavingsTransactionsMemberReport(
  accountNumber: string,
  filters: Omit<SavingsTransactionReportFilters, "accountNumber">,
) {
  const report = await buildSavingsTransactionsReport({
    ...filters,
    accountNumber,
  });

  const first = report.transactions[0] || null;
  // Account is the master balance source (TXN-001) — look up from Account not SavingsAccount.
  const fallbackAccount =
    first || !accountNumber
      ? null
      : await db.account.findFirst({
          where: {
            accountNumber: {
              equals: accountNumber.trim(),
              mode: "insensitive",
            },
            ...(report.branchScope !== "all"
              ? {
                  branchId: report.branchScope,
                }
              : {}),
          },
          include: {
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    nationalId: true,
                    phone: true,
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
          },
        });

  const accountMember = first
    ? null
    : fallbackAccount
      ? {
          accountNumber: fallbackAccount.accountNumber,
          memberName:
            fallbackAccount.member?.user?.name?.trim() ||
            [fallbackAccount.member?.user?.firstName, fallbackAccount.member?.user?.lastName].filter(Boolean).join(" ").trim() ||
            fallbackAccount.member?.memberNumber ||
            fallbackAccount.accountNumber,
          passbookCount: PASSBOOK_OVERRIDES[fallbackAccount.accountNumber] ?? 1,
          openingDate: formatIsoDate(fallbackAccount.openedAt),
          lastTransactionDate: null,
          accountType: fallbackAccount.accountType.name,
          productCode: fallbackAccount.accountType.ledgerAccount?.accountCode || fallbackAccount.accountNumber.split(".")[0] || fallbackAccount.accountNumber,
          productName: fallbackAccount.accountType.ledgerAccount?.accountName || fallbackAccount.accountType.name || "Savings",
          branchName: fallbackAccount.branch?.name || null,
          branchId: fallbackAccount.branchId || null,
          status: fallbackAccount.status,
          runningBalance: money(fallbackAccount.balance),
          tellerNames: [],
        }
      : null;

  return {
    ...report,
    member: first
      ? {
          accountNumber: first.accountNumber,
          memberName: first.memberName,
          passbookCount: first.passbookCount,
          openingDate: first.openingDate,
          lastTransactionDate: first.lastTransactionDate,
          accountType: first.accountType,
          productCode: first.productCode,
          productName: first.productName,
          branchName: first.branchName,
          branchId: first.branchId,
          status: first.status,
          runningBalance: first.runningBalance,
          tellerNames: Array.from(new Set(report.transactions.map((row) => row.processedBy))),
        }
      : accountMember,
  };
}

export async function buildSavingsTransactionsWorkbook(report: SavingsTransactionsReport) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Savings Transactions");

  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { key: "accountNumber", width: 16 },
    { key: "memberName", width: 28 },
    { key: "passbookCount", width: 10 },
    { key: "trxNo", width: 24 },
    { key: "sessionDate", width: 14 },
    { key: "trxDate", width: 14 },
    { key: "debitAmount", width: 16 },
    { key: "creditAmount", width: 16 },
    { key: "processedBy", width: 16 },
  ];

  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = report.saccoName;
  sheet.getCell("A2").alignment = { horizontal: "center" };
  sheet.getCell("A2").font = { bold: true, size: 16 };

  sheet.mergeCells("A3:I3");
  sheet.getCell("A3").value = report.location;
  sheet.getCell("A3").alignment = { horizontal: "center" };
  sheet.getCell("A3").font = { italic: true, size: 11 };

  sheet.getCell("H4").value = `Report Date: ${report.generatedDate}`;
  sheet.getCell("H4").alignment = { horizontal: "right" };

  sheet.getCell("H5").value = `Generated Time: ${report.generatedTime}`;
  sheet.getCell("H5").alignment = { horizontal: "right" };

  sheet.mergeCells("A6:I6");
  sheet.getCell("A6").value = report.reportTitle;
  sheet.getCell("A6").alignment = { horizontal: "center" };
  sheet.getCell("A6").font = { bold: true, size: 14 };

  sheet.mergeCells("A7:I7");
  sheet.getCell("A7").value = `Reporting Date From: ${report.dateRange.from} To: ${report.dateRange.to}`;
  sheet.getCell("A7").alignment = { horizontal: "center" };

  const headerRow = sheet.getRow(9);
  headerRow.values = ["A/C No.", "Name", "Ref. No.", "Trx No.", "Session Date", "Trx Date", "Debit (UGX)", "Credit (UGX)", "User Name"];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF166534" },
  };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF14532D" } },
      bottom: { style: "thin", color: { argb: "FF14532D" } },
    };
  });

  let rowIndex = 10;
  for (const row of report.transactions) {
    const dataRow = sheet.getRow(rowIndex);
    dataRow.values = [
      row.accountNumber,
      row.memberName,
      row.passbookCount,
      row.trxNo,
      row.sessionDate,
      row.trxDate,
      row.debitAmount || null,
      row.creditAmount || null,
      row.processedBy,
    ];
    dataRow.height = 18;
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
      if (colNumber === 7) {
        cell.numFmt = '#,##0;(#,##0)';
        cell.font = { color: { argb: "FFB91C1C" } };
      }
      if (colNumber === 8) {
        cell.numFmt = '#,##0;(#,##0)';
        cell.font = { color: { argb: "FF047857" } };
      }
      if (row.largeTransactionFlag) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF3CD" },
        };
      }
    });

    if (row.groupAccountFlag) {
      dataRow.getCell(2).value = `🏢 ${row.memberName}`;
    }

    if (row.mixedFlowFlag) {
      dataRow.getCell(2).font = {
        ...(dataRow.getCell(2).font || {}),
        color: { argb: "FF1D4ED8" },
        bold: true,
      };
    }

    rowIndex += 1;
    const spacerRow = sheet.getRow(rowIndex);
    spacerRow.height = 6;
    rowIndex += 1;
  }

  const totalRow = sheet.getRow(rowIndex + 1);
  totalRow.values = [
    "Totals",
    null,
    report.summary.memberCount,
    report.summary.transactionCount,
    null,
    null,
    report.summary.totalDebits,
    report.summary.totalCredits,
    `Net: ${report.summary.netMovement}`,
  ];
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalRow.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF111827" } },
      bottom: { style: "thin", color: { argb: "FF111827" } },
    };
    if (colNumber === 7) {
      cell.numFmt = '#,##0;(#,##0)';
    }
    if (colNumber === 8) {
      cell.numFmt = '#,##0;(#,##0)';
    }
  });

  sheet.getCell(`G${totalRow.number}`).font = { bold: true, color: { argb: "FFFFD54F" } };
  sheet.getCell(`H${totalRow.number}`).font = { bold: true, color: { argb: "FFA7F3D0" } };

  sheet.getCell("A1").value = "";
  sheet.views = [{ state: "frozen", ySplit: 9 }];
  sheet.headerFooter.oddFooter = `Page &P | Finance Solutions® 08.45.u`;
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  return workbook.xlsx.writeBuffer();
}
