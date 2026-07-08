import { db } from "@/prisma/db";
import { UserRole, Prisma } from "@prisma/client";
import { format } from "date-fns";
import {
  calculateLoanSchedule,
  type ScheduleFrequency,
} from "@/lib/loan-calculations";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function getBranchFilterForLoanService(
  user: any,
  requestedBranchId?: string,
) {
  if (user.role === UserRole.ADMIN) {
    if (requestedBranchId && requestedBranchId !== "all") {
      return { branchId: requestedBranchId };
    }
    return {};
  }

  // Branch isolation for other roles
  if (!user.branchId) return { branchId: "no-branch" };
  return { branchId: user.branchId };
}

function resolveEffectiveInterestPeriod(
  ...periods: Array<string | null | undefined>
): "ANNUAL" | "MONTHLY" {
  return periods.some((period) => period === "ANNUAL") ? "ANNUAL" : "MONTHLY";
}

// ============================================================================
// CORE LOGIC: OUTSTANDING BALANCE & AGING
// ============================================================================

export async function getLoanOutstandingBalanceService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
    loanProductId?: string;
    agingBracket?: string;
    status?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );

  const statusFilter =
    filters?.status && filters.status !== "all"
      ? [filters.status]
      : ["DISBURSED", "OVERDUE"];

  const where: any = {
    status: { in: statusFilter },
    ...branchFilter,
  };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
  }

  // Individual Loans
  const indWhere = { ...where };
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    indWhere.loanApplication = { loanProductId: filters.loanProductId };
  }

  const loans = await db.loan.findMany({
    where: indWhere,
    include: {
      member: { include: { user: true } },
      branch: true,
      loanApplication: { include: { loanProduct: true } },
      allocatedTeller: true,
      schedules: {
        where: { status: { not: "PAID" } },
        orderBy: { period: "asc" },
        // NOTE: No `take: 1` — we need all unpaid schedules to correctly compute outstanding P+I
      },
    },
  });

  // Institutional Loans — InstitutionLoan has no branchId field, filter via institution.user.branchId
  const instWhere: any = { ...where };
  delete instWhere.branchId;
  if (branchFilter.branchId) {
    instWhere.institution = { user: { branchId: branchFilter.branchId } };
  }
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    instWhere.application = { loanProduct: { id: filters.loanProductId } };
  }

  const institutionLoans = await db.institutionLoan.findMany({
    where: instWhere,
    include: {
      institution: { include: { user: { include: { branch: true } } } },
      application: { include: { loanProduct: true } },
      allocatedTeller: true,
    },
  });

  const now = new Date();

  const calculateAging = (schedules: any[] | null | undefined) => {
    if (!schedules || schedules.length === 0)
      return { daysInArrears: 0, bracket: "Current" };
    const earliest = schedules[0];
    const dueDate = new Date(earliest.dueDate || earliest.duedate);
    if (dueDate >= now) return { daysInArrears: 0, bracket: "Current" };

    const diffTime = Math.max(0, now.getTime() - dueDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let bracket = "Current";
    if (diffDays > 90) bracket = "90+ Days";
    else if (diffDays > 60) bracket = "61 - 90 Days";
    else if (diffDays > 30) bracket = "31 - 60 Days";
    else if (diffDays > 0) bracket = "1 - 30 Days";

    return { daysInArrears: diffDays, bracket };
  };

  const processLoanData = (loan: any, isInst: boolean = false) => {
    const schedules = loan.schedules || [];
    const aging = calculateAging(schedules);
    const amountGranted = loan.amountGranted || 0;
    const outstandingBalance = loan.outstandingBalance || 0;
    const totalAmountDue = Number(loan.totalAmountDue || 0);
    const storedInterestAmount = loan.interestAmount;
    const originalInterest = Math.max(
      0,
      Number(
        storedInterestAmount !== null && storedInterestAmount !== undefined
          ? storedInterestAmount
          : totalAmountDue - amountGranted,
      ),
    );
    const totalPenaltyCharged = Math.max(
      0,
      Number(loan.penaltyCharged || loan.penaltyPaid || 0),
    );

    // Use schedules to find exactly what is OVERDUE (Arrears)
    // If the user wants the "Portfolio at Risk" (Total Remaining), we sum all unpaid.
    // If they want "Arrears" (Amount Overdue), we only sum past-due installments.
    // Given the column names "Principal", "Interest", "Penalty", "Total Arrears",
    // we'll sum ALL unpaid portions to match the total ground truth (Portfolio at Risk).

    // Sum overdue vs remaining
    const unpaidSchedules = schedules; // Already filtered for status: not PAID

    const totalUnpaidPrincipal = unpaidSchedules.reduce(
      (sum: number, sc: any) => sum + (sc.principalPayment || 0),
      0,
    );
    const totalUnpaidInterest = unpaidSchedules.reduce(
      (sum: number, sc: any) => sum + (sc.interestPayment || 0),
      0,
    );

    // Adjust for partial payments on those schedules
    const outstandingPrincipal = unpaidSchedules.reduce(
      (s: number, sc: any) => {
        const paid = sc.paidAmount || 0;
        const total = (sc.principalPayment || 0) + (sc.interestPayment || 0);
        if (total > 0 && sc.principalPayment) {
          // Approximate principal portion of the unpaid balance for this schedule
          const principalRatio = sc.principalPayment / total;
          return s + Math.max(0, sc.principalPayment - paid * principalRatio);
        }
        return s + (sc.principalPayment || 0);
      },
      0,
    );

    const outstandingInterest = unpaidSchedules.reduce((s: number, sc: any) => {
      const paid = sc.paidAmount || 0;
      const total = (sc.principalPayment || 0) + (sc.interestPayment || 0);
      if (total > 0 && sc.interestPayment) {
        const interestRatio = sc.interestPayment / total;
        return s + Math.max(0, sc.interestPayment - paid * interestRatio);
      }
      return s + (sc.interestPayment || 0);
    }, 0);

    // Anchor: Penalty = the difference between ground-truth balance and summed P+I
    const outstandingPenalty = Math.max(
      0,
      outstandingBalance - outstandingPrincipal - outstandingInterest,
    );

    return {
      loanId: loan.id,
      memberNumber: isInst
        ? loan.institution?.institutionNumber
        : loan.member?.memberNumber,
      memberName: isInst
        ? loan.institution?.institutionName
        : loan.member?.user?.name,
      memberPhone: isInst
        ? loan.institution?.user?.phone || "N/A"
        : loan.member?.user?.phone || "N/A",
      loanProduct: isInst
        ? loan.application?.loanProduct?.name || "N/A"
        : loan.loanApplication?.loanProduct?.name || "N/A",
      // Fields matching the OutstandingReportView interface
      principalDue: amountGranted,
      interestDue: originalInterest,
      penaltyDue: totalPenaltyCharged,
      outstandingPrincipal,
      outstandingInterest,
      outstandingPenalty,
      totalOutstanding:
        outstandingPrincipal + outstandingInterest + outstandingPenalty,
      totalDue: Math.max(
        totalAmountDue,
        amountGranted + originalInterest + totalPenaltyCharged,
      ),
      daysInArrears: aging.daysInArrears,
      agingBracket: aging.bracket,
      loanOfficer: loan.allocatedTeller?.name || "N/A",
      branch: isInst
        ? loan.institution?.user?.branch?.name || "N/A"
        : loan.branch?.name || "N/A",
      status:
        outstandingBalance <= 0
          ? "PAID"
          : aging.daysInArrears > 0
            ? "OVERDUE"
            : "DISBURSED",
    };
  };

  const indLoansData = loans.map((l) => processLoanData(l, false));

  const instLoansData = await Promise.all(
    institutionLoans.map(async (loan) => {
      const rawSchedules = await db.$queryRaw<any[]>`
      SELECT * FROM "InstitutionLoanRepaymentSchedule" 
      WHERE "loanId" = ${loan.id} AND "status" != 'PAID'
      ORDER BY "period" ASC
    `;
      // Normalize raw SQL column names (PostgreSQL returns lowercase) to camelCase
      const instSchedules = rawSchedules.map((s: any) => ({
        ...s,
        principalPayment:
          s.principalPayment ?? s.principalpayment ?? s.principal_payment ?? 0,
        interestPayment:
          s.interestPayment ?? s.interestpayment ?? s.interest_payment ?? 0,
        paidAmount: s.paidAmount ?? s.paidamount ?? s.paid_amount ?? 0,
        dueDate: s.dueDate ?? s.duedate ?? s.due_date,
        status: s.status,
      }));
      return processLoanData({ ...loan, schedules: instSchedules }, true);
    }),
  );

  const reportData = [...indLoansData, ...instLoansData].filter((l) => {
    if (filters?.agingBracket && filters.agingBracket !== "all") {
      return l.agingBracket === filters.agingBracket;
    }
    return true;
  });

  const totalPrincipalDue = reportData.reduce(
    (sum, l) => sum + (l.principalDue || 0),
    0,
  );
  const totalInterestDue = reportData.reduce(
    (sum, l) => sum + (l.interestDue || 0),
    0,
  );
  const totalPenaltyDue = reportData.reduce(
    (sum, l) => sum + (l.penaltyDue || 0),
    0,
  );
  const totalDue = reportData.reduce((sum, l) => sum + (l.totalDue || 0), 0);
  const totalOutstandingPrincipal = reportData.reduce(
    (sum, l) => sum + (l.outstandingPrincipal || 0),
    0,
  );
  const totalOutstandingInterest = reportData.reduce(
    (sum, l) => sum + (l.outstandingInterest || 0),
    0,
  );
  const totalOutstandingPenalty = reportData.reduce(
    (sum, l) => sum + (l.outstandingPenalty || 0),
    0,
  );
  const totalOutstanding = reportData.reduce(
    (sum, l) => sum + (l.totalOutstanding || 0),
    0,
  );

  const summary = {
    totalLoans: reportData.length,
    totalPrincipalDue,
    totalInterestDue,
    totalPenaltyDue,
    totalDue,
    totalOutstandingPrincipal,
    totalOutstandingInterest,
    totalOutstandingPenalty,
    totalOutstanding,
    percentageRecovered:
      totalDue > 0 ? ((totalDue - totalOutstanding) / totalDue) * 100 : 0,
    agingAnalysis: {
      current: reportData.filter((l) => l.agingBracket === "Current").length,
      oneToThirty: reportData.filter((l) => l.agingBracket === "1 - 30 Days")
        .length,
      thirtyOneToSixty: reportData.filter(
        (l) => l.agingBracket === "31 - 60 Days",
      ).length,
      sixtyOneToNinety: reportData.filter(
        (l) => l.agingBracket === "61 - 90 Days",
      ).length,
      ninetyPlus: reportData.filter((l) => l.agingBracket === "90+ Days").length,
    },
  };

  return { loans: reportData, summary };
}

// ============================================================================
// 1. ARREARS REPORT
// ============================================================================
export async function getLoanArrearsReportService(user: any, filters?: any) {
  const result = await getLoanOutstandingBalanceService(user, {
    ...filters,
    status: "all",
  });

  if (result.loans) {
    result.loans = result.loans.filter((l: any) => l.daysInArrears > 0);
    result.summary.totalLoans = result.loans.length;
    result.summary.totalOutstandingPrincipal = result.loans.reduce(
      (sum: number, l: any) => sum + l.outstandingPrincipal,
      0,
    );
    result.summary.totalOutstandingInterest = result.loans.reduce(
      (sum: number, l: any) => sum + l.outstandingInterest,
      0,
    );
    result.summary.totalOutstanding = result.loans.reduce(
      (sum: number, l: any) => sum + l.totalOutstanding,
      0,
    );
  }

  return result;
}

// ============================================================================
// 2. AGING REPORT (ARREARS BY AGE)
// ============================================================================
export async function getLoanArrearsByAgeService(
  user: any,
  filters?: { branchId?: string; officerId?: string },
) {
  const result = await getLoanOutstandingBalanceService(user, {
    ...filters,
    status: "all",
  });

  const brackets: Record<
    string,
    {
      numberOfLoans: number;
      principalArrears: number;
      interestArrears: number;
      penaltyArrears: number;
      totalArrears: number;
      members: Array<{ name: string; memberNumber: string; amount: number }>;
    }
  > = {
    "1-30 days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
    "31-60 days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
    "61-90 days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
    "91-180 days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
    "181-365 days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
    "365+ days": {
      numberOfLoans: 0,
      principalArrears: 0,
      interestArrears: 0,
      penaltyArrears: 0,
      totalArrears: 0,
      members: [],
    },
  };

  result.loans.forEach((loan: any) => {
    if (loan.daysInArrears <= 0) return;

    let bracket = loan.agingBracket;
    if (brackets[bracket]) {
      brackets[bracket].numberOfLoans++;
      brackets[bracket].principalArrears += loan.outstandingPrincipal || 0;
      brackets[bracket].interestArrears += loan.outstandingInterest || 0;
      brackets[bracket].penaltyArrears += loan.outstandingPenalty || 0;
      brackets[bracket].totalArrears += loan.totalOutstanding || 0;
      brackets[bracket].members.push({
        name: loan.memberName,
        memberNumber: loan.memberNumber,
        amount: loan.totalOutstanding,
      });
    }
  });

  const grandTotal = Object.values(brackets).reduce(
    (sum, b) => sum + b.totalArrears,
    0,
  );

  const agingBrackets = Object.entries(brackets)
    .map(([name, b]) => ({
      agingBracket: name,
      ...b,
      percentage: grandTotal > 0 ? (b.totalArrears / grandTotal) * 100 : 0,
    }))
    .filter((b) => b.numberOfLoans > 0);

  return {
    agingBrackets,
    summary: {
      totalLoans: agingBrackets.reduce((sum, b) => sum + b.numberOfLoans, 0),
      totalPrincipalArrears: agingBrackets.reduce(
        (sum, b) => sum + b.principalArrears,
        0,
      ),
      totalInterestArrears: agingBrackets.reduce(
        (sum, b) => sum + b.interestArrears,
        0,
      ),
      totalPenaltyArrears: agingBrackets.reduce(
        (sum, b) => sum + (b as any).penaltyArrears,
        0,
      ),
      totalArrears: grandTotal,
    },
  };
}

