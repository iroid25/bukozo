export interface ActivityRecord {
  id: string;
  user: string;
  branchId?: string | null;
  branchName?: string | null;
  member?: string;
  type: string;
  action: string;
  description: string;
  status: string;
  amount?: number;
  reference?: string;
  channel?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface ActivityStats {
  totalActivities: number;
  todayActivities: number;
  thisWeekActivities: number;
  thisMonthActivities: number;
  totalTransactionValue: number;
  uniqueUsers: number;
  deposits: number;
  withdrawals: number;
  loans: number;
  loanRepayments: number;
  userManagement: number;
  accountManagement: number;
}

export const EMPTY_ACTIVITY_STATS: ActivityStats = {
  totalActivities: 0,
  todayActivities: 0,
  thisWeekActivities: 0,
  thisMonthActivities: 0,
  totalTransactionValue: 0,
  uniqueUsers: 0,
  deposits: 0,
  withdrawals: 0,
  loans: 0,
  loanRepayments: 0,
  userManagement: 0,
  accountManagement: 0,
};

export interface ActivityFilters {
  activityType?: string;
  status?: string;
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  orderBy?: "createdAt" | "action";
  orderDirection?: "asc" | "desc";
  userId?: string;
  memberId?: string;
}
