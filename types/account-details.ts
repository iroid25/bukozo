// types/account-details.ts (create this file if it doesn't exist)

export interface AccountDetailsProps {
  account: {
    id: string;
    accountNumber: string;
    balance: number;
    status: string;
    openedAt: Date;
    closedAt?: Date | null;
    owner:
      | {
          type: "member";
          memberNumber: string;
          registrationDate: Date;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string;
            phone?: string | null;
            image?: string | null;
          };
        }
      | {
          type: "institution";
          institutionNumber: string;
          registrationDate: Date;
          institutionName: string;
          user: {
            id: string;
            name: string;
            firstName: string;
            lastName: string;
            email: string;
            phone?: string | null;
            image?: string | null;
          };
        };
    accountType: {
      name: string;
      interestRate: number;
      minBalance: number;
      maxWithdrawal?: number | null;
    };
    branch: {
      name: string;
      location: string;
      contactPhone?: string | null;
    };
    transactions: Array<{
      id: string;
      transactionRef: string;
      type: string;
      amount: number;
      status: string;
      description?: string | null;
      transactionDate: Date;
      processedByUser?: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      } | null;
    }>;
    deposits: Array<{
      id: string;
      amount: number;
      depositDate: Date;
      channel: string;
      mobileMoneyRef?: string | null;
      handler: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      };
    }>;
    withdrawals: Array<{
      id: string;
      amount: number;
      withdrawalDate: Date;
      channel: string;
      mobileMoneyRef?: string | null;
      handler: {
        id: string;
        name: string;
        firstName: string;
        lastName: string;
      };
    }>;
  };
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    depositsCount: number;
    withdrawalsCount: number;
    transactionCount: number;
    recentTransactions: any[];
  };
}

// Helper function to get owner display name
export function getOwnerDisplayName(
  owner: AccountDetailsProps["account"]["owner"]
): string {
  if (owner.type === "member") {
    return `${owner.user.firstName} ${owner.user.lastName}`;
  } else {
    return owner.institutionName;
  }
}

// Helper function to get owner number
export function getOwnerNumber(
  owner: AccountDetailsProps["account"]["owner"]
): string {
  if (owner.type === "member") {
    return owner.memberNumber;
  } else {
    return owner.institutionNumber;
  }
}