// ============================================================================
// 3. PORTFOLIO REPORT
// ============================================================================
export async function getLoanPortfolioReportService(
  user: any,
  filters?: { branchId?: string; officerId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  const where: any = {
    status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
    ...branchFilter,
  };

  if (filters?.officerId && filters.officerId !== "all") {
    where.allocatedTellerId = filters.officerId;
  }

  // Role-based restrictions for Loan Officers
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    where.allocatedTellerId = user.id;
  }

  const [products, branches, officers, allLoans, allInstLoansRaw] =
    await Promise.all([
      db.loanProduct.findMany(),
      db.branch.findMany({ select: { id: true, name: true } }),
      db.user.findMany({
        where: {
          role: { in: [UserRole.LOANOFFICER, UserRole.TELLER] },
          ...(bId ? { branchId: bId } : {}),
        },
        select: { id: true, name: true },
      }),
      db.loan.findMany({
        where: where,
        include: {
          loanApplication: { include: { loanProduct: true } },
          branch: true,
          allocatedTeller: true,
          schedules: {
            where: { status: { not: "PAID" } },
            orderBy: { period: "asc" },
            take: 1,
          },
        },
      }),
      db.institutionLoan.findMany({
        where: {
          status: where.status,
          ...(where.allocatedTellerId
            ? { allocatedTellerId: where.allocatedTellerId }
            : {}),
          ...(bId ? { institution: { user: { branchId: bId } } } : {}),
        },
        include: {
          application: { include: { loanProduct: true } },
          institution: { include: { user: { include: { branch: true } } } },
          allocatedTeller: true,
        },
      }),
    ]);

  const allInstLoans = await Promise.all(
    allInstLoansRaw.map(async (loan) => {
      const instSchedules = await db.$queryRaw<any[]>`
      SELECT * FROM "InstitutionLoanRepaymentSchedule" 
      WHERE "loanId" = ${loan.id} AND "status" != 'PAID'
      ORDER BY "period" ASC LIMIT 1
    `;
      return { ...loan, schedules: instSchedules };
    }),
  );

  const combinedLoans = [
    ...allLoans.map((l) => ({
      ...l,
      productName: l.loanApplication?.loanProduct?.name || "N/A",
      productId: l.loanApplication?.loanProduct?.id,
      branchName: l.branch?.name || "Main Branch",
      officerName: l.allocatedTeller?.name || "Unassigned",
    })),
    ...allInstLoans.map((l) => ({
      ...l,
      productName: l.application?.loanProduct?.name || "N/A",
      productId: l.application?.loanProduct?.id,
      branchName: l.institution?.user?.branch?.name || "Main Branch",
      officerName: l.allocatedTeller?.name || "Unassigned",
    })),
  ];

  const now = new Date();
  const isOverdue = (l: any) => {
    if (l.status === "OVERDUE") return true;
    if (l.status !== "DISBURSED") return false;
    const schedules = l.schedules || [];
    if (schedules.length === 0) return false;
    const dueDate = new Date(schedules[0].dueDate || schedules[0].duedate);
    return dueDate < now;
  };

  const calculateStats = (loans: any[]) => {
    const activeLoans = loans.filter(
      (l) => l.status === "DISBURSED" || l.status === "OVERDUE",
    );
    const overdueLoans = loans.filter((l) => isOverdue(l));
    const repaidLoans = loans.filter((l) => l.status === "REPAID");

    const totalDisbursed = loans.reduce((sum, l) => sum + l.amountGranted, 0);
    const totalOutstanding = loans.reduce(
      (sum, l) => sum + l.outstandingBalance,
      0,
    );
    const totalRepaid = loans.reduce((sum, l) => sum + (l.amountPaid || 0), 0);
    const overdueBalance = overdueLoans.reduce(
      (sum, l) => sum + l.outstandingBalance,
      0,
    );

    return {
      totalLoans: loans.length,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      repaidLoans: repaidLoans.length,
      portfolioAtRisk:
        totalOutstanding > 0 ? (overdueBalance / totalOutstanding) * 100 : 0,
      recoveryRate:
        totalDisbursed > 0 ? (totalRepaid / totalDisbursed) * 100 : 0,
    };
  };

  const byProduct = products.map((p) => {
    const productLoans = combinedLoans.filter((l) => l.productId === p.id);
    return {
      productId: p.id,
      productName: p.name,
      ...calculateStats(productLoans),
    };
  });

  const byBranch = branches.map((b: any) => {
    const branchLoans = combinedLoans.filter((l: any) => l.branchId === b.id);
    return {
      branchName: b.name,
      ...calculateStats(branchLoans),
    };
  });

  const byOfficer = officers.map((o: any) => {
    const officerLoans = combinedLoans.filter(
      (l: any) => l.allocatedTellerId === o.id,
    );
    return {
      officerName: o.name,
      performanceScore: calculateStats(officerLoans).recoveryRate,
      ...calculateStats(officerLoans),
    };
  });

  const summary = calculateStats(combinedLoans);

  return {
    byProduct: byProduct.filter((p: any) => p.totalLoans > 0),
    byBranch: byBranch.filter((b: any) => b.totalLoans > 0),
    byOfficer: byOfficer.filter((o: any) => o.totalLoans > 0),
    summary,
    userName: user.name,
    userRole: user.role,
    branchName: bId ? branches.find((b: any) => b.id === bId)?.name : null,
  };
}

// ============================================================================
// 4. LOAN SUMMARY
// ============================================================================
export async function getLoanSummaryService(
  user: any,
  filters: { startDate?: Date; endDate?: Date; branchId?: string } = {},
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );
  const bId = branchFilter.branchId;

  const where: any = { ...branchFilter };
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    where.allocatedTellerId = user.id;
  }

  const dateFilter: any = {};
  if (filters.startDate) dateFilter.gte = filters.startDate;
  if (filters.endDate) dateFilter.lte = filters.endDate;

  // LoanApplication has no branchId — filter via member.user.branchId
  const { branchId: _skipAppBId, ...indAppBase } = where;
  const indAppWhere: any = { ...indAppBase };
  if (Object.keys(dateFilter).length > 0)
    indAppWhere.applicationDate = dateFilter;
  if (bId) indAppWhere.member = { user: { branchId: bId } };

  // InstitutionLoanApplication — remove branchId (it doesn't have one)
  const { branchId: _skipBId2, ...instAppBase } = where;
  const instAppWhere: any = { ...instAppBase };
  if (Object.keys(dateFilter).length > 0)
    instAppWhere.applicationDate = dateFilter;
  if (bId) instAppWhere.institution = { user: { branchId: bId } };

  const loanWhere: any = { ...where };
  if (Object.keys(dateFilter).length > 0)
    loanWhere.disbursementDate = dateFilter;

  // InstitutionLoan queries — remove branchId field and filter via institution relation
  const instLoanBase: any = { ...loanWhere };
  delete instLoanBase.branchId;
  if (bId) {
    instLoanBase.institution = { user: { branchId: bId } };
  }
  const [
    disbursedStats,
    outstandingStats,
    repaidStats,
    activeCount,
    overdueCount,
    repaidCount,
    instDisbursedStats,
    instOutstandingStats,
    instRepaidStats,
    instActiveCount,
    instOverdueCount,
    instRepaidCount,
    totalApps,
    totalApprovedApps,
    instTotalApps,
    instApprovedApps,
  ] = await Promise.all([
    db.loan.aggregate({
      where: loanWhere,
      _sum: { amountGranted: true },
      _count: true,
    }),
    db.loan.aggregate({
      where: { ...loanWhere, status: { in: ["DISBURSED", "OVERDUE"] } },
      _sum: { outstandingBalance: true },
    }),
    db.loan.aggregate({ where: loanWhere, _sum: { amountPaid: true } }),
    db.loan.count({ where: { ...loanWhere, status: "DISBURSED" } }),
    db.loan.count({ where: { ...loanWhere, status: "OVERDUE" } }),
    db.loan.count({ where: { ...loanWhere, status: "REPAID" } }),

    db.institutionLoan.aggregate({
      where: instLoanBase,
      _sum: { amountGranted: true },
      _count: true,
    }),
    db.institutionLoan.aggregate({
      where: { ...instLoanBase, status: { in: ["DISBURSED", "OVERDUE"] } },
      _sum: { outstandingBalance: true },
    }),
    db.institutionLoan.aggregate({
      where: instLoanBase,
      _sum: { amountPaid: true },
    }),
    db.institutionLoan.count({
      where: { ...instLoanBase, status: "DISBURSED" },
    }),
    db.institutionLoan.count({ where: { ...instLoanBase, status: "OVERDUE" } }),
    db.institutionLoan.count({ where: { ...instLoanBase, status: "REPAID" } }),

    db.loanApplication.count({ where: indAppWhere }),
    db.loanApplication.count({ where: { ...indAppWhere, status: "APPROVED" } }),
    db.institutionLoanApplication.count({ where: instAppWhere }),
    db.institutionLoanApplication.count({
      where: { ...instAppWhere, status: "APPROVED" },
    }),
  ]);

  const totalDisbursed =
    (disbursedStats._sum.amountGranted || 0) +
    (instDisbursedStats._sum.amountGranted || 0);
  const totalLoansCount =
    (disbursedStats._count || 0) + (instDisbursedStats._count || 0);
  const totalOutstanding =
    (outstandingStats._sum.outstandingBalance || 0) +
    (instOutstandingStats._sum.outstandingBalance || 0);
  const totalRepaidAll =
    (repaidStats._sum.amountPaid || 0) + (instRepaidStats._sum.amountPaid || 0);

  const allApps = totalApps + instTotalApps;
  const allApproved = totalApprovedApps + instApprovedApps;

  return {
    totalLoans: totalLoansCount,
    totalDisbursed,
    totalOutstanding,
    totalRepaid: totalRepaidAll,
    activeLoans: activeCount + instActiveCount,
    overdueLoans: overdueCount + instOverdueCount,
    repaidLoans: repaidCount + instRepaidCount,
    approvalRate: allApps > 0 ? (allApproved / allApps) * 100 : 0,
    repaymentRate:
      totalDisbursed > 0 ? (totalRepaidAll / totalDisbursed) * 100 : 0,
    defaultRate:
      totalLoansCount > 0
        ? ((overdueCount + instOverdueCount) / totalLoansCount) * 100
        : 0,
    averageLoanAmount:
      totalLoansCount > 0 ? totalDisbursed / totalLoansCount : 0,
  };
}

// ============================================================================
// 5. PRODUCT PERFORMANCE
// ============================================================================
export async function getLoanProductPerformanceService(
  user: any,
  filters: { startDate?: Date; endDate?: Date; branchId?: string } = {},
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );
  const bId = branchFilter.branchId;

  const dateFilter: any = {};
  if (filters.startDate) dateFilter.gte = filters.startDate;
  if (filters.endDate) dateFilter.lte = filters.endDate;

  const indWhere: any = {};
  if (Object.keys(dateFilter).length > 0) indWhere.applicationDate = dateFilter;
  if (bId) indWhere.member = { user: { branchId: bId } };
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    indWhere.allocatedTellerId = user.id;
  }

  const instWhere: any = {};
  if (Object.keys(dateFilter).length > 0)
    instWhere.applicationDate = dateFilter;
  if (bId) instWhere.institution = { user: { branchId: bId } };
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    instWhere.allocatedTellerId = user.id;
  }

  const products = await db.loanProduct.findMany({
    include: {
      loanApplications: { where: indWhere, include: { loan: true } },
      institutionLoanApplications: {
        where: instWhere,
        include: { institutionLoan: true },
      },
    },
  });

  return products.map((p: any) => {
    const apps = [...p.loanApplications, ...p.institutionLoanApplications];
    const approved = apps.filter(
      (a) => a.status === "APPROVED" || a.status === "DISBURSED",
    );
    const loans = apps
      .map((a: any) => a.loan || a.institutionLoan)
      .filter(Boolean);

    const totalDisbursed = loans.reduce(
      (sum, l) => sum + (l?.amountGranted || 0),
      0,
    );
    const repaidAmount = loans.reduce(
      (sum, l) => sum + (l?.amountPaid || 0),
      0,
    );

    return {
      id: p.id,
      name: p.name,
      totalApplications: apps.length,
      approvedApplications: approved.length,
      totalDisbursed,
      outstandingBalance: loans.reduce(
        (sum, l) => sum + (l?.outstandingBalance || 0),
        0,
      ),
      repaidAmount,
      approvalRate: apps.length > 0 ? (approved.length / apps.length) * 100 : 0,
      repaymentRate:
        totalDisbursed > 0 ? (repaidAmount / totalDisbursed) * 100 : 0,
    };
  });
}

// ============================================================================
// 6. MONTHLY TRENDS
// ============================================================================
export async function getMonthlyLoanTrendsService(
  user: any,
  months: number = 6,
  filters?: { branchId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // LoanApplication has no branchId — don't spread branchFilter
  const indAppWhere: any = {
    applicationDate: { gte: startDate },
  };
  // InstitutionLoanApplication has no branchId either
  const instAppWhere: any = {
    applicationDate: { gte: startDate },
  };
  const indRepayWhere: any = {
    repaymentDate: { gte: startDate },
  };
  const instRepayWhere: any = {
    repaymentDate: { gte: startDate },
  };

  if (bId) {
    indAppWhere.member = { user: { branchId: bId } };
    instAppWhere.institution = { user: { branchId: bId } };
    indRepayWhere.loan = { branchId: bId };
    // InstitutionLoanRepayment.loan is InstitutionLoan which has no branchId
    instRepayWhere.loan = { institution: { user: { branchId: bId } } };
  }

  const [indApps, instApps, indRepay, instRepay] = await Promise.all([
    db.loanApplication.findMany({
      where: indAppWhere,
      include: { loan: true },
    }),
    db.institutionLoanApplication.findMany({
      where: instAppWhere,
      include: { institutionLoan: true },
    }),
    db.loanRepayment.findMany({ where: indRepayWhere }),
    db.institutionLoanRepayment.findMany({ where: instRepayWhere }),
  ]);

  const applications = [...indApps, ...instApps];
  const repayments = [...indRepay, ...instRepay];

  const monthlyData: Record<string, any> = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthlyData[key] = {
      month: d.toLocaleString("default", { month: "long" }),
      year: d.getFullYear(),
      applicationsCount: 0,
      approvedCount: 0,
      disbursedAmount: 0,
      repaymentsAmount: 0,
      outstandingAmount: 0,
    };
  }

  applications.forEach((app) => {
    const d = new Date(app.applicationDate);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (monthlyData[key]) {
      monthlyData[key].applicationsCount++;
      const loan = (app as any).loan || (app as any).institutionLoan;
      if (app.status === "APPROVED" || app.status === "DISBURSED") {
        monthlyData[key].approvedCount++;
        if (loan) {
          monthlyData[key].disbursedAmount += loan.amountGranted;
          monthlyData[key].outstandingAmount += loan.outstandingBalance;
        }
      }
    }
  });

  repayments.forEach((rep) => {
    const d = new Date(rep.repaymentDate);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (monthlyData[key]) {
      monthlyData[key].repaymentsAmount += rep.amount;
    }
  });

  return Object.values(monthlyData);
}

