export type IncomeExpenseAccount = {
  code: string;
  name: string;
  current_period: number;
  prior_ytd: number;
  closing: number;
  journal_count: number;
  section: "INCOME" | "EXPENDITURES";
  group_code: string;
  group_name: string;
};

export type IncomeExpenseGroup = {
  code: string;
  name: string;
  is_standalone: boolean;
  accounts: IncomeExpenseAccount[];
  group_total: {
    current_period: number;
    prior_ytd: number;
    closing: number;
  };
};

export type IncomeExpenseSection = {
  type: "INCOME" | "EXPENDITURES";
  label: string;
  groups: IncomeExpenseGroup[];
  section_total: {
    current_period: number;
    prior_ytd: number;
    closing: number;
  };
};

export type IncomeExpenseReport = {
  sacco_name: string;
  location: string;
  report_title: string;
  report_date: string;
  generated_time: string;
  branch: {
    id: string | "all";
    name: string;
  };
  current_period: {
    label: string;
    start: string;
    end: string;
  };
  compare_period: {
    label: string;
    start: string;
    end: string;
  };
  sections: IncomeExpenseSection[];
  net_result: {
    label: string;
    current_period: number;
    prior_ytd: number;
    closing: number;
    is_surplus: boolean;
  };
  account_count: number;
  expense_account_count: number;
};

export type IncomeExpenseDrilldown = {
  account: {
    code: string;
    name: string;
    section: "INCOME" | "EXPENDITURES";
    group: string;
  };
  period: {
    label: string;
    start: string;
    end: string;
  };
  branch: {
    id: string | "all";
    name: string;
  };
  entries: Array<{
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: {
    debit: number;
    credit: number;
    balance: number;
  };
};
