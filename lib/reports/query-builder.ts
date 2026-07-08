import { Prisma } from '@prisma/client';

/**
 * Report Query Builder
 * Helps build complex Prisma queries for reports
 */
export class ReportQueryBuilder {
  /**
   * Build date range filter
   */
  static buildDateRangeFilter(
    field: string,
    startDate: string | Date,
    endDate: string | Date
  ): any {
    return {
      [field]: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
  }

  /**
   * Build branch filter
   */
  static buildBranchFilter(branchId?: string): any {
    if (!branchId) return {};
    return { branchId };
  }

  /**
   * Build status filter
   */
  static buildStatusFilter(status?: string | string[]): any {
    if (!status) return {};
    if (Array.isArray(status)) {
      return { status: { in: status } };
    }
    return { status };
  }

  /**
   * Build member filter
   */
  static buildMemberFilter(memberId?: string): any {
    if (!memberId) return {};
    return { memberId };
  }

  /**
   * Build account type filter
   */
  static buildAccountTypeFilter(accountTypeId?: string): any {
    if (!accountTypeId) return {};
    return { accountTypeId };
  }

  /**
   * Combine filters with AND logic
   */
  static combineFilters(...filters: any[]): any {
    const combined = filters.reduce((acc, filter) => {
      return { ...acc, ...filter };
    }, {});
    return combined;
  }

  /**
   * Build pagination
   */
  static buildPagination(page: number = 1, pageSize: number = 50): any {
    return {
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  /**
   * Build sorting
   */
  static buildSort(field: string, direction: 'asc' | 'desc' = 'asc'): any {
    return {
      orderBy: {
        [field]: direction,
      },
    };
  }

  /**
   * Build account balance query
   */
  static buildAccountBalanceQuery(params: {
    accountType?: string;
    branchId?: string;
    status?: string;
    minBalance?: number;
    maxBalance?: number;
  }): any {
    const where: any = {};

    if (params.accountType) {
      where.accountTypeId = params.accountType;
    }

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.minBalance !== undefined || params.maxBalance !== undefined) {
      where.balance = {};
      if (params.minBalance !== undefined) {
        where.balance.gte = params.minBalance;
      }
      if (params.maxBalance !== undefined) {
        where.balance.lte = params.maxBalance;
      }
    }

    return where;
  }

  /**
   * Build transaction query
   */
  static buildTransactionQuery(params: {
    startDate: string | Date;
    endDate: string | Date;
    accountId?: string;
    transactionType?: string;
    minAmount?: number;
    maxAmount?: number;
  }): any {
    const where: any = {
      transactionDate: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate),
      },
    };

    if (params.accountId) {
      where.accountId = params.accountId;
    }

    if (params.transactionType) {
      where.transactionType = params.transactionType;
    }

    if (params.minAmount !== undefined || params.maxAmount !== undefined) {
      where.amount = {};
      if (params.minAmount !== undefined) {
        where.amount.gte = params.minAmount;
      }
      if (params.maxAmount !== undefined) {
        where.amount.lte = params.maxAmount;
      }
    }

    return where;
  }
}