// ============================================================================
// 7. LOAN REPAYMENT REPORT
// ============================================================================
export async function getLoanRepaymentReportService(
  user: any,
  filters: { startDate?: Date; endDate?: Date; branchId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );
  const branchId = branchFilter.branchId;

  const where: any = {};
  if (filters.startDate) where.repaymentDate = { gte: filters.startDate };
  if (filters.endDate)
    where.repaymentDate = {
      ...(where.repaymentDate || {}),
      lte: filters.endDate,
    };

  // Individual Repayments
  const indWhere = { ...where };
  if (branchId) indWhere.loan = { branchId };

  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    indWhere.loan = { ...indWhere.loan, allocatedTellerId: user.id };
  }

  const repayments = await db.loanRepayment.findMany({
    where: indWhere,
    include: {
      loan: {
        include: {
          member: { include: { user: { select: { name: true } } } },
          loanApplication: {
            include: { loanProduct: { select: { name: true } } },
          },
          branch: { select: { name: true } },
        },
      },
      handler: { select: { name: true } },
    },
    orderBy: { repaymentDate: "desc" },
  });

  // Institutional Repayments
  const instWhere: any = { ...where };
  if (branchId) {
    instWhere.loan = { institution: { user: { branchId } } };
  }
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    instWhere.loan = { ...instWhere.loan, allocatedTellerId: user.id };
  }

  const instRepayments = await db.institutionLoanRepayment.findMany({
    where: instWhere,
    include: {
      loan: {
        include: {
          institution: {
            select: { 
              institutionName: true, 
              institutionNumber: true,
              user: { include: { branch: { select: { name: true } } } } 
            },
          },
          application: { include: { loanProduct: { select: { name: true } } } },
        },
      },
    },
    orderBy: { repaymentDate: "desc" },
  });

  // Merge and Map
  const allRepayments = [
    ...repayments.map((r) => ({
      id: r.id,
      repaymentDate: r.repaymentDate,
      memberName: r.loan.member.user.name,
      memberNumber: r.loan.member.memberNumber,
      loanProduct: r.loan.loanApplication.loanProduct.name,
      amount: r.amount,
      principalPaid: r.principalPaid,
      interestPaid: r.interestPaid,
      penaltyPaid: r.penaltyPaid,
      channel: r.channel,
      transactionId: r.transactionId,
      collectedBy: r.handler?.name || "N/A",
      branch: r.loan.branch?.name || "N/A",
    })),
    ...instRepayments.map((r) => ({
      id: r.id,
      repaymentDate: r.repaymentDate,
      memberName: r.loan.institution.institutionName,
      memberNumber: r.loan.institution.institutionNumber,
      loanProduct: r.loan.application.loanProduct.name,
      amount: r.amount,
      principalPaid: r.principalPaid || 0,
      interestPaid: r.interestPaid || 0,
      penaltyPaid: (r as any).penaltyPaid || 0,
      channel: r.channel,
      transactionId: (r as any).transactionId || r.mobileMoneyRef || "N/A",
      collectedBy: "SYSTEM",
      branch: r.loan.institution.user.branch?.name || "N/A",
    })),
  ].sort(
    (a: any, b: any) =>
      new Date(b.repaymentDate).getTime() - new Date(a.repaymentDate).getTime(),
  );

  return allRepayments;
}

// ============================================================================
// 8. WRITTEN OFF LOANS
// ============================================================================
export async function getWrittenOffLoansReportService(
  user: any,
  filters?: { branchId?: string; officerId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  const where: any = { status: "WRITTEN_OFF", ...branchFilter };
  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
  }

  const loans = await db.loan.findMany({
    where,
    include: {
      member: { include: { user: { select: { name: true, phone: true } } } },
      loanApplication: { include: { loanProduct: { select: { name: true } } } },
      branch: { select: { name: true } },
      allocatedTeller: { select: { name: true } },
      repayments: { select: { amount: true } },
      writeOffs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const loanData = loans.map((l: any) => {
    const writeOff = l.writeOffs?.[0];
    const totalRepaidAmount = l.repayments.reduce(
      (sum: number, r: any) => sum + (r.amount || 0),
      0,
    );
    return {
      id: l.id,
      memberName: l.member?.user?.name || "N/A",
      memberNumber: l.member?.memberNumber || "N/A",
      phone: l.member?.user?.phone || "N/A",
      loanProduct: l.loanApplication?.loanProduct?.name || "N/A",
      principalAmount: l.amountGranted || 0,
      totalAmountDue: l.totalAmountDue || 0,
      amountPaid: totalRepaidAmount,
      writtenOffAmount: writeOff?.totalBalance || l.outstandingBalance || 0,
      disbursementDate: l.disbursementDate,
      writeOffDate:
        writeOff?.dateWrittenOff || writeOff?.approvedAt || l.updatedAt,
      reason: writeOff?.reason || "Policy write-off",
      loanOfficer: l.allocatedTeller?.name || "N/A",
      branch: l.branch?.name || "N/A",
    };
  });

  return {
    loans: loanData,
    summary: {
      totalLoans: loanData.length,
      totalPrincipal: loanData.reduce((sum, l) => sum + l.principalAmount, 0),
      totalAmountWrittenOff: loanData.reduce(
        (sum, l) => sum + l.writtenOffAmount,
        0,
      ),
    },
  };
}

// ============================================================================
// 9. PAID OFF LOANS
// ============================================================================
export async function getPaidOffLoansReportService(
  user: any,
  filters?: { branchId?: string; officerId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const where: any = { status: "REPAID", ...branchFilter };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
  }

  const loans = await db.loan.findMany({
    where,
    include: {
      member: { include: { user: { select: { name: true, phone: true } } } },
      loanApplication: { include: { loanProduct: { select: { name: true } } } },
      allocatedTeller: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  const paidOffLoans = loans.map((l: any) => {
    const completionDate = l.updatedAt;
    const dueDate = l.dueDate;
    let daysEarlyOrLate = 0;
    if (dueDate && completionDate) {
      const diffMs =
        new Date(dueDate).getTime() - new Date(completionDate).getTime();
      daysEarlyOrLate = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }
    return {
      loanId: l.id,
      memberName: l.member.user.name,
      memberNumber: l.member.memberNumber,
      memberPhone: l.member.user.phone || "N/A",
      loanProduct: l.loanApplication.loanProduct.name,
      principalAmount: l.amountGranted,
      totalRepaid: l.amountPaid,
      completionDate,
      dueDate,
      daysEarlyOrLate,
      loanOfficer: l.allocatedTeller?.name || "N/A",
      branch: l.branch?.name || "N/A",
    };
  });

  return {
    loans: paidOffLoans,
    summary: {
      totalLoans: paidOffLoans.length,
      totalPrincipal: paidOffLoans.reduce(
        (s: number, l: any) => s + l.principalAmount,
        0,
      ),
      totalRepaid: paidOffLoans.reduce(
        (s: number, l: any) => s + l.totalRepaid,
        0,
      ),
      averageDaysToCompletion:
        paidOffLoans.length > 0
          ? paidOffLoans.reduce((s, l) => s + Math.abs(l.daysEarlyOrLate), 0) /
            paidOffLoans.length
          : 0,
    },
  };
}

// ============================================================================
// 10. DETAILED LOAN REPORT
// ============================================================================
export async function getDetailedLoanReportService(user: any, filters?: any) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  
  const [loans, instLoans] = await Promise.all([
    db.loan.findMany({
      where: { ...branchFilter },
      include: {
        member: {
          include: { user: { select: { name: true, email: true, phone: true } } },
        },
        loanApplication: { include: { loanProduct: { select: { name: true } } } },
        branch: { select: { name: true } },
        disbursedByUser: { select: { name: true } },
        repayments: {
          select: { repaymentDate: true },
          orderBy: { repaymentDate: "desc" },
        },
      },
      take: 100,
    }),
    db.institutionLoan.findMany({
      where: {
        ...(branchFilter.branchId ? { institution: { user: { branchId: branchFilter.branchId } } } : {})
      },
      include: {
        institution: {
          include: { user: { select: { name: true, email: true, phone: true, branch: { select: { name: true } } } } },
        },
        application: { include: { loanProduct: { select: { name: true } } } },
        allocatedTeller: { select: { name: true } },
        repayments: {
          select: { repaymentDate: true },
          orderBy: { repaymentDate: "desc" },
        },
      },
      take: 100,
    })
  ]);

  const mapLoan = (l: any, isInst: boolean = false) => {
    const now = new Date();
    const dueDate = l.dueDate ? new Date(l.dueDate) : null;
    const daysPastDue =
      dueDate && now > dueDate
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;
    
    const borrower = isInst ? l.institution : l.member;
    const app = isInst ? l.application : l.loanApplication;

    return {
      loanId: l.id,
      memberName: isInst ? borrower.institutionName : borrower.user.name,
      memberEmail: borrower.user.email || "N/A",
      memberPhone: borrower.user.phone || "N/A",
      loanProduct: app.loanProduct.name,
      amountGranted: l.amountGranted,
      interestRate: l.interestRate,
      totalAmountDue: l.totalAmountDue,
      outstandingBalance: l.outstandingBalance,
      amountPaid: l.amountPaid,
      status: l.status,
      disbursementDate: l.disbursementDate,
      dueDate: l.dueDate,
      disbursedBy: isInst ? (l.allocatedTeller?.name || "N/A") : (l.disbursedByUser?.name || "N/A"),
      branch: isInst ? (borrower.user.branch?.name || "N/A") : (l.branch?.name || "N/A"),
      repaymentCount: l.repayments.length,
      lastRepaymentDate: l.repayments[0]?.repaymentDate || null,
      daysPastDue,
      isInstitution: isInst,
    };
  };

  return [...loans.map(l => mapLoan(l)), ...instLoans.map(l => mapLoan(l, true))];
}

// ============================================================================
// 11. ACTIVE LOANS BY OFFICER
// ============================================================================
export async function getActiveLoansByOfficerService(
  user: any,
  filters?: { branchId?: string; officerId?: string },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const where: any = {
    status: { in: ["DISBURSED", "OVERDUE"] },
    ...branchFilter,
  };
  const instWhere: any = { status: { in: ["DISBURSED", "OVERDUE"] } };

  if (filters?.branchId) {
    instWhere.institution = { user: { branchId: filters.branchId } };
  } else if (user.role !== "ADMIN" && user.branchId) {
    instWhere.institution = { user: { branchId: user.branchId } };
  }

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
    instWhere.allocatedTellerId = allowedOfficerId;
  }

  const [loans, institutionLoans] = await Promise.all([
    db.loan.findMany({
      where,
      include: {
        member: { include: { user: true } },
        branch: true,
        loanApplication: { include: { loanProduct: true } },
        allocatedTeller: true,
      },
      orderBy: { disbursementDate: "desc" },
    }),
    db.institutionLoan.findMany({
      where: instWhere,
      include: {
        institution: { include: { user: { include: { branch: true } } } },
        application: { include: { loanProduct: true } },
        allocatedTeller: true,
      },
      orderBy: { disbursementDate: "desc" },
    }),
  ]);

  const loanData = loans.map((loan: any) => ({
    loanId: loan.id,
    memberName: loan.member.user.name,
    memberNumber: loan.member.memberNumber,
    memberPhone: loan.member.user.phone || "N/A",
    loanProduct: loan.loanApplication.loanProduct.name,
    principalAmount: loan.amountGranted,
    outstandingBalance: loan.outstandingBalance,
    disbursementDate: loan.disbursementDate,
    dueDate: loan.dueDate,
    status: loan.status,
    loanOfficer: loan.allocatedTeller?.name || "N/A",
    branch: loan.branch?.name || "N/A",
    isInstitution: false,
  }));

  const instLoanData = institutionLoans.map((loan: any) => ({
    loanId: loan.id,
    memberName: loan.institution.institutionName,
    memberNumber: loan.institution.institutionNumber,
    memberPhone: loan.institution.user?.phone || "N/A",
    loanProduct: loan.application?.loanProduct?.name || "N/A",
    principalAmount: loan.amountGranted,
    outstandingBalance: loan.outstandingBalance,
    disbursementDate: loan.disbursementDate,
    dueDate: loan.dueDate,
    status: loan.status,
    loanOfficer: loan.allocatedTeller?.name || "N/A",
    branch: loan.institution?.user?.branch?.name || "N/A",
    isInstitution: true,
  }));

  const combinedData = [...loanData, ...instLoanData].sort(
    (a, b) =>
      new Date(b.disbursementDate || 0).getTime() -
      new Date(a.disbursementDate || 0).getTime(),
  );

  return {
    loans: combinedData,
    summary: {
      totalActiveLoans: combinedData.length,
      totalPrincipal: combinedData.reduce(
        (sum, l) => sum + l.principalAmount,
        0,
      ),
      totalOutstanding: combinedData.reduce(
        (sum, l) => sum + l.outstandingBalance,
        0,
      ),
      averageLoanSize:
        combinedData.length > 0
          ? combinedData.reduce((sum, l) => sum + l.principalAmount, 0) /
            combinedData.length
          : 0,
    },
  };
}

// ============================================================================
// 12. DUES VS REPAYMENT
// ============================================================================
// Removed duplicate Import
export async function getLoanDuesVsRepaymentReportService(
  user: any,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    officerId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  const repaymentWhere =
    filters?.endDate
      ? {
          repaymentDate: {
            lte: filters.endDate,
          },
        }
      : {};

  const whereLoans: any = { status: { in: ["DISBURSED", "OVERDUE"] } };
  if (bId) whereLoans.branchId = bId;
  if (allowedOfficerId && allowedOfficerId !== "all") {
    whereLoans.allocatedTellerId = allowedOfficerId;
  }

  const instWhereLoans: any = { status: { in: ["DISBURSED", "OVERDUE"] } };
  if (allowedOfficerId && allowedOfficerId !== "all") {
    instWhereLoans.allocatedTellerId = allowedOfficerId;
  }
  if (bId) {
    instWhereLoans.institution = { user: { branchId: bId } };
  }

  const [loans, institutionLoans] = await Promise.all([
    db.loan.findMany({
      where: whereLoans,
      include: {
        member: {
          include: {
            user: {
              include: {
                branch: true,
              },
            },
          },
        },
        branch: true,
        allocatedTeller: {
          select: { id: true, name: true },
        },
        loanApplication: {
          include: {
            loanProduct: {
              select: { name: true },
            },
          },
        },
        repayments: {
          where: repaymentWhere,
          select: {
            amount: true,
            principalPaid: true,
            interestPaid: true,
            penaltyPaid: true,
            repaymentDate: true,
          },
          orderBy: { repaymentDate: "desc" },
        },
      },
    }),
    db.institutionLoan.findMany({
      where: instWhereLoans,
      include: {
        institution: {
          include: {
            user: {
              include: {
                branch: true,
              },
            },
          },
        },
        allocatedTeller: {
          select: { id: true, name: true },
        },
        application: {
          include: {
            loanProduct: {
              select: { name: true },
            },
          },
        },
        repayments: {
          where: repaymentWhere,
          select: {
            amount: true,
            principalPaid: true,
            interestPaid: true,
            repaymentDate: true,
          },
          orderBy: { repaymentDate: "desc" },
        },
      },
    }),
  ]);

  const reportMap = new Map<string, any>();

  const normalizeProducts = (products: Set<string>) => {
    const values = Array.from(products).filter(Boolean);
    if (values.length <= 2) return values.join(", ");
    return `${values.slice(0, 2).join(", ")} +${values.length - 2} more`;
  };

  const normalizeNames = (values: Set<string>) =>
    Array.from(values).filter(Boolean).join(", ") || "N/A";

  const upsertBorrower = (
    key: string,
    base: {
      borrowerName: string;
      borrowerNumber: string;
      branch: string;
      officer: string;
      subjectType: "MEMBER" | "INSTITUTION";
    },
  ) => {
    if (!reportMap.has(key)) {
      reportMap.set(key, {
        key,
        memberName: base.borrowerName,
        memberNumber: base.borrowerNumber,
        branch: base.branch,
        officer: base.officer,
        subjectType: base.subjectType,
        loanCount: 0,
        totalDisbursed: 0,
        totalLoanObligation: 0,
        principalPaid: 0,
        interestPaid: 0,
        penaltyPaid: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        latestPaymentDate: null,
        latestPaymentAmount: 0,
        latestPaymentPrincipal: 0,
        latestPaymentInterest: 0,
        latestPaymentPenalty: 0,
        productNames: new Set<string>(),
        officerNames: new Set<string>(),
        branchNames: new Set<string>(),
        statuses: new Set<string>(),
      });
    }
    return reportMap.get(key);
  };

  loans.forEach((loan: any) => {
    const key = `MEMBER_${loan.memberId}`;
    const entry = upsertBorrower(key, {
      borrowerName: loan.member.user.name,
      borrowerNumber: loan.member.memberNumber,
      branch: loan.branch?.name || loan.member.user.branch?.name || "N/A",
      officer: loan.allocatedTeller?.name || "N/A",
      subjectType: "MEMBER",
    });

    const repayments = Array.isArray(loan.repayments) ? loan.repayments : [];
    const principalPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.principalPaid || 0),
      0,
    );
    const interestPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.interestPaid || 0),
      0,
    );
    const penaltyPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.penaltyPaid || 0),
      0,
    );
    const totalPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.amount || 0),
      0,
    );

    entry.loanCount += 1;
    entry.totalDisbursed += Number(loan.amountGranted || 0);
    entry.totalLoanObligation += Number(loan.totalAmountDue || 0);
    entry.principalPaid += principalPaid;
    entry.interestPaid += interestPaid;
    entry.penaltyPaid += penaltyPaid;
    entry.totalPaid += totalPaid;
    entry.outstandingBalance += Number(loan.outstandingBalance || 0);
    entry.productNames.add(loan.loanApplication?.loanProduct?.name || "Loan Product");
    entry.officerNames.add(loan.allocatedTeller?.name || "N/A");
    entry.branchNames.add(
      loan.branch?.name || loan.member.user.branch?.name || "N/A",
    );
    entry.statuses.add(loan.status || "DISBURSED");

    const latestRepayment = repayments[0];
    if (
      latestRepayment &&
      (!entry.latestPaymentDate ||
        new Date(latestRepayment.repaymentDate) >
          new Date(entry.latestPaymentDate))
    ) {
      entry.latestPaymentDate = latestRepayment.repaymentDate;
      entry.latestPaymentAmount = Number(latestRepayment.amount || 0);
      entry.latestPaymentPrincipal = Number(latestRepayment.principalPaid || 0);
      entry.latestPaymentInterest = Number(latestRepayment.interestPaid || 0);
      entry.latestPaymentPenalty = Number(latestRepayment.penaltyPaid || 0);
    }
  });

  institutionLoans.forEach((loan: any) => {
    const key = `INSTITUTION_${loan.institutionId}`;
    const entry = upsertBorrower(key, {
      borrowerName: loan.institution.institutionName,
      borrowerNumber: loan.institution.institutionNumber,
      branch: loan.institution.user?.branch?.name || "N/A",
      officer: loan.allocatedTeller?.name || "N/A",
      subjectType: "INSTITUTION",
    });

    const repayments = Array.isArray(loan.repayments) ? loan.repayments : [];
    const principalPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.principalPaid || 0),
      0,
    );
    const interestPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.interestPaid || 0),
      0,
    );
    const penaltyPaid = repayments.reduce(
      (sum: number, repayment: any) =>
        sum + Number((repayment as any).penaltyPaid || 0),
      0,
    );
    const totalPaid = repayments.reduce(
      (sum: number, repayment: any) => sum + Number(repayment.amount || 0),
      0,
    );

    entry.loanCount += 1;
    entry.totalDisbursed += Number(loan.amountGranted || 0);
    entry.totalLoanObligation += Number(loan.totalAmountDue || 0);
    entry.principalPaid += principalPaid;
    entry.interestPaid += interestPaid;
    entry.penaltyPaid += penaltyPaid;
    entry.totalPaid += totalPaid;
    entry.outstandingBalance += Number(loan.outstandingBalance || 0);
    entry.productNames.add(loan.application?.loanProduct?.name || "Loan Product");
    entry.officerNames.add(loan.allocatedTeller?.name || "N/A");
    entry.branchNames.add(loan.institution.user?.branch?.name || "N/A");
    entry.statuses.add(loan.status || "DISBURSED");

    const latestRepayment = repayments[0];
    if (
      latestRepayment &&
      (!entry.latestPaymentDate ||
        new Date(latestRepayment.repaymentDate) >
          new Date(entry.latestPaymentDate))
    ) {
      entry.latestPaymentDate = latestRepayment.repaymentDate;
      entry.latestPaymentAmount = Number(latestRepayment.amount || 0);
      entry.latestPaymentPrincipal = Number(latestRepayment.principalPaid || 0);
      entry.latestPaymentInterest = Number(latestRepayment.interestPaid || 0);
      entry.latestPaymentPenalty = Number((latestRepayment as any).penaltyPaid || 0);
    }
  });

  const records = Array.from(reportMap.values())
    .map((item: any) => ({
      memberName: item.memberName,
      memberNumber: item.memberNumber,
      subjectType: item.subjectType,
      loanProduct: normalizeProducts(item.productNames),
      loanCount: item.loanCount,
      branch: normalizeNames(item.branchNames),
      officer: normalizeNames(item.officerNames),
      status:
        item.outstandingBalance > 0
          ? item.statuses.has("OVERDUE")
            ? "OVERDUE"
            : "ACTIVE"
          : "CLEARED",
      totalDisbursed: item.totalDisbursed,
      totalLoanObligation: item.totalLoanObligation,
      principalPaid: item.principalPaid,
      interestPaid: item.interestPaid,
      penaltyPaid: item.penaltyPaid,
      totalPaid: item.totalPaid,
      outstandingBalance: item.outstandingBalance,
      latestPaymentDate: item.latestPaymentDate,
      latestPaymentAmount: item.latestPaymentAmount,
      latestPaymentPrincipal: item.latestPaymentPrincipal,
      latestPaymentInterest: item.latestPaymentInterest,
      latestPaymentPenalty: item.latestPaymentPenalty,
      collectionRate:
        item.totalLoanObligation > 0
          ? (item.totalPaid / item.totalLoanObligation) * 100
          : item.totalPaid > 0
            ? 100
            : 0,
    }))
    .sort((a: any, b: any) => {
      const aDate = a.latestPaymentDate
        ? new Date(a.latestPaymentDate).getTime()
        : 0;
      const bDate = b.latestPaymentDate
        ? new Date(b.latestPaymentDate).getTime()
        : 0;
      return bDate - aDate || a.memberName.localeCompare(b.memberName);
    });

  const summary = {
    totalDisbursed: records.reduce(
      (sum: number, item: any) => sum + item.totalDisbursed,
      0,
    ),
    totalLoanObligation: records.reduce(
      (sum: number, item: any) => sum + item.totalLoanObligation,
      0,
    ),
    totalPrincipalPaid: records.reduce(
      (sum: number, item: any) => sum + item.principalPaid,
      0,
    ),
    totalInterestPaid: records.reduce(
      (sum: number, item: any) => sum + item.interestPaid,
      0,
    ),
    totalPenaltyPaid: records.reduce(
      (sum: number, item: any) => sum + item.penaltyPaid,
      0,
    ),
    totalPaid: records.reduce(
      (sum: number, item: any) => sum + item.totalPaid,
      0,
    ),
    totalOutstanding: records.reduce(
      (sum: number, item: any) => sum + item.outstandingBalance,
      0,
    ),
    overallCollectionRate:
      records.reduce((sum: number, item: any) => sum + item.totalLoanObligation, 0) >
      0
        ? (records.reduce((sum: number, item: any) => sum + item.totalPaid, 0) /
            records.reduce(
              (sum: number, item: any) => sum + item.totalLoanObligation,
              0,
            )) *
          100
        : 0,
  };

  return { records, summary };
}

