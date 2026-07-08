export type SavingsListingFilters = {
  branchId?: string;
  productCode?: string;
  status?: string;
  minDaysInactive?: number;
  search?: string;
  asAtDate?: string;
};

export type SavingsListingAccountRow = {
  accountNumber: string;
  memberName: string;
  bankVerificationNo: string | null;
  passbookCount: number | null;
  lastTrxDate: string | null;
  daysWithoutActivity: number;
  dateOpened: string;
  balance: number;
  status: string;
  inactivityFlag: "green" | "amber" | "orange" | "red";
  branchId: string | null;
  branchName: string | null;
  hasBalanceOverride: boolean;
};

export type SavingsListingProduct = {
  code: string;
  name: string;
  memberCount: number;
  productTotal: number;
  accounts: SavingsListingAccountRow[];
  liabilityAccountBalance: number | null;
  difference: number | null;
  isReconciled: boolean | null;
};

export type SavingsListingReport = {
  sacco_name: string;
  location: string;
  report_title: string;
  report_date: string;
  generated_time: string;
  as_at_date: string;
  branch_label: string;
  current_filters: Required<Pick<SavingsListingFilters, "asAtDate">> & Omit<SavingsListingFilters, "asAtDate">;
  products: SavingsListingProduct[];
  grand_total: {
    total_members: number;
    total_balance: number;
    product_count: number;
    reconciled_products: number;
  };
};

export type SavingsMemberDetail = {
  accountNumber: string;
  memberName: string;
  bankVerificationNo: string | null;
  passbookCount: number | null;
  dateOpened: string;
  lastTrxDate: string | null;
  daysWithoutActivity: number;
  balance: number;
  status: string;
  branchName: string | null;
  productCode: string;
  productName: string;
  transactions: Array<{
    transactionDate: string;
    reference: string | null;
    description: string | null;
    transactionType: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
  }>;
};

