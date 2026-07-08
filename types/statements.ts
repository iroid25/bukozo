// types/statements.ts
export interface Statement {
  id: string;
  memberId: string | null;
  institutionId?: string | null;
  accountId?: string | null;
  subjectType?: "MEMBER" | "INSTITUTION";
  accountScope?: "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";
  userId: string | null;
  startDate: Date;
  endDate: Date | null;
  generatedAt: Date;
  pdfPath: string | null;
  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      image: string | null;
    };
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      accountType: {
        id: string;
        name: string;
      };
      branch: {
        id: string;
        name: string;
      };
    }>;
  } | null;
  institution?: {
    id: string;
    institutionNumber: string;
    institutionName: string;
    institutionType?: string;
    institutionEmail?: string | null;
    institutionPhone?: string | null;
    postalAddress?: string | null;
    primaryContactPerson?: string | null;
    primaryContactPhone?: string | null;
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      status?: string;
      accountType: {
        id: string;
        name: string;
      };
      branch: {
        id: string;
        name: string;
      };
      activeHoldCount?: number;
    }>;
  } | null;
  selectedAccount?: {
    id: string;
    accountNumber: string;
    balance: number;
    status?: string;
    accountType: {
      id: string;
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location?: string;
    };
    activeHoldCount?: number;
  } | null;
  user: {
    name: string;
    role: string;
  } | null;
  // Add computed/alias properties for backward compatibility
  statementDate: Date;
  periodStart: Date;
  periodEnd: Date;
  fileUrl: string | null;
  generatedByUserId: string | null;
  generatedByUser: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export interface StatementCreateDTO {
  memberId?: string;
  institutionId?: string;
  accountId?: string;
  subjectType?: "MEMBER" | "INSTITUTION";
  scope?: "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";
  startDate: Date;
  endDate: Date;
}

export interface StatementUpdateDTO {
  id: string;
  pdfPath?: string;
}

export interface StatementPeriod {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

// Helper function to get predefined statement periods
export function getStatementPeriods(): StatementPeriod[] {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  return [
    {
      label: "Current Month",
      value: "current_month",
      startDate: new Date(currentYear, currentMonth, 1),
      endDate: new Date(currentYear, currentMonth + 1, 0),
    },
    {
      label: "Last Month",
      value: "last_month",
      startDate: new Date(currentYear, currentMonth - 1, 1),
      endDate: new Date(currentYear, currentMonth, 0),
    },
    {
      label: "Last 3 Months",
      value: "last_3_months",
      startDate: new Date(currentYear, currentMonth - 3, 1),
      endDate: new Date(currentYear, currentMonth + 1, 0),
    },
    {
      label: "Last 6 Months",
      value: "last_6_months",
      startDate: new Date(currentYear, currentMonth - 6, 1),
      endDate: new Date(currentYear, currentMonth + 1, 0),
    },
    {
      label: "Year to Date",
      value: "year_to_date",
      startDate: new Date(currentYear, 0, 1),
      endDate: today,
    },
    {
      label: "Last Year",
      value: "last_year",
      startDate: new Date(currentYear - 1, 0, 1),
      endDate: new Date(currentYear - 1, 11, 31),
    },
    {
      label: "Custom Period",
      value: "custom",
      startDate: new Date(),
      endDate: new Date(),
    },
  ];
}

export interface StatementData {
  subjectType?: "MEMBER" | "INSTITUTION";
  scope?: "ALL_ACCOUNTS" | "SINGLE_ACCOUNT";
  selectedAccount?: {
    id: string;
    accountNumber: string;
    balance: number;
    status?: string;
    activeHoldCount?: number;
    accountType: {
      id: string;
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  } | null;
  member: {
    id: string;
    memberNumber: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    };
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      status?: string;
      activeHoldCount?: number;
      accountType: {
        id: string;
        name: string;
      };
      branch: {
        id: string;
        name: string;
        location: string;
      };
    }>;
  } | null;
  institution?: {
    id: string;
    institutionNumber: string;
    institutionName: string;
    institutionType?: string;
    institutionEmail?: string | null;
    institutionPhone?: string | null;
    postalAddress?: string | null;
    primaryContactPerson?: string | null;
    primaryContactPhone?: string | null;
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      status?: string;
      activeHoldCount?: number;
      accountType: {
        id: string;
        name: string;
      };
      branch: {
        id: string;
        name: string;
        location: string;
      };
    }>;
  } | null;
  transactions: Array<{
    id: string;
    transactionRef: string;
    type: string;
    amount: number;
    status: string;
    description: string | null;
    transactionDate: Date;
    account: {
      id: string;
      accountNumber: string;
      accountType: {
        id: string;
        name: string;
      };
    };
    processedByUser: {
      name: string;
      role: string;
    } | null;
    performedBy?: string;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    depositDate: Date;
    channel: string;
    mobileMoneyRef: string | null;
    account: {
      id: string;
      accountNumber: string;
      accountType: {
        id: string;
        name: string;
      };
    };
    handler: {
      name: string;
      role: string;
    };
    depositedBy?: string;
    processedBy?: string;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    withdrawalDate: Date;
    channel: string;
    mobileMoneyRef: string | null;
    account: {
      id: string;
      accountNumber: string;
      accountType: {
        id: string;
        name: string;
      };
    };
    handler: {
      name: string;
      role: string;
    };
    withdrawnBy?: string;
    processedBy?: string;
  }>;
  loanRepayments: Array<{
    id: string;
    amount: number;
    repaymentDate: Date;
    channel: string;
    mobileMoneyRef: string | null;
    loan: {
      id: string;
      loanApplication: {
        id: string;
        loanProduct: {
          id: string;
          name: string;
        };
      };
    };
    handler: {
      name: string;
      role: string;
    };
  }>;
  accountBalances: Array<{
    id: string;
    accountNumber: string;
    currentBalance: number;
    status?: string;
    activeHoldCount?: number;
    accountType: {
      id: string;
      name: string;
    };
    branch: {
      id: string;
      name: string;
      location: string;
    };
  }>;
}