// ============================================================================
// 13. REPAYMENT SCHEDULE
// ============================================================================
export async function getRepaymentScheduleReportService(
  user: any,
  filters: { branchId?: string; officerId?: string; loanId?: string } = {},
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );

  const [loans, instLoans] = await Promise.all([
    db.loan.findMany({
      where: {
        ...(filters.loanId
          ? { id: filters.loanId }
          : { status: { in: ["DISBURSED", "OVERDUE", "REPAID"] } }),
        ...branchFilter,
        ...(filters.officerId && filters.officerId !== "all"
          ? { loanApplication: { loanOfficerId: filters.officerId } }
          : {}),
      },
      include: {
        member: { include: { user: true } },
        loanApplication: { include: { loanProduct: true, loanOfficer: true } },
        schedules: { orderBy: { period: "asc" } },
        repayments: {
          select: {
            amount: true,
            repaymentDate: true,
            principalPaid: true,
            interestPaid: true,
            penaltyPaid: true,
          },
          orderBy: { repaymentDate: "asc" },
        },
        branch: true,
      },
    }),
    db.institutionLoan.findMany({
      where: {
        ...(filters.loanId
          ? { id: filters.loanId }
          : { status: { in: ["DISBURSED", "OVERDUE", "REPAID"] } }),
        ...(branchFilter.branchId ? { institution: { user: { branchId: branchFilter.branchId } } } : {}),
        ...(filters.officerId && filters.officerId !== "all"
          ? { allocatedTellerId: filters.officerId }
          : {}),
      },
      include: {
        institution: { include: { user: { include: { branch: true } } } },
        application: { include: { loanProduct: true } },
        allocatedTeller: true,
        schedules: { orderBy: { period: "asc" } },
      },
    }),
  ]);

  const allSchedules: any[] = [];

  loans.forEach((loan: any) => {
    const useFreshSchedule = Boolean(filters.loanId);
    const periodMonths =
      loan.loanApplication.repaymentPeriodMonths ||
      Math.ceil((loan.loanApplication.loanProduct.repaymentPeriodDays || 30) / 30);
    const startDate =
      loan.loanApplication.repaymentStartDate ||
      loan.disbursementDate ||
      new Date();
    const interestPeriod = resolveEffectiveInterestPeriod(
      loan.loanApplication.loanProduct.interestPeriod,
      loan.loanApplication.interestPeriod,
      loan.interestPeriod,
    );
    const scheduleFrequency =
      (loan.loanApplication.modeOfRepayment as ScheduleFrequency) || "MONTHLY";

    const computedSchedules = useFreshSchedule
      ? calculateLoanSchedule({
          amountGranted: loan.amountGranted,
          interestRate: loan.interestRate,
          repaymentPeriodMonths: periodMonths,
          interestType:
            loan.interestType === "REDUCING_BALANCE"
              ? "REDUCING_BALANCE"
              : "FLAT_RATE",
          gracePeriod: loan.gracePeriod || 0,
          disbursementDate: new Date(startDate),
          interestPeriod,
          scheduleFrequency,
          payments: (loan.repayments || []).map((repayment: any) => ({
            amount: repayment.amount,
            paymentDate: repayment.repaymentDate,
            principalPaid: repayment.principalPaid,
            interestPaid: repayment.interestPaid,
            penaltyPaid: repayment.penaltyPaid,
          })),
        }).schedule
      : loan.schedules;

    computedSchedules.forEach((item: any) => {
      allSchedules.push({
        id: item.id || `${loan.id}-${item.period}`,
        loanId: loan.id,
        memberName: loan.member.user.name,
        memberNumber: loan.member.memberNumber,
        loanProduct: loan.loanApplication.loanProduct.name,
        dueDate: item.dueDate,
        installmentNumber: item.period,
        principalDue: item.principalPayment,
        interestDue: item.interestPayment,
        totalDue: item.totalPayment,
        balance: item.remainingBalance,
        status: item.status,
        paidAmount: item.paidAmount || 0,
        loanOfficer: loan.loanApplication.loanOfficer?.name || "N/A",
        branch: loan.branch?.name || "N/A",
        disbursementDate: loan.disbursementDate,
        isInstitution: false,
      });
    });
  });

  instLoans.forEach((loan: any) => {
    loan.schedules.forEach((item: any) => {
      allSchedules.push({
        id: item.id,
        loanId: loan.id,
        memberName: loan.institution.institutionName,
        memberNumber: loan.institution.institutionNumber,
        loanProduct: loan.application.loanProduct.name,
        dueDate: item.dueDate,
        installmentNumber: item.period,
        principalDue: item.principalPayment,
        interestDue: item.interestPayment,
        totalDue: item.totalPayment,
        balance: item.remainingBalance,
        status: item.status,
        paidAmount: item.paidAmount,
        loanOfficer: loan.allocatedTeller?.name || "N/A",
        branch: loan.institution.user?.branch?.name || "N/A",
        disbursementDate: loan.disbursementDate,
        isInstitution: true,
      });
    });
  });

  const summary = {
    totalScheduledPayments: allSchedules.length,
    totalPrincipalDue: allSchedules.reduce(
      (sum: number, s: any) => sum + s.principalDue,
      0,
    ),
    totalInterestDue: allSchedules.reduce(
      (sum: number, s: any) => sum + s.interestDue,
      0,
    ),
    totalDue: allSchedules.reduce((sum: number, s: any) => sum + s.totalDue, 0),
    totalPaid: allSchedules.reduce(
      (sum: number, s: any) => sum + (s.paidAmount || 0),
      0,
    ),
    totalBalance: allSchedules.reduce(
      (sum: number, s: any) => sum + Math.max((s.totalDue || 0) - (s.paidAmount || 0), 0),
      0,
    ),
  };

  const result: any = {
    schedules: allSchedules.sort(
      (a: any, b: any) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    ),
    summary,
  };

  if (filters.loanId) {
    const loan = loans[0] || instLoans[0];
    if (loan) {
      result.loanDetails = {
        id: (loan as any).id,
        memberName: (loan as any).member?.user?.name || (loan as any).institution?.institutionName || "N/A",
        memberNumber: (loan as any).member?.memberNumber || (loan as any).institution?.institutionNumber || "N/A",
        loanProduct: (loan as any).loanApplication?.loanProduct?.name || (loan as any).application?.loanProduct?.name || "N/A",
        disbursementDate: (loan as any).disbursementDate,
        loanOfficer: (loan as any).loanApplication?.loanOfficer?.name || (loan as any).allocatedTeller?.name || "N/A",
        branch: (loan as any).branch?.name || (loan as any).institution?.user?.branch?.name || "N/A",
      };
    }
  }

  return result;
}

