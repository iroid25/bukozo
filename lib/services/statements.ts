import { AccountStatus, UserRole } from "@prisma/client";
import { format } from "date-fns";
import { db } from "@/prisma/db";
import { generateMemberStatementPDF } from "@/lib/reports/generators/member-statement-pdf";
import { uploadPDFToCloudinaryEnhanced } from "@/lib/cloudinary";

export type StatementUser = {
  id: string;
  role: UserRole | string;
  branchId?: string | null;
};

export type StatementSubjectType = "MEMBER" | "INSTITUTION";
export type StatementScope = "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";

export type StatementCreateInput = {
  memberId?: string;
  institutionId?: string;
  accountId?: string;
  subjectType?: StatementSubjectType;
  scope?: StatementScope;
  startDate: Date;
  endDate?: Date;
};

export type StatementMetadata = {
  subjectType: StatementSubjectType;
  scope: StatementScope;
  accountId?: string | null;
  memberId?: string | null;
  institutionId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  pdfPath?: string | null;
};

function createInstitutionStatementId() {
  return `institution-statement-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isInstitutionStatementId(id: string) {
  return id.startsWith("institution-statement-");
}

function buildMemberAccessWhere(user: StatementUser) {
  if (user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT) {
    return { isApproved: true };
  }

  if (user.role === UserRole.MEMBER) {
    return {
      isApproved: true,
      userId: user.id,
    };
  }

  if (!user.branchId) {
    return {
      id: "__no_branch_member_access__",
      isApproved: true,
    };
  }

  return {
    isApproved: true,
    OR: [{ branchId: user.branchId }, { user: { branchId: user.branchId } }],
  };
}

function buildInstitutionAccessWhere(user: StatementUser) {
  if (user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT) {
    return { isApproved: true };
  }

  if (user.role === UserRole.INSTITUTION) {
    return {
      isApproved: true,
      userId: user.id,
    };
  }

  if (!user.branchId) {
    return {
      id: "__no_branch_institution_access__",
      isApproved: true,
    };
  }

  return {
    isApproved: true,
    accounts: {
      some: {
        branchId: user.branchId,
      },
    },
  };
}

function getActorNameFromDeposit(deposit: {
  depositorName?: string | null;
  member?: { user?: { name?: string | null } | null } | null;
  institution?: { institutionName?: string | null } | null;
}) {
  return (
    deposit.depositorName ||
    deposit.member?.user?.name ||
    deposit.institution?.institutionName ||
    "Unknown"
  );
}

function getActorNameFromWithdrawal(withdrawal: {
  member?: { user?: { name?: string | null } | null } | null;
  institution?: { institutionName?: string | null } | null;
}) {
  return (
    withdrawal.member?.user?.name ||
    withdrawal.institution?.institutionName ||
    "Unknown"
  );
}

function toStatementMetadata(input: StatementCreateInput): StatementMetadata {
  return {
    subjectType: input.subjectType || "MEMBER",
    scope: input.scope || (input.accountId ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS"),
    accountId: input.accountId || null,
    memberId: input.memberId || null,
    institutionId: input.institutionId || null,
  };
}

export async function getStatementMetadata(statementId: string) {
  const auditEntry = await db.auditLog.findFirst({
    where: {
      entityType: "Statement",
      entityId: statementId,
      action: "STATEMENT_CREATED",
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  const details = (auditEntry?.details || {}) as Record<string, any>;

  return {
    subjectType: details.subjectType === "INSTITUTION" ? "INSTITUTION" : "MEMBER",
    scope: details.scope === "SINGLE_ACCOUNT" ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS",
    accountId: typeof details.accountId === "string" ? details.accountId : null,
    memberId: typeof details.memberId === "string" ? details.memberId : null,
    institutionId:
      typeof details.institutionId === "string" ? details.institutionId : null,
  } satisfies StatementMetadata;
}

export async function getInstitutionStatementAuditById(
  user: StatementUser,
  statementId: string,
) {
  if (!isInstitutionStatementId(statementId)) {
    return null;
  }

  const auditEntry = await db.auditLog.findFirst({
    where: {
      entityType: "Statement",
      entityId: statementId,
      action: "STATEMENT_CREATED",
    },
    orderBy: {
      timestamp: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!auditEntry) {
    return null;
  }

  const details = (auditEntry.details || {}) as Record<string, any>;
  if (details.subjectType !== "INSTITUTION" || typeof details.institutionId !== "string") {
    return null;
  }

  const institution = await db.institution.findFirst({
    where: {
      id: details.institutionId,
      ...buildInstitutionAccessWhere(user),
    },
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      institutionEmail: true,
      institutionPhone: true,
      postalAddress: true,
      primaryContactPerson: true,
      primaryContactPhone: true,
      accounts: {
        where: {
          status: {
            not: AccountStatus.CLOSED,
          },
        },
        include: {
          accountType: true,
          branch: true,
          accountHolds: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!institution) {
    return null;
  }

  const startDate = details.startDate ? new Date(details.startDate) : auditEntry.timestamp;
  const endDate = details.endDate ? new Date(details.endDate) : auditEntry.timestamp;

  return {
    id: statementId,
    memberId: null,
    institutionId: institution.id,
    accountId: typeof details.accountId === "string" ? details.accountId : null,
    subjectType: "INSTITUTION" as const,
    accountScope: details.scope === "SINGLE_ACCOUNT" ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS",
    userId: auditEntry.userId,
    startDate,
    endDate,
    generatedAt: auditEntry.timestamp,
    pdfPath: typeof details.pdfPath === "string" ? details.pdfPath : null,
    member: null,
    institution: {
      ...institution,
      accounts: institution.accounts.map((account) => ({
        id: account.id,
        accountNumber: account.accountNumber,
        balance: account.balance,
        status: account.status,
        accountType: {
          id: account.accountType.id,
          name: account.accountType.name,
        },
        branch: {
          id: account.branch.id,
          name: account.branch.name,
        },
        activeHoldCount: account.accountHolds.length,
      })),
    },
    user: auditEntry.user,
    statementDate: auditEntry.timestamp,
    periodStart: startDate,
    periodEnd: endDate,
    fileUrl: typeof details.pdfPath === "string" ? details.pdfPath : null,
    generatedByUserId: auditEntry.userId,
    generatedByUser: auditEntry.user,
  };
}

export async function getInstitutionStatementSummaries(user: StatementUser) {
  const auditEntries = await db.auditLog.findMany({
    where: {
      entityType: "Statement",
      action: "STATEMENT_CREATED",
    },
    orderBy: {
      timestamp: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  const institutionStatementEntries = auditEntries.filter((entry) => {
    const details = (entry.details || {}) as Record<string, any>;
    return details.subjectType === "INSTITUTION" && typeof details.institutionId === "string";
  });

  const institutionIds = [
    ...new Set(
      institutionStatementEntries
        .map((entry) => ((entry.details || {}) as Record<string, any>).institutionId as string)
        .filter(Boolean),
    ),
  ];

  if (!institutionIds.length) {
    return [];
  }

  const accessibleInstitutions = await db.institution.findMany({
    where: {
      id: { in: institutionIds },
      ...buildInstitutionAccessWhere(user),
    },
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      institutionEmail: true,
      institutionPhone: true,
      postalAddress: true,
      primaryContactPerson: true,
      primaryContactPhone: true,
      accounts: {
        where: {
          status: {
            not: AccountStatus.CLOSED,
          },
        },
        include: {
          accountType: true,
          branch: true,
          accountHolds: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  const institutionMap = new Map(accessibleInstitutions.map((institution) => [institution.id, institution]));

  return institutionStatementEntries
    .map((entry) => {
      const details = (entry.details || {}) as Record<string, any>;
      const institution = institutionMap.get(details.institutionId as string);
      if (!institution) return null;

      const startDate = details.startDate ? new Date(details.startDate) : entry.timestamp;
      const endDate = details.endDate ? new Date(details.endDate) : entry.timestamp;

      return {
        id: entry.entityId || entry.id,
        memberId: null,
        institutionId: institution.id,
        accountId: typeof details.accountId === "string" ? details.accountId : null,
        subjectType: "INSTITUTION" as const,
        accountScope:
          details.scope === "SINGLE_ACCOUNT" ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS",
        userId: entry.userId,
        startDate,
        endDate,
        generatedAt: entry.timestamp,
        pdfPath: typeof details.pdfPath === "string" ? details.pdfPath : null,
        member: null,
        institution: {
          ...institution,
          accounts: institution.accounts.map((account) => ({
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.status,
            accountType: {
              id: account.accountType.id,
              name: account.accountType.name,
            },
            branch: {
              id: account.branch.id,
              name: account.branch.name,
            },
            activeHoldCount: account.accountHolds.length,
          })),
        },
        user: entry.user,
        statementDate: entry.timestamp,
        periodStart: startDate,
        periodEnd: endDate,
        fileUrl: typeof details.pdfPath === "string" ? details.pdfPath : null,
        generatedByUserId: entry.userId,
        generatedByUser: entry.user,
      };
    })
    .filter((statement): statement is NonNullable<typeof statement> => Boolean(statement));
}

export async function getMembersForStatementGeneration(user: StatementUser) {
  return db.member.findMany({
    where: buildMemberAccessWhere(user),
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
      accounts: {
        where: {
          status: {
            not: AccountStatus.CLOSED,
          },
        },
        include: {
          accountType: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      memberNumber: "asc",
    },
  });
}

export async function getInstitutionsForStatementGeneration(user: StatementUser) {
  return db.institution.findMany({
    where: buildInstitutionAccessWhere(user),
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      institutionEmail: true,
      institutionPhone: true,
      accounts: {
        where: {
          status: {
            not: AccountStatus.CLOSED,
          },
        },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          status: true,
          accountType: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      institutionName: "asc",
    },
  });
}

export async function getAccountsForStatementSubject(
  user: StatementUser,
  subjectType: StatementSubjectType,
  subjectId: string,
) {
  const where =
    subjectType === "MEMBER"
      ? {
          memberId: subjectId,
          status: { not: AccountStatus.CLOSED },
        }
      : {
          institutionId: subjectId,
          status: { not: AccountStatus.CLOSED },
        };

  if (subjectType === "MEMBER") {
    const allowed = await db.member.findFirst({
      where: {
        id: subjectId,
        ...buildMemberAccessWhere(user),
      },
      select: { id: true },
    });

    if (!allowed) return [];
  } else {
    const allowed = await db.institution.findFirst({
      where: {
        id: subjectId,
        ...buildInstitutionAccessWhere(user),
      },
      select: { id: true },
    });

    if (!allowed) return [];
  }

  return db.account.findMany({
    where,
    select: {
      id: true,
      accountNumber: true,
      balance: true,
      status: true,
      accountType: {
        select: {
          id: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
      _count: {
        select: {
          accountHolds: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });
}

export async function buildStatementDataForSubject(
  user: StatementUser,
  input: {
    subjectType: StatementSubjectType;
    memberId?: string;
    institutionId?: string;
    accountId?: string;
    scope?: StatementScope;
    startDate: Date;
    endDate: Date;
  },
) {
  const subjectType = input.subjectType;
  const scope = input.scope || (input.accountId ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS");
  const subjectId =
    subjectType === "MEMBER" ? input.memberId : input.institutionId;

  if (!subjectId) {
    throw new Error("Subject identifier is required");
  }

  const accounts = await getAccountsForStatementSubject(user, subjectType, subjectId);

  if (!accounts.length) {
    throw new Error("No accessible accounts found for this subject");
  }

  const scopedAccounts =
    scope === "SINGLE_ACCOUNT"
      ? accounts.filter((account) => account.id === input.accountId)
      : accounts;

  if (!scopedAccounts.length) {
    throw new Error("Selected account was not found for this subject");
  }

  const scopedAccountIds = scopedAccounts.map((account) => account.id);

  const [member, institution, transactions, deposits, withdrawals, loanRepayments] =
    await Promise.all([
      subjectType === "MEMBER"
        ? db.member.findUnique({
            where: { id: subjectId },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  address: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      subjectType === "INSTITUTION"
        ? db.institution.findUnique({
            where: { id: subjectId },
            select: {
              id: true,
              institutionNumber: true,
              institutionName: true,
              institutionType: true,
              institutionEmail: true,
              institutionPhone: true,
              postalAddress: true,
              primaryContactPerson: true,
              primaryContactPhone: true,
            },
          })
        : Promise.resolve(null),
      db.transaction.findMany({
        where: {
          accountId: { in: scopedAccountIds },
          transactionDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        include: {
          account: {
            include: {
              accountType: true,
            },
          },
          processedByUser: {
            select: {
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          transactionDate: "desc",
        },
      }),
      db.deposit.findMany({
        where: {
          accountId: { in: scopedAccountIds },
          depositDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        include: {
          account: {
            include: {
              accountType: true,
            },
          },
          handler: {
            select: {
              name: true,
              role: true,
            },
          },
          member: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          institution: {
            select: {
              institutionName: true,
            },
          },
        },
        orderBy: {
          depositDate: "desc",
        },
      }),
      db.withdrawal.findMany({
        where: {
          accountId: { in: scopedAccountIds },
          withdrawalDate: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        include: {
          account: {
            include: {
              accountType: true,
            },
          },
          handler: {
            select: {
              name: true,
              role: true,
            },
          },
          member: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          institution: {
            select: {
              institutionName: true,
            },
          },
        },
        orderBy: {
          withdrawalDate: "desc",
        },
      }),
      subjectType === "MEMBER"
        ? db.loanRepayment.findMany({
            where: {
              memberId: subjectId,
              repaymentDate: {
                gte: input.startDate,
                lte: input.endDate,
              },
            },
            include: {
              loan: {
                include: {
                  loanApplication: {
                    include: {
                      loanProduct: true,
                    },
                  },
                },
              },
              handler: {
                select: {
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              repaymentDate: "desc",
            },
          })
        : [],
    ]);

  const selectedAccount =
    scope === "SINGLE_ACCOUNT"
      ? scopedAccounts[0]
      : null;

  return {
    subjectType,
    scope,
    selectedAccount: selectedAccount
      ? {
          id: selectedAccount.id,
          accountNumber: selectedAccount.accountNumber,
          balance: selectedAccount.balance,
          status: selectedAccount.status,
          accountType: selectedAccount.accountType,
          branch: selectedAccount.branch,
          activeHoldCount: selectedAccount._count.accountHolds,
        }
      : null,
    member: member
      ? {
          id: member.id,
          memberNumber: member.memberNumber,
          user: member.user,
          accounts: scopedAccounts.map((account) => ({
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.status,
            accountType: account.accountType,
            branch: account.branch,
            activeHoldCount: account._count.accountHolds,
          })),
        }
      : null,
    institution: institution
      ? {
          id: institution.id,
          institutionNumber: institution.institutionNumber,
          institutionName: institution.institutionName,
          institutionType: institution.institutionType,
          institutionEmail: institution.institutionEmail,
          institutionPhone: institution.institutionPhone,
          postalAddress: institution.postalAddress,
          primaryContactPerson: institution.primaryContactPerson,
          primaryContactPhone: institution.primaryContactPhone,
          accounts: scopedAccounts.map((account) => ({
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.status,
            accountType: account.accountType,
            branch: account.branch,
            activeHoldCount: account._count.accountHolds,
          })),
        }
      : null,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      performedBy:
        transaction.processedByUser?.name ||
        (subjectType === "MEMBER"
          ? member?.user.name
          : institution?.institutionName) ||
        "System",
    })),
    deposits: deposits.map((deposit) => ({
      ...deposit,
      depositedBy: getActorNameFromDeposit(deposit),
      processedBy: deposit.handler?.name || "System",
    })),
    withdrawals: withdrawals.map((withdrawal) => ({
      ...withdrawal,
      withdrawnBy: getActorNameFromWithdrawal(withdrawal),
      processedBy: withdrawal.handler?.name || "System",
    })),
    loanRepayments,
    accountBalances: scopedAccounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      currentBalance: account.balance,
      status: account.status,
      activeHoldCount: account._count.accountHolds,
      accountType: account.accountType,
      branch: account.branch,
    })),
  };
}

export async function getMemberStatementData(
  memberId: string,
  startDate: Date,
  endDate: Date,
  user?: StatementUser,
) {
  const effectiveUser =
    user ||
    ({
      id: "system",
      role: UserRole.ADMIN,
      branchId: null,
    } satisfies StatementUser);

  return buildStatementDataForSubject(effectiveUser, {
    subjectType: "MEMBER",
    memberId,
    startDate,
    endDate,
    scope: "ALL_ACCOUNTS",
  });
}

async function generateStatementPDF(input: {
  user: StatementUser;
  data: StatementCreateInput;
}) {
  const endDate = input.data.endDate || new Date();
  const subjectType = input.data.subjectType || "MEMBER";
  const statementData = await buildStatementDataForSubject(input.user, {
    subjectType,
    memberId: input.data.memberId,
    institutionId: input.data.institutionId,
    accountId: input.data.accountId,
    scope: input.data.scope,
    startDate: input.data.startDate,
    endDate,
  });
  const pdfBuffer = await generateMemberStatementPDF(
    statementData as any,
    input.data.startDate,
    endDate,
  );

  const subjectLabel =
    statementData.member?.memberNumber ||
    statementData.institution?.institutionNumber ||
    "statement";

  const fileName = `statement_${subjectLabel}_${format(
    input.data.startDate,
    "yyyy-MM-dd",
  )}_${format(endDate, "yyyy-MM-dd")}`;

  const uploadResult = await uploadPDFToCloudinaryEnhanced(pdfBuffer, fileName, {
    memberNumber: subjectLabel,
    periodStart: format(input.data.startDate, "yyyy-MM-dd"),
    periodEnd: format(endDate, "yyyy-MM-dd"),
  });

  return uploadResult.url;
}

export async function createStatementRecord(
  user: StatementUser,
  data: StatementCreateInput,
) {
  const metadata = toStatementMetadata(data);
  const endDate = data.endDate || new Date();

  if (data.startDate >= endDate) {
    return {
      error: "Start date must be before end date",
      data: null,
    };
  }

  if (metadata.subjectType === "INSTITUTION") {
    if (!data.institutionId) {
      return {
        error: "Institution is required",
        data: null,
      };
    }

    const institution = await db.institution.findFirst({
      where: {
        id: data.institutionId,
        ...buildInstitutionAccessWhere(user),
      },
      select: {
        id: true,
        institutionNumber: true,
        institutionName: true,
        institutionType: true,
        institutionEmail: true,
        institutionPhone: true,
        postalAddress: true,
        primaryContactPerson: true,
        primaryContactPhone: true,
        accounts: {
          where: {
            status: {
              not: AccountStatus.CLOSED,
            },
          },
          include: {
            accountType: true,
            branch: true,
            accountHolds: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found or not accessible",
        data: null,
      };
    }

    let pdfPath: string | null = null;
    try {
      pdfPath = await generateStatementPDF({ user, data });
    } catch (pdfError) {
      console.error(
        "Institution statement PDF generation/upload failed; creating statement without stored PDF:",
        pdfError,
      );
    }

    const statementId = createInstitutionStatementId();
    const institutionMetadata = {
      ...metadata,
      startDate: data.startDate.toISOString(),
      endDate: endDate.toISOString(),
      pdfPath,
    };

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "STATEMENT_CREATED",
        entityType: "Statement",
        entityId: statementId,
        details: institutionMetadata as any,
      },
    });

    return {
      error: null,
      data: {
        id: statementId,
        memberId: null,
        institutionId: institution.id,
        accountId: metadata.accountId,
        subjectType: "INSTITUTION" as const,
        accountScope: metadata.scope,
        userId: user.id,
        startDate: data.startDate,
        endDate,
        generatedAt: new Date(),
        pdfPath,
        member: null,
        institution: {
          ...institution,
          accounts: institution.accounts.map((account) => ({
            id: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            status: account.status,
            accountType: {
              id: account.accountType.id,
              name: account.accountType.name,
            },
            branch: {
              id: account.branch.id,
              name: account.branch.name,
            },
            activeHoldCount: account.accountHolds.length,
          })),
        },
        user: {
          id: user.id,
          name: "System",
          role: String(user.role),
        },
        statementDate: new Date(),
        periodStart: data.startDate,
        periodEnd: endDate,
        fileUrl: pdfPath,
        generatedByUserId: user.id,
        generatedByUser: {
          id: user.id,
          name: "System",
          role: String(user.role),
        },
      },
    };
  }

  if (!data.memberId) {
    return {
      error: "Member is required",
      data: null,
    };
  }

  const member = await db.member.findFirst({
    where: {
      id: data.memberId,
      ...buildMemberAccessWhere(user),
    },
  });

  if (!member) {
    return {
      error: "Member not found or not accessible",
      data: null,
    };
  }

  const existingStatement = await db.statement.findFirst({
    where: {
      memberId: data.memberId,
      startDate: data.startDate,
      endDate,
    },
    include: {
      member: {
        include: {
          user: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (existingStatement && metadata.scope === "ALL_ACCOUNTS" && !metadata.accountId) {
    return {
      error: "Statement already exists for this period",
      data: existingStatement,
    };
  }

  let pdfPath: string | null = null;
  try {
    pdfPath = await generateStatementPDF({ user, data });
  } catch (pdfError) {
    console.error(
      "Statement PDF generation/upload failed; creating statement without stored PDF:",
      pdfError,
    );
  }

  const statement = await db.statement.create({
    data: {
      memberId: data.memberId,
      userId: user.id,
      startDate: data.startDate,
      endDate,
      pdfPath,
    },
    include: {
      member: {
        include: {
          user: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "STATEMENT_CREATED",
      entityType: "Statement",
      entityId: statement.id,
      details: metadata as any,
    },
  });

  return {
    error: null,
    data: statement,
  };
}