// ============================================================================
// 14. LOAN LEDGER CARDS
// ============================================================================
export async function getLoanLedgerCardsReportService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
    memberId?: string;
    institutionId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const whereClause: any = {
    status: { in: ["DISBURSED", "OVERDUE"] },
    ...branchFilter,
  };

  if (filters?.officerId && filters.officerId !== "all")
    whereClause.allocatedTellerId = filters.officerId;
  if (filters?.memberId && filters.memberId !== "all")
    whereClause.memberId = filters.memberId;

  const individualLoans = await db.loan.findMany({
    where: whereClause,
    include: {
      member: { include: { user: true } },
      branch: true,
      loanApplication: { include: { loanProduct: true } },
      allocatedTeller: true,
      ledgerTransactions: { orderBy: { transactionDate: "asc" } },
      schedules: { orderBy: { period: "asc" } },
    },
    orderBy: { disbursementDate: "desc" },
  });

  const instWhereClause: any = { status: { in: ["DISBURSED", "OVERDUE"] } };
  if (branchFilter.branchId)
    instWhereClause.institution = { user: { branchId: branchFilter.branchId } };
  if (filters?.officerId && filters.officerId !== "all")
    instWhereClause.allocatedTellerId = filters.officerId;
  if (filters?.institutionId && filters.institutionId !== "all")
    instWhereClause.institutionId = filters.institutionId;

  const institutionLoans = await db.institutionLoan.findMany({
    where: instWhereClause,
    include: {
      institution: { include: { user: { include: { branch: true } } } },
      application: { include: { loanProduct: true } },
      allocatedTeller: true,
    },
    orderBy: { disbursementDate: "desc" },
  });

  const transactions: any[] = [];
  let totalDebits = 0;
  let totalCredits = 0;
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalPenaltyPaid = 0;

  individualLoans.forEach((loan: any) => {
    const memberName = loan.member.user.name;
    const memberNumber = loan.member.memberNumber;
    const loanOfficer = loan.allocatedTeller?.name || "N/A";
    const branch = loan.branch?.name || "N/A";

    loan.ledgerTransactions.forEach((tx: any) => {
      const type = tx.transactionType;
      const creditPenalty = tx.creditPenalty || 0;
      if (type === "REPAYMENT") {
        totalCredits += tx.creditPrincipal + tx.creditInterest + creditPenalty;
        totalPrincipalPaid += tx.creditPrincipal || 0;
        totalInterestPaid += tx.creditInterest || 0;
        totalPenaltyPaid += creditPenalty;
      }
      if (type === "DISBURSEMENT")
        totalDebits += tx.debitPrincipal + tx.debitInterest;

      transactions.push({
        transactionDate: tx.transactionDate,
        transactionType: type,
        memberName,
        memberNumber,
        loanId: loan.id,
        debitPrincipal: tx.debitPrincipal,
        debitInterest: tx.debitInterest,
        creditPrincipal: tx.creditPrincipal,
        creditInterest: tx.creditInterest,
        creditPenalty,
        totalDebit: tx.debitPrincipal + tx.debitInterest,
        totalCredit: tx.creditPrincipal + tx.creditInterest + creditPenalty,
        balanceTotal: tx.balanceTotal,
        loanOfficer,
        branch,
      });
    });
  });

  // Fetch Institution Transactions separately (assuming existence of InstitutionLoanLedgerTransaction)
  for (const loan of institutionLoans) {
    const memberName = loan.institution.institutionName;
    const memberNumber = loan.institution.institutionNumber;
    const loanOfficer = loan.allocatedTeller?.name || "N/A";
    const branch = loan.institution.user?.branch?.name || "N/A";

    const ledgerTx = await db.institutionLoanLedgerTransaction.findMany({
      where: { loanId: loan.id },
      orderBy: { transactionDate: "asc" },
    });

    ledgerTx.forEach((tx: any) => {
      const type = tx.transactionType;
      const creditPenalty = tx.creditPenalty || 0;
      if (type === "REPAYMENT") {
        totalCredits += tx.creditPrincipal + tx.creditInterest + creditPenalty;
        totalPrincipalPaid += tx.creditPrincipal || 0;
        totalInterestPaid += tx.creditInterest || 0;
        totalPenaltyPaid += creditPenalty;
      }
      if (type === "DISBURSEMENT")
        totalDebits += tx.debitPrincipal + tx.debitInterest;

      transactions.push({
        transactionDate: tx.transactionDate,
        transactionType: type,
        memberName,
        memberNumber,
        loanId: loan.id,
        debitPrincipal: tx.debitPrincipal,
        debitInterest: tx.debitInterest,
        creditPrincipal: tx.creditPrincipal,
        creditInterest: tx.creditInterest,
        creditPenalty,
        totalDebit: tx.debitPrincipal + tx.debitInterest,
        totalCredit: tx.creditPrincipal + tx.creditInterest + creditPenalty,
        balanceTotal: tx.balanceTotal,
        loanOfficer,
        branch,
      });
    });
  }

  const summary = {
    totalTransactions: transactions.length,
    totalDebits,
    totalCredits,
    totalPrincipalPaid,
    totalInterestPaid,
    totalPenaltyPaid,
    totalLoans: individualLoans.length + institutionLoans.length,
  };

  return {
    transactions: transactions.sort(
      (a: any, b: any) =>
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime(),
    ),
    summary,
  };
}

export async function getLoanLedgerSearchResultsService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
    memberId?: string;
    institutionId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }

  const whereClause: any = {
    status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
    ...branchFilter,
  };
  if (filters?.memberId && filters.memberId !== "all") {
    whereClause.memberId = filters.memberId;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    whereClause.allocatedTellerId = allowedOfficerId;
  }

  const instWhereClause: any = {
    status: { in: ["DISBURSED", "OVERDUE", "REPAID"] },
  };
  if (filters?.institutionId && filters.institutionId !== "all") {
    instWhereClause.institutionId = filters.institutionId;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    instWhereClause.allocatedTellerId = allowedOfficerId;
  }
  if (branchFilter.branchId) {
    instWhereClause.institution = { user: { branchId: branchFilter.branchId } };
  }

  const [individualLoans, institutionLoans] = await Promise.all([
    db.loan.findMany({
      where: whereClause,
      include: {
        member: { include: { user: true } },
        branch: true,
        loanApplication: { include: { loanProduct: true } },
        allocatedTeller: true,
      },
      orderBy: { disbursementDate: "desc" },
    }),
    db.institutionLoan.findMany({
      where: instWhereClause,
      include: {
        institution: { include: { user: { include: { branch: true } } } },
        application: { include: { loanProduct: true } },
        allocatedTeller: true,
      },
      orderBy: { disbursementDate: "desc" },
    }),
  ]);

  const results = [
    ...individualLoans.map((loan: any) => ({
      id: loan.id,
      subjectType: "MEMBER",
      memberName: loan.member.user.name,
      memberNumber: loan.member.memberNumber,
      loanProduct: loan.loanApplication?.loanProduct?.name || "Loan Product",
      principalAmount: loan.amountGranted || 0,
      interestAmount:
        loan.interestAmount ||
        Math.max((loan.totalAmountDue || 0) - (loan.amountGranted || 0), 0),
      totalAmountDue: loan.totalAmountDue || 0,
      loanOfficer: loan.allocatedTeller?.name || "N/A",
      branch: loan.branch?.name || "N/A",
      status: loan.status,
      disbursementDate: loan.disbursementDate,
      outstandingBalance: loan.outstandingBalance || 0,
      amountPaid: loan.amountPaid || 0,
    })),
    ...institutionLoans.map((loan: any) => ({
      id: loan.id,
      subjectType: "INSTITUTION",
      memberName: loan.institution.institutionName,
      memberNumber: loan.institution.institutionNumber,
      loanProduct: loan.application?.loanProduct?.name || "Loan Product",
      principalAmount: loan.amountGranted || 0,
      interestAmount: Math.max(
        (loan.totalAmountDue || 0) - (loan.amountGranted || 0),
        0,
      ),
      totalAmountDue: loan.totalAmountDue || 0,
      loanOfficer: loan.allocatedTeller?.name || "N/A",
      branch: loan.institution.user?.branch?.name || "N/A",
      status: loan.status,
      disbursementDate: loan.disbursementDate,
      outstandingBalance: loan.outstandingBalance || 0,
      amountPaid: loan.amountPaid || 0,
    })),
  ].sort(
    (a, b) =>
      new Date(b.disbursementDate || 0).getTime() -
      new Date(a.disbursementDate || 0).getTime(),
  );

  return {
    results,
    summary: {
      totalLoans: results.length,
    },
  };
}

// ============================================================================
// 17. LOAN AGE ANALYSIS
// ============================================================================
export async function getLoanAgeAnalysisService(
  user: any,
  filters: { startDate?: Date; endDate?: Date; branchId?: string } = {},
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );

  const where: any = {
    status: { in: ["DISBURSED", "OVERDUE"] },
    ...branchFilter,
  };

  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    where.allocatedTellerId = user.id;
  }

  const loans = await db.loan.findMany({
    where,
    select: {
      amountGranted: true,
      outstandingBalance: true,
      disbursementDate: true,
    },
  });

  const now = new Date();
  const ageAnalysis: Record<
    string,
    {
      range: string;
      count: number;
      totalAmount: number;
      outstandingAmount: number;
    }
  > = {
    "0-3 Months": {
      range: "0-3 Months",
      count: 0,
      totalAmount: 0,
      outstandingAmount: 0,
    },
    "3-6 Months": {
      range: "3-6 Months",
      count: 0,
      totalAmount: 0,
      outstandingAmount: 0,
    },
    "6-12 Months": {
      range: "6-12 Months",
      count: 0,
      totalAmount: 0,
      outstandingAmount: 0,
    },
    "12+ Months": {
      range: "12+ Months",
      count: 0,
      totalAmount: 0,
      outstandingAmount: 0,
    },
  };

  loans.forEach((loan) => {
    if (!loan.disbursementDate) return;
    const ageMonths =
      (now.getTime() - new Date(loan.disbursementDate).getTime()) /
      (1000 * 60 * 60 * 24 * 30);

    let range = "12+ Months";
    if (ageMonths <= 3) range = "0-3 Months";
    else if (ageMonths <= 6) range = "3-6 Months";
    else if (ageMonths <= 12) range = "6-12 Months";

    ageAnalysis[range].count++;
    ageAnalysis[range].totalAmount += loan.amountGranted;
    ageAnalysis[range].outstandingAmount += loan.outstandingBalance;
  });

  return Object.values(ageAnalysis);
}

// ============================================================================
// 18. REPAYMENT CHANNEL STATS
// ============================================================================
export async function getRepaymentChannelStatsService(
  user: any,
  filters: { startDate?: Date; endDate?: Date; branchId?: string } = {},
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters.branchId,
  );

  const where: any = {};
  if (filters.startDate) where.repaymentDate = { gte: filters.startDate };
  if (filters.endDate)
    where.repaymentDate = {
      ...(where.repaymentDate || {}),
      lte: filters.endDate,
    };
  if (branchFilter.branchId) where.loan = { branchId: branchFilter.branchId };

  // For loan officers/tellers, filter by allocated teller
  if (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) {
    where.loan = { ...(where.loan || {}), allocatedTellerId: user.id };
  }

  const repayments = await db.loanRepayment.findMany({
    where,
    select: {
      amount: true,
      channel: true,
    },
  });

  const channelMap: Record<string, { count: number; amount: number }> = {};
  let totalAmount = 0;

  repayments.forEach((r) => {
    const channel = r.channel || "UNKNOWN";
    if (!channelMap[channel]) {
      channelMap[channel] = { count: 0, amount: 0 };
    }
    channelMap[channel].count++;
    channelMap[channel].amount += r.amount;
    totalAmount += r.amount;
  });

  return Object.entries(channelMap).map(([channel, stats]) => ({
    channel,
    count: stats.count,
    amount: stats.amount,
    percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
  }));
}

// ============================================================================
// 19. LOAN DISBURSEMENT REPORT
// ============================================================================
export async function getLoanDisbursementReportService(
  user: any,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    officerId?: string;
    loanProductId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const where: any = {
    status: { in: ["DISBURSED", "OVERDUE", "REPAID", "WRITTEN_OFF"] },
    ...branchFilter,
  };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
  }

  if (filters?.startDate) where.disbursementDate = { gte: filters.startDate };
  if (filters?.endDate)
    where.disbursementDate = {
      ...(where.disbursementDate || {}),
      lte: filters.endDate,
    };

  // Individual Loans
  const indWhere = { ...where };
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    indWhere.loanApplication = { loanProductId: filters.loanProductId };
  }

  const loans = await db.loan.findMany({
    where: indWhere,
    include: {
      member: {
        include: {
          user: { select: { name: true } },
          accounts: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { accountNumber: true },
          },
        },
      },
      loanApplication: {
        include: {
          loanProduct: { select: { name: true, repaymentPeriodDays: true } },
        },
      },
      disbursedByUser: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { disbursementDate: "desc" },
  });

  // Institutional Loans — remove branchId (InstitutionLoan has no branchId field)
  const instWhere = { ...where };
  delete instWhere.branchId;
  if (branchFilter.branchId)
    instWhere.institution = { user: { branchId: branchFilter.branchId } };
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    instWhere.application = { loanProduct: { id: filters.loanProductId } };
  }

  const institutionLoans = await db.institutionLoan.findMany({
    where: instWhere,
    include: {
      institution: {
        include: {
          user: { select: { name: true, branch: { select: { name: true } } } },
        },
      },
      application: {
        include: {
          loanProduct: { select: { name: true, repaymentPeriodDays: true } },
        },
      },
      allocatedTeller: { select: { name: true } },
    },
    orderBy: { disbursementDate: "desc" },
  });

  // Merge and Map
  const disbursements = [
    ...loans.map((l: any) => ({
      loanId: l.id,
      memberName: l.member.user.name,
      memberNumber: l.member.memberNumber,
      loanProduct: l.loanApplication.loanProduct.name,
      amountDisbursed: l.amountGranted,
      totalLoanInterest: l.interestAmount || 0,
      totalAmountDue: l.totalAmountDue,
      disbursementDate: l.disbursementDate,
      disbursedBy: l.disbursedByUser?.name || "N/A",
      branch: l.branch?.name || "N/A",
      disbursementMethod: l.disbursementMethod || "CASH",
      accountCredited: l.member.accounts[0]?.accountNumber || "N/A",
      repaymentPeriodDays: l.loanApplication.repaymentPeriodMonths
        ? l.loanApplication.repaymentPeriodMonths * 30
        : l.loanApplication.loanProduct.repaymentPeriodDays,
    })),
    ...institutionLoans.map((l: any) => ({
      loanId: l.id,
      memberName: l.institution?.institutionName || "N/A",
      memberNumber: l.institution?.institutionNumber || "N/A",
      loanProduct: l.application?.loanProduct?.name || "N/A",
      amountDisbursed: l.amountGranted || 0,
      totalLoanInterest: l.totalAmountDue - l.amountGranted || 0,
      totalAmountDue: l.totalAmountDue || 0,
      disbursementDate: l.disbursementDate,
      disbursedBy: l.allocatedTeller?.name || "N/A",
      branch: l.institution?.user?.branch?.name || "N/A",
      disbursementMethod: l.disbursementMethod || "CASH",
      accountCredited: "N/A",
      repaymentPeriodDays: l.application?.repaymentPeriodMonths
        ? l.application.repaymentPeriodMonths * 30
        : l.application?.loanProduct?.repaymentPeriodDays || 30,
    })),
  ].sort((a: any, b: any) => {
    const dateA = a.disbursementDate
      ? new Date(a.disbursementDate).getTime()
      : 0;
    const dateB = b.disbursementDate
      ? new Date(b.disbursementDate).getTime()
      : 0;
    return dateB - dateA;
  });

  const totalAmount = disbursements.reduce(
    (sum: number, d: any) => sum + d.amountDisbursed,
    0,
  );

  const byProduct = Object.entries(
    disbursements.reduce((acc: any, d: any) => {
      if (!acc[d.loanProduct]) acc[d.loanProduct] = { count: 0, amount: 0 };
      acc[d.loanProduct].count++;
      acc[d.loanProduct].amount += d.amountDisbursed;
      return acc;
    }, {}),
  ).map(([product, data]: [string, any]) => ({ product, ...data }));

  const byBranch = Object.entries(
    disbursements.reduce((acc: any, d: any) => {
      if (!acc[d.branch]) acc[d.branch] = { count: 0, amount: 0 };
      acc[d.branch].count++;
      acc[d.branch].amount += d.amountDisbursed;
      return acc;
    }, {}),
  ).map(([branch, data]: [string, any]) => ({ branch, ...data }));

  const byMethod = Object.entries(
    disbursements.reduce((acc: any, d: any) => {
      if (!acc[d.disbursementMethod])
        acc[d.disbursementMethod] = { count: 0, amount: 0 };
      acc[d.disbursementMethod].count++;
      acc[d.disbursementMethod].amount += d.amountDisbursed;
      return acc;
    }, {}),
  ).map(([method, data]: [string, any]) => ({ method, ...data }));

  return {
    disbursements,
    summary: {
      totalDisbursements: disbursements.length,
      totalAmount,
      byProduct,
      byBranch,
      byMethod,
    },
  };
}

// ============================================================================
// 20. APPLICATION APPROVAL/REJECTION REPORT
// ============================================================================
export async function getApplicationApprovalRejectionReportService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
    loanProductId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const where: any = {};

  if (filters?.startDate || filters?.endDate) {
    where.applicationDate = {};
    if (filters?.startDate) where.applicationDate.gte = filters.startDate;
    if (filters?.endDate) where.applicationDate.lte = filters.endDate;
  }
  if (filters?.status && filters.status !== "all")
    where.status = filters.status;
  if (filters?.officerId && filters.officerId !== "all")
    where.allocatedTellerId = filters.officerId;

  // Individual Applications
  const indWhere = { ...where };
  if (branchFilter.branchId)
    indWhere.member = { user: { branchId: branchFilter.branchId } };
  if (filters?.loanProductId && filters.loanProductId !== "all")
    indWhere.loanProductId = filters.loanProductId;

  const applications = await db.loanApplication.findMany({
    where: indWhere,
    include: {
      member: { include: { user: true } },
      loanProduct: true,
      allocatedTeller: true,
      approver: true,
      loan: { include: { branch: true } },
    },
    orderBy: { applicationDate: "desc" },
  });

  // Institutional Applications
  const instWhere = { ...where };
  if (branchFilter.branchId)
    instWhere.institution = { user: { branchId: branchFilter.branchId } };
  if (filters?.loanProductId && filters.loanProductId !== "all")
    instWhere.loanProductId = filters.loanProductId;

  const instApplications = await db.institutionLoanApplication.findMany({
    where: instWhere,
    include: {
      institution: { include: { user: { include: { branch: true } } } },
      loanProduct: true,
      allocatedTeller: true,
      institutionLoan: true,
    },
    orderBy: { applicationDate: "desc" },
  });

  // Merge and Map
  const allApplications = [
    ...applications.map((app: any) => ({
      applicationId: app.id,
      memberNumber: app.member.memberNumber,
      memberName: app.member.user.name,
      loanProduct: app.loanProduct.name,
      amountApplied: app.amountApplied,
      approvedAmount: app.approvedAmount,
      applicationDate: app.applicationDate.toISOString(),
      status: app.status,
      rejectionReason: app.rejectionReason,
      approver: app.approver?.name || "N/A",
      loanStatus: app.loan?.status || "N/A",
      loanOfficer: app.allocatedTeller?.name || "N/A",
      branch: app.loan?.branch?.name || app.member.user?.branch?.name || "N/A",
    })),
    ...instApplications.map((app: any) => ({
      applicationId: app.id,
      memberNumber: app.institution.institutionNumber,
      memberName: app.institution.institutionName,
      loanProduct: app.loanProduct.name,
      amountApplied: app.amountApplied,
      approvedAmount: app.approvedAmount || app.amountApplied,
      applicationDate: app.applicationDate.toISOString(),
      status: app.status,
      rejectionReason: app.rejectionReason,
      approver: app.approver?.name || "N/A",
      loanStatus: app.institutionLoan?.status || "N/A",
      loanOfficer: app.allocatedTeller?.name || "N/A",
      branch: app.institution.user?.branch?.name || "N/A",
    })),
  ].sort(
    (a: any, b: any) =>
      new Date(b.applicationDate).getTime() -
      new Date(a.applicationDate).getTime(),
  );

  const pending = allApplications.filter(
    (a: any) => a.status === "PENDING" || a.status === "UNDER_REVIEW",
  );
  const approved = allApplications.filter(
    (a: any) => a.status === "APPROVED" || a.status === "DISBURSED",
  );
  const rejected = allApplications.filter((a: any) => a.status === "REJECTED");

  return {
    applications: allApplications,
    summary: {
      totalApplications: allApplications.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      approvalRate:
        allApplications.length > 0
          ? (approved.length / allApplications.length) * 100
          : 0,
      rejectionRate:
        allApplications.length > 0
          ? (rejected.length / allApplications.length) * 100
          : 0,
      totalAmountApplied: allApplications.reduce(
        (sum: number, a: any) => sum + a.amountApplied,
        0,
      ),
      totalAmountApproved: approved.reduce(
        (sum: number, a: any) => sum + (a.approvedAmount || a.amountApplied),
        0,
      ),
    },
  };
}

// ============================================================================
// 21. PORTFOLIO CONCENTRATION REPORT
// ============================================================================
export async function getPortfolioConcentrationReportService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
    loanProductId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const where: any = {
    status: { in: ["DISBURSED", "OVERDUE"] },
    ...branchFilter,
  };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    where.allocatedTellerId = allowedOfficerId;
  }

  // Individual Loans
  const indWhere = { ...where };
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    indWhere.loanApplication = { loanProductId: filters.loanProductId };
  }

  const indLoans = await db.loan.findMany({
    where: indWhere,
    include: {
      loanApplication: { include: { loanProduct: true } },
      branch: true,
      allocatedTeller: true,
      member: { include: { user: true } },
    },
  });

  // Institutional Loans — remove branchId (InstitutionLoan has no branchId field)
  const instWhere: any = { ...where };
  delete instWhere.branchId;
  if (branchFilter.branchId)
    instWhere.institution = { user: { branchId: branchFilter.branchId } };
  if (filters?.loanProductId && filters.loanProductId !== "all") {
    instWhere.application = { loanProduct: { id: filters.loanProductId } };
  }

  const instLoans = await db.institutionLoan.findMany({
    where: instWhere,
    include: {
      application: { include: { loanProduct: true } },
      allocatedTeller: true,
      institution: { include: { user: { include: { branch: true } } } },
    },
  });

  // Merge logic
  const allActiveLoans = [
    ...indLoans.map((l: any) => ({
      id: l.id,
      outstandingBalance: l.outstandingBalance || 0,
      amountGranted: l.amountGranted || 0,
      productName: l.loanApplication?.loanProduct?.name || "N/A",
      branchName: l.branch?.name || "N/A",
      officer: l.allocatedTeller,
      ownerName: l.member?.user?.name || "N/A",
      ownerNumber: l.member?.memberNumber || "N/A",
      ownerId: l.memberId,
      type: "INDIVIDUAL",
    })),
    ...instLoans.map((l: any) => ({
      id: l.id,
      outstandingBalance: l.outstandingBalance || 0,
      amountGranted: l.amountGranted || 0,
      productName: l.application?.loanProduct?.name || "N/A",
      branchName: l.institution?.user?.branch?.name || "N/A",
      officer: l.allocatedTeller,
      ownerName: l.institution?.institutionName || "N/A",
      ownerNumber: l.institution?.institutionNumber || "N/A",
      ownerId: l.institutionId,
      type: "INSTITUTION",
    })),
  ];

  const totalPortfolio = allActiveLoans.reduce(
    (sum: number, loan: any) => sum + loan.outstandingBalance,
    0,
  );

  // By Product
  const productStats = allActiveLoans.reduce((acc: any, loan: any) => {
    const product = loan.productName;
    if (!acc[product])
      acc[product] = { count: 0, amount: 0, totalDisbursed: 0 };
    acc[product].count++;
    acc[product].amount += loan.outstandingBalance;
    acc[product].totalDisbursed += loan.amountGranted;
    return acc;
  }, {});

  const byProduct = Object.entries(productStats).map(
    ([product, data]: [string, any]) => ({
      product,
      count: data.count,
      amount: data.amount,
      totalLoanSize: data.totalDisbursed,
      averageLoanSize: data.count > 0 ? data.totalDisbursed / data.count : 0,
      percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
    }),
  );

  // By Branch
  const branchStats = allActiveLoans.reduce((acc: any, loan: any) => {
    const branch = loan.branchName;
    if (!acc[branch]) acc[branch] = { count: 0, amount: 0 };
    acc[branch].count++;
    acc[branch].amount += loan.outstandingBalance;
    return acc;
  }, {});

  const byBranch = Object.entries(branchStats).map(
    ([branch, data]: [string, any]) => ({
      branch,
      count: data.count,
      amount: data.amount,
      percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
    }),
  );

  // Top Borrowers
  const borrowerStats = allActiveLoans.reduce((acc: any, loan: any) => {
    const key = `${loan.type}-${loan.ownerId}`;
    if (!acc[key]) {
      acc[key] = {
        ownerId: loan.ownerId,
        memberName: loan.ownerName,
        memberNumber: loan.ownerNumber,
        count: 0,
        amount: 0,
      };
    }
    acc[key].count++;
    acc[key].amount += loan.outstandingBalance;
    return acc;
  }, {});

  const byBorrower = Object.values(borrowerStats)
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 20)
    .map((data: any) => ({
      ...data,
      percentage: totalPortfolio > 0 ? (data.amount / totalPortfolio) * 100 : 0,
    }));

  return {
    totalPortfolio,
    totalLoans: allActiveLoans.length,
    concentrations: byProduct.map((p) => ({
      category: p.product,
      numberOfLoans: p.count,
      totalAmount: p.amount,
      outstandingBalance: p.amount,
      percentageOfPortfolio: p.percentage,
      averageLoanSize: p.averageLoanSize,
    })),
    byBranch,
    topBorrowers: byBorrower,
    filterOptions: {
      officers: Object.values(
        allActiveLoans.reduce((acc: any, l: any) => {
          if (l.officer) {
            acc[l.officer.id] = { id: l.officer.id, name: l.officer.name };
          }
          return acc;
        }, {}),
      ),
    },
  };
}

// ============================================================================
// 22. LOAN OFFICER ANALYSIS REPORT
// ============================================================================
export async function getLoanOfficerAnalysisReportService(
  user: any,
  filters?: {
    branchId?: string;
    officerId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const whereClause: any = {
    role: { in: ["TELLER", "LOANOFFICER"] },
    isActive: true,
    ...branchFilter,
  };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === "LOANOFFICER" || user.role === "TELLER") &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    whereClause.id = allowedOfficerId;
  }

  const officers = await db.user.findMany({
    where: whereClause,
    include: {
      allocatedLoans: { include: { repayments: true } },
      institutionLoansAllocated: { include: { repayments: true } },
      loanOfficerApplications: true,
      institutionLoanOfficerApplications: true,
      branch: true,
    },
  });

  const officersData = officers.map((officer: any) => {
    // Individual metrics
    const indLoans = officer.allocatedLoans || [];
    const indDisbursed = indLoans.reduce(
      (sum: number, l: any) => sum + l.amountGranted,
      0,
    );
    const indOutstanding = indLoans.reduce(
      (sum: number, l: any) => sum + l.outstandingBalance,
      0,
    );
    const indRepaid = indLoans.reduce(
      (sum: number, l: any) =>
        sum + l.repayments.reduce((rSum: number, r: any) => rSum + r.amount, 0),
      0,
    );
    const indApplications = officer.loanOfficerApplications || [];

    // Institutional metrics
    const instLoans = officer.institutionLoansAllocated || [];
    const instDisbursed = instLoans.reduce(
      (sum: number, l: any) => sum + l.amountGranted,
      0,
    );
    const instOutstanding = instLoans.reduce(
      (sum: number, l: any) => sum + l.outstandingBalance,
      0,
    );
    const instRepaid = instLoans.reduce(
      (sum: number, l: any) =>
        sum + l.repayments.reduce((rSum: number, r: any) => rSum + r.amount, 0),
      0,
    );
    const instApplications = officer.institutionLoanOfficerApplications || [];

    // Combined metrics
    const totalLoans = indLoans.length + instLoans.length;
    const totalDisbursed = indDisbursed + instDisbursed;
    const totalOutstanding = indOutstanding + instOutstanding;
    const totalRepaid = indRepaid + instRepaid;
    const totalApplications = indApplications.length + instApplications.length;

    const overdueLoans =
      indLoans.filter((l: any) => l.status === "OVERDUE").length +
      instLoans.filter((l: any) => l.status === "OVERDUE").length;
    const activeLoans =
      indLoans.filter((l: any) => l.status === "DISBURSED").length +
      instLoans.filter((l: any) => l.status === "DISBURSED").length;
    const repaidLoans =
      indLoans.filter((l: any) => l.status === "REPAID").length +
      instLoans.filter((l: any) => l.status === "REPAID").length;

    const approvedApplications = [
      ...indApplications.filter(
        (a: any) => a.status === "APPROVED" || a.status === "DISBURSED",
      ),
      ...instApplications.filter(
        (a: any) => a.status === "APPROVED" || a.status === "DISBURSED",
      ),
    ].length;

    return {
      officerId: officer.id,
      officerName: officer.name,
      email: officer.email,
      role: officer.role,
      branch: officer.branch?.name || "N/A",
      totalLoansManaged: totalLoans,
      activeLoans,
      overdueLoans,
      totalDisbursed,
      totalOutstanding,
      totalRepaid,
      repaidLoans,
      repaymentRate: totalDisbursed > 0 ? totalRepaid / totalDisbursed : 0,
      defaultRate: totalLoans > 0 ? overdueLoans / totalLoans : 0,
      portfolioAtRisk:
        totalOutstanding > 0
          ? [
              ...indLoans.filter((l: any) => l.status === "OVERDUE"),
              ...instLoans.filter((l: any) => l.status === "OVERDUE"),
            ].reduce((sum: number, l: any) => sum + l.outstandingBalance, 0) /
            totalOutstanding
          : 0,
      totalApplications,
      applicationsApproved: approvedApplications,
    };
  });

  const summary = {
    totalOfficers: officersData.length,
    totalLoans: officersData.reduce(
      (sum: number, o: any) => sum + o.totalLoansManaged,
      0,
    ),
    totalDisbursed: officersData.reduce(
      (sum: number, o: any) => sum + o.totalDisbursed,
      0,
    ),
    totalOutstanding: officersData.reduce(
      (sum: number, o: any) => sum + o.totalOutstanding,
      0,
    ),
    averageRepaymentRate:
      officersData.length > 0
        ? officersData.reduce(
            (sum: number, o: any) => sum + o.repaymentRate,
            0,
          ) / officersData.length
        : 0,
  };

  return { officers: officersData, summary };
}

// ============================================================================
// 23. PORTFOLIO AT RISK SUMMARY
// ============================================================================
export async function getPortfolioAtRiskService(user: any, filters?: any) {
  const result = await getLoanPortfolioReportService(user, filters);
  return result.summary;
}

// ============================================================================
// 24. LOAN LEDGER CARD SERVICE
// ============================================================================
export async function getLoanLedgerCardService(user: any, loanId: string) {
  try {
    // 1. Try Individual Loan
    let loan = await db.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { include: { user: true } },
        branch: true,
        loanApplication: { include: { loanProduct: true } },
        allocatedTeller: true,
        ledgerTransactions: { orderBy: { transactionDate: "asc" } },
        repayments: { orderBy: { repaymentDate: "asc" } },
        schedules: { orderBy: { period: "asc" } },
      },
    });

    let memberName = "";
    let memberNumber = "";
    let loanOfficer = "";
    let branch = "N/A";
    let loanProduct = "";
    let principalAmount = 0;
    let interestAmount = 0;
    let disbursementDate: Date | null = null;
    let status = "";
    let ledgerTransactions: any[] = [];
    let schedules: any[] = [];
    let repayments: any[] = [];

    if (loan) {
      memberName = loan.member.user.name;
      memberNumber = loan.member.memberNumber;
      loanOfficer = loan.allocatedTeller?.name || "N/A";
      branch = loan.branch?.name || "N/A";
      loanProduct = loan.loanApplication.loanProduct.name;
      principalAmount = loan.amountGranted;
      disbursementDate = loan.disbursementDate;
      status = loan.status;
      ledgerTransactions = loan.ledgerTransactions;
      schedules = loan.schedules;
      repayments = loan.repayments;
      interestAmount =
        loan.interestAmount ||
        schedules.reduce(
          (sum: number, s: any) => sum + (s.interestPayment || 0),
          0,
        );
    } else {
      // 2. Try Institution Loan
      const instLoan = await db.institutionLoan.findUnique({
        where: { id: loanId },
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true, loanOfficer: true } },
          allocatedTeller: true,
          repayments: { orderBy: { repaymentDate: "asc" } },
        },
      });

      if (!instLoan) throw new Error("Loan not found");

      // Fetch separately via raw SQL to avoid stale client validation error
      ledgerTransactions = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanLedgerTransaction" 
        WHERE "loanId" = ${loanId} 
        ORDER BY "transactionDate" ASC
      `;
      schedules = await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" = ${loanId} 
        ORDER BY "period" ASC
      `;

      memberName = instLoan.institution?.institutionName || "N/A";
      memberNumber = instLoan.institution?.institutionNumber || "N/A";
      loanOfficer =
        instLoan.application?.loanOfficer?.name ||
        instLoan.allocatedTeller?.name ||
        "N/A";
      branch = instLoan.institution?.user?.branch?.name || "N/A";
      loanProduct = instLoan.application?.loanProduct?.name || "N/A";
      principalAmount = instLoan.amountGranted;
      disbursementDate = instLoan.disbursementDate;
      repayments = instLoan.repayments;

      const getVal = (v: any, fallback: any = 0) =>
        v === undefined || v === null ? fallback : v;
      interestAmount =
        instLoan.totalAmountDue - instLoan.amountGranted ||
        schedules.reduce(
          (sum: number, s: any) =>
            sum +
            getVal(
              s.interestPayment || s.interestpayment || s.interest_payment,
            ),
          0,
        );
    }

    const getRepaymentVoucher = (repayment: any) => {
      if (!repayment?.id) return null;
      return repayment.id.substring(0, 8).toUpperCase();
    };

    const repaymentPenaltyByVoucher = new Map<string, number>();
    repayments.forEach((repayment: any) => {
      const voucher = getRepaymentVoucher(repayment);
      if (!voucher) return;
      repaymentPenaltyByVoucher.set(
        voucher,
        (repaymentPenaltyByVoucher.get(voucher) || 0) +
          Number(repayment.penaltyPaid || 0),
      );
    });
    const nativePenaltyVouchers = new Set(
      ledgerTransactions
        .filter(
          (tx: any) =>
            String(
              tx.transactionType || tx.transactiontype || tx.transaction_type || "",
            ).toUpperCase() === "PENALTY_PAYMENT",
        )
        .map((tx: any) =>
          String(
            tx.voucherNo ||
              tx.voucherno ||
              tx.voucher_no ||
              tx.id.substring(0, 8).toUpperCase(),
          ).replace(/-PEN$/, ""),
        ),
    );

    const transactions = ledgerTransactions.map((tx: any) => {
      const getVal = (v: any, fallback: any = 0) =>
        v === undefined || v === null ? fallback : v;
      const voucher =
        tx.voucherNo ||
        tx.voucherno ||
        tx.voucher_no ||
        tx.id.substring(0, 8).toUpperCase();
      const normalizedType = String(
        tx.transactionType || tx.transactiontype || tx.transaction_type || "",
      ).toUpperCase();
      const isNativePenaltyPayment = normalizedType === "PENALTY_PAYMENT";
      const rawCreditInterest = getVal(
        tx.creditInterest || tx.creditinterest || tx.credit_interest,
      );
      const rawCreditPrincipal = getVal(
        tx.creditPrincipal || tx.creditprincipal || tx.credit_principal,
      );
      const creditPenalty = getVal(
          (tx as any).creditPenalty ||
          (tx as any).creditpenalty ||
          (tx as any).credit_penalty ||
          (isNativePenaltyPayment
            ? rawCreditInterest
            : nativePenaltyVouchers.has(voucher)
              ? 0
              : repaymentPenaltyByVoucher.get(voucher)),
      );
      const creditInterest = isNativePenaltyPayment ? 0 : rawCreditInterest;
      const creditPrincipal = rawCreditPrincipal;
      const balancePrincipal = getVal(
        tx.balancePrincipal || tx.balanceprincipal || tx.balance_principal,
      );
      const balanceInterest = getVal(
        tx.balanceInterest || tx.balanceinterest || tx.balance_interest,
      );
      const storedBalance = getVal(
        tx.balanceTotal || tx.balancetotal || tx.balance_total,
      );
      const derivedBalance = balancePrincipal + balanceInterest;

      return {
        date: tx.transactionDate || tx.transactiondate || tx.transaction_date,
        description:
          tx.transactionType || tx.transactiontype || tx.transaction_type,
        reference: voucher,
        debitPrincipal: getVal(
          tx.debitPrincipal || tx.debitprincipal || tx.debit_principal,
        ),
        debitInterest: getVal(
          tx.debitInterest || tx.debitinterest || tx.debit_interest,
        ),
        creditPrincipal,
        creditInterest,
        creditPenalty,
        totalDebit:
          getVal(tx.debitPrincipal || tx.debitprincipal || tx.debit_principal) +
          getVal(tx.debitInterest || tx.debit_interest),
        totalCredit: creditPrincipal + creditInterest + creditPenalty,
        balancePrincipal,
        balanceInterest,
        balance:
          Math.abs(storedBalance - derivedBalance) > 0.01
            ? derivedBalance
            : storedBalance,
      };
    });

    const getVal = (v: any, fallback: any = 0) =>
      v === undefined || v === null ? fallback : v;

    // Calculate total due from fresh schedule calculation (not stored values)
    // This ensures interest is calculated correctly using stored loan interest config
    const { calculateLoanSchedule: calcSchedule } =
      await import("@/lib/loan-calculations");

    const loanRate = loan?.interestRate || 0;
    const loanPeriod = loan?.loanApplication?.repaymentPeriodMonths || 3;
    const loanInterestPeriod =
      loan?.interestPeriod ||
      loan?.loanApplication?.interestPeriod ||
      loan?.loanApplication?.loanProduct?.interestPeriod ||
      "MONTHLY";
    const loanInterestType = loan?.interestType || "FLAT_RATE";
    const loanStartDate = loan?.disbursementDate || new Date();

    const freshLoanSchedule = calcSchedule({
      amountGranted: principalAmount,
      interestRate: loanRate,
      repaymentPeriodMonths: loanPeriod,
      interestType: loanInterestType as "FLAT_RATE" | "REDUCING_BALANCE",
      gracePeriod: 0,
      disbursementDate: loanStartDate,
      interestPeriod: loanInterestPeriod as "MONTHLY" | "ANNUAL",
      scheduleFrequency: "MONTHLY",
      payments: [],
    });

    const totalDue = freshLoanSchedule.totalAmountRepaid;
    const calculatedInterest = freshLoanSchedule.totalInterest;

    const totalPrincipalPaid = transactions.reduce(
      (sum: number, tx: any) => sum + getVal(tx.creditPrincipal),
      0,
    );
    const totalInterestPaid = transactions.reduce(
      (sum: number, tx: any) => sum + getVal(tx.creditInterest),
      0,
    );
    const totalPenaltyPaid = transactions.reduce(
      (sum: number, tx: any) => sum + getVal(tx.creditPenalty),
      0,
    );
    const totalPayments =
      totalPrincipalPaid + totalInterestPaid + totalPenaltyPaid;
    const currentBalance =
      transactions.length > 0
        ? getVal(transactions[transactions.length - 1].balance)
        : principalAmount + interestAmount;

    return {
      loanDetails: {
        id: loanId,
        memberName,
        memberNumber,
        loanProduct,
        principalAmount,
        interestAmount: calculatedInterest,
        totalAmountDue: totalDue,
        disbursementDate,
        status,
        loanOfficer,
        branch,
      },
      transactions,
      summary: {
        totalCredits: totalDue,
        totalDebits: totalPayments,
        totalPrincipalPaid,
        totalInterestPaid,
        totalPenaltyPaid,
        currentBalance,
      },
    };
  } catch (error) {
    console.error("Error generating loan ledger card service:", error);
    throw error;
  }
}

// ============================================================================
// 26. STUB SERVICES FOR REMAINING REPORTS
// ============================================================================

// Alias for backward compatibility
export const getLoanRepaymentScheduleService =
  getRepaymentScheduleReportService;

export async function getLoanGuarantorsReportService(
  user: any,
  loanId?: string,
) {
  return [];
}
export async function getTopBottomBorrowersReportService(
  user: any,
  limit: number = 10,
) {
  return [];
}
export async function getBorrowersDetailsReportService(
  user: any,
  filters?: any,
) {
  const parseGuarantors = (raw: any) => {
    let guarantors = raw;
    if (typeof guarantors === "string") {
      try {
        guarantors = JSON.parse(guarantors);
      } catch {
        guarantors = [];
      }
    }

    if (!Array.isArray(guarantors)) return [];

    return guarantors.map((gu: any) => {
      const name =
        gu?.fullName ||
        gu?.name ||
        gu?.guarantorName ||
        gu?.contactPerson ||
        "N/A";
      const contact =
        gu?.phone ||
        gu?.phoneNumber ||
        gu?.contact ||
        gu?.telephone ||
        gu?.mobile ||
        "N/A";
      return { name, contact };
    });
  };

  const formatCollateral = (application: any) => {
    if (!application) return null;
    const parts = [
      application.collateralOffered,
      application.collateralType,
      application.collateralDetails,
      application.collateralLocation,
      application.collateralValue
        ? `Value ${application.collateralValue}`
        : null,
      application.forcedSaleValue
        ? `Forced Sale ${application.forcedSaleValue}`
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : null;
  };

  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  // Member filter
  const memberWhere: any = {};
  if (bId) memberWhere.user = { branchId: bId };
  if (filters?.memberId && filters.memberId !== "all")
    memberWhere.id = filters.memberId;

  // Institution filter
  const instWhere: any = {};
  if (bId) instWhere.user = { branchId: bId };
  if (filters?.memberId && filters.memberId !== "all")
    instWhere.id = filters.memberId; // In some contexts memberId might be institutionId

  // Optimize: Only fetch members/institutions who actually have loans
  const [members, institutions] = await Promise.all([
    db.member.findMany({
      where: {
        ...memberWhere,
        loans: { some: {} },
      },
      include: {
        user: { include: { branch: true } },
        loans: {
          include: {
            loanApplication: { include: { loanProduct: true } },
          },
        },
        accounts: { include: { accountType: true } },
      },
    }),
    db.institution.findMany({
      where: {
        ...instWhere,
        institutionLoans: { some: {} },
      },
      include: {
        user: { include: { branch: true } },
        institutionLoans: {
          include: {
            application: { include: { loanProduct: true } },
          },
        },
        accounts: { include: { accountType: true } },
      },
    }),
  ]);

  const mapMember = (m: any) => {
    const activeLoans = m.loans.filter(
      (l: any) => l.status === "DISBURSED" || l.status === "OVERDUE",
    );
    const mostRecentLoan =
      m.loans.length > 0
        ? m.loans.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0]
        : null;

    const guarantorEntries = activeLoans
      .map((l: any) => {
        return parseGuarantors(l.loanApplication?.guarantors);
      })
      .flat();

    const guarantorsList = guarantorEntries
      .map((gu: any) => gu.name)
      .filter(Boolean)
      .join(", ");

    const guarantorContacts = guarantorEntries
      .map((gu: any) => `${gu.name}: ${gu.contact}`)
      .filter(Boolean)
      .join(" | ");

    const collateralList = activeLoans
      .map((l: any) => {
        return formatCollateral(l.loanApplication);
      })
      .filter(Boolean).join(" | ");

    const totalBorrowed = m.loans.reduce((sum: number, l: any) => sum + l.amountGranted, 0);
    const totalOutstanding = m.loans.reduce((sum: number, l: any) => sum + l.outstandingBalance, 0);
    const savingsBalance = m.accounts
      .filter((a: any) => !a.accountType.isShareAccount)
      .reduce((sum: number, a: any) => sum + a.balance, 0);
    const shareBalance = m.accounts
      .filter((a: any) => a.accountType.isShareAccount)
      .reduce((sum: number, a: any) => sum + a.balance, 0);

    return {
      memberId: m.id,
      memberNumber: m.memberNumber,
      name: m.user?.name || "N/A",
      phone: m.user?.phone || "N/A",
      email: m.user?.email || "N/A",
      branch: m.user?.branch?.name || "N/A",
      joiningDate: m.createdAt,
      registrationDate: m.createdAt,
      activeLoans: activeLoans.length,
      recentLoanAmount: mostRecentLoan?.amountGranted || 0,
      recentLoanPeriod: mostRecentLoan?.loanApplication?.repaymentPeriodMonths || "N/A",
      disbursementDate: mostRecentLoan?.disbursementDate
        ? format(mostRecentLoan.disbursementDate, "dd/MM/yyyy")
        : "N/A",
      totalBorrowed,
      totalOutstanding,
      outstanding: totalOutstanding,
      savingsBalance,
      totalSavings: savingsBalance,
      shareBalance,
      guarantors: guarantorsList || "N/A",
      guarantorContacts: guarantorContacts || "N/A",
      collateral: collateralList || "N/A",
      isInstitution: false,
    };
  };

  const mapInstitution = (inst: any) => {
    const activeLoans = inst.institutionLoans.filter(
      (l: any) => l.status === "DISBURSED" || l.status === "OVERDUE",
    );
    const mostRecentLoan =
      inst.institutionLoans.length > 0
        ? inst.institutionLoans.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0]
        : null;
    
    const totalBorrowed = inst.institutionLoans.reduce((sum: number, l: any) => sum + l.amountGranted, 0);
    const totalOutstanding = inst.institutionLoans.reduce((sum: number, l: any) => sum + l.outstandingBalance, 0);
    const savingsBalance = inst.accounts
      .filter((a: any) => !a.accountType.isShareAccount)
      .reduce((sum: number, a: any) => sum + a.balance, 0);
    const shareBalance = inst.accounts
      .filter((a: any) => a.accountType.isShareAccount)
      .reduce((sum: number, a: any) => sum + a.balance, 0);

    const institutionGuarantorEntries = activeLoans
      .map((l: any) => parseGuarantors(l.application?.guarantors))
      .flat();

    const institutionGuarantors = institutionGuarantorEntries
      .map((gu: any) => gu.name)
      .filter(Boolean)
      .join(", ");

    const institutionGuarantorContacts = institutionGuarantorEntries
      .map((gu: any) => `${gu.name}: ${gu.contact}`)
      .filter(Boolean)
      .join(" | ");

    const institutionCollateral = activeLoans
      .map((l: any) => formatCollateral(l.application))
      .filter(Boolean)
      .join(" | ");

    return {
      memberId: inst.id,
      memberNumber: inst.institutionNumber,
      name: inst.institutionName,
      phone: inst.institutionPhone || inst.user?.phone || "N/A",
      email: inst.institutionEmail || inst.user?.email || "N/A",
      branch: inst.user?.branch?.name || "N/A",
      joiningDate: inst.createdAt,
      registrationDate: inst.createdAt,
      activeLoans: activeLoans.length,
      recentLoanAmount: mostRecentLoan?.amountGranted || 0,
      recentLoanPeriod: mostRecentLoan?.application?.repaymentPeriodMonths || "N/A",
      disbursementDate: mostRecentLoan?.disbursementDate
        ? format(mostRecentLoan.disbursementDate, "dd/MM/yyyy")
        : "N/A",
      totalBorrowed,
      totalOutstanding,
      outstanding: totalOutstanding,
      savingsBalance,
      totalSavings: savingsBalance,
      shareBalance,
      isInstitution: true,
      guarantors: institutionGuarantors || "N/A",
      guarantorContacts: institutionGuarantorContacts || "N/A",
      collateral: institutionCollateral || "N/A",
    };
  };

  return [
    ...members.map((m) => mapMember(m)),
    ...institutions.map((i) => mapInstitution(i)),
  ];
}

export async function getDailyDemandSheetService(
  user: any,
  filters?: { branchId?: string; officerId?: string; date?: string | Date },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  const date = filters?.date ? new Date(filters.date) : new Date();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Individual schedules — filter by loan.branchId
  const indWhere: any = {
    dueDate: { gte: startOfDay, lte: endOfDay },
    status: { not: "PAID" },
  };
  if (bId) indWhere.loan = { branchId: bId };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }
  if (allowedOfficerId && allowedOfficerId !== "all") {
    indWhere.loan = {
      ...(indWhere.loan || {}),
      allocatedTellerId: allowedOfficerId,
    };
  }

  const indSchedules = await db.loanRepaymentSchedule.findMany({
    where: indWhere,
    include: {
      loan: {
        include: {
          member: { include: { user: true } },
          loanApplication: { include: { loanProduct: true } },
          branch: true,
          allocatedTeller: true,
        },
      },
    },
  });

  // Institution schedules — filter by loan.institution.user.branchId
  const instWhere: any = {
    dueDate: { gte: startOfDay, lte: endOfDay },
    status: { not: "PAID" },
  };
  if (bId) instWhere.loan = { institution: { user: { branchId: bId } } };
  if (allowedOfficerId && allowedOfficerId !== "all") {
    instWhere.loan = {
      ...(instWhere.loan || {}),
      allocatedTellerId: allowedOfficerId,
    };
  }

  const instSchedules = await db.institutionLoanRepaymentSchedule.findMany({
    where: instWhere,
    include: {
      loan: {
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true } },
          allocatedTeller: true,
        },
      },
    },
  });

  const allDues = [
    ...indSchedules.map((s) => ({
      loanId: s.loan.id,
      memberName: s.loan.member?.user?.name || "N/A",
      memberNumber: s.loan.member?.memberNumber || "N/A",
      loanProduct: s.loan.loanApplication?.loanProduct?.name || "N/A",
      dueDate: s.dueDate,
      principalDue: s.principalPayment,
      interestDue: s.interestPayment,
      totalDue: s.totalPayment,
      balanceAfter: s.remainingBalance,
      branch: s.loan.branch?.name || "N/A",
      officer: s.loan.allocatedTeller?.name || "N/A",
    })),
    ...instSchedules.map((s) => ({
      loanId: s.loan.id,
      memberName: s.loan.institution?.institutionName || "N/A",
      memberNumber: s.loan.institution?.institutionNumber || "N/A",
      loanProduct: s.loan.application?.loanProduct?.name || "N/A",
      dueDate: s.dueDate,
      principalDue: s.principalPayment,
      interestDue: s.interestPayment,
      totalDue: s.totalPayment,
      balanceAfter: s.remainingBalance,
      branch: s.loan.institution?.user?.branch?.name || "N/A",
      officer: s.loan.allocatedTeller?.name || "N/A",
    })),
  ];

  const expectedAmount = allDues.reduce((sum, d) => sum + d.totalDue, 0);

  return {
    loansDue: allDues.map((d) => ({
      ...d,
      amountDue: d.totalDue, // Map totalDue to amountDue for frontend compatibility
    })),
    summary: {
      totalLoansDue: allDues.length,
      expectedAmount,
      totalRepayments: 0,
      collectedAmount: 0,
      collectionRate: 0,
      shortfall: expectedAmount,
    },
    filterOptions: {
      officers: Array.from(new Set(allDues.map((d) => d.officer))).map(
        (name) => ({ id: name, name }),
      ),
    },
  };
}
export async function getLoanCollateralReportService(user: any) {
  return [];
}
export async function getWrittenOffLoansRepaymentReportService(
  user: any,
  filters?: any,
) {
  return [];
}
export async function getRescheduledLoanReportService(
  user: any,
  filters?: any,
) {
  return [];
}
export async function getLoanRepaymentHistoryReportService(
  user: any,
  filters?: any,
) {
  return {
    transactions: [],
    summary: { totalTransactions: 0, totalAmount: 0 },
  };
}

// ============================================================================
// 20. PENALTY COLLECTION REPORT
// ============================================================================
export async function getPenaltyCollectionReportService(
  user: any,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    officerId?: string;
  },
) {
  const branchFilter = await getBranchFilterForLoanService(
    user,
    filters?.branchId,
  );
  const bId = branchFilter.branchId;

  const whereDue: any = {};
  if (filters?.startDate) whereDue.dueDate = { gte: filters.startDate };
  if (filters?.endDate)
    whereDue.dueDate = { ...whereDue.dueDate, lte: filters.endDate };

  let allowedOfficerId = filters?.officerId;
  if (
    (user.role === UserRole.LOANOFFICER || user.role === UserRole.TELLER) &&
    (!filters?.officerId || filters.officerId === "all")
  ) {
    allowedOfficerId = user.id;
  }

  // Get loans with penalties
  const loansWhere: any = {
    status: { in: ["DISBURSED", "OVERDUE"] },
    penaltyCharged: { gt: 0 },
    ...branchFilter,
  };
  if (allowedOfficerId && allowedOfficerId !== "all") {
    loansWhere.allocatedTellerId = allowedOfficerId;
  }

  const loansWithPenalties = await db.loan.findMany({
    where: loansWhere,
    select: {
      id: true,
      penaltyCharged: true,
      penaltyPaid: true,
      amountGranted: true,
      outstandingBalance: true,
      disbursementDate: true,
      member: { include: { user: { select: { name: true } } } },
      loanApplication: { include: { loanProduct: { select: { name: true } } } },
    },
    orderBy: { disbursementDate: "desc" },
  });

  const records = loansWithPenalties.map((loan: any) => ({
    loanId: loan.id,
    memberName: loan.member.user.name,
    loanProduct: loan.loanApplication.loanProduct.name,
    disbursementDate: loan.disbursementDate,
    penaltyCharged: loan.penaltyCharged || 0,
    penaltyPaid: loan.penaltyPaid || 0,
    penaltyOutstanding: (loan.penaltyCharged || 0) - (loan.penaltyPaid || 0),
    collectionRate:
      loan.penaltyCharged > 0
        ? ((loan.penaltyPaid || 0) / loan.penaltyCharged) * 100
        : 0,
  }));

  const summary = {
    totalPenaltyCharged: records.reduce(
      (sum: number, r: any) => sum + r.penaltyCharged,
      0,
    ),
    totalPenaltyPaid: records.reduce(
      (sum: number, r: any) => sum + r.penaltyPaid,
      0,
    ),
    totalPenaltyOutstanding: records.reduce(
      (sum: number, r: any) => sum + r.penaltyOutstanding,
      0,
    ),
    overallCollectionRate:
      records.reduce((sum: number, r: any) => sum + r.penaltyCharged, 0) > 0
        ? (records.reduce((sum: number, r: any) => sum + r.penaltyPaid, 0) /
            records.reduce(
              (sum: number, r: any) => sum + r.penaltyCharged,
              0,
            )) *
          100
        : 0,
    totalLoans: records.length,
  };

  return { records, summary };
}
