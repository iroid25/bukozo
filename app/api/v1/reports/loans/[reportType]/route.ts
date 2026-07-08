import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { getAuthUser } from "@/config/useAuth";
import {
  getLoanArrearsReportService,
  getLoanArrearsByAgeService,
  getLoanOutstandingBalanceService,
  getLoanPortfolioReportService,
  getLoanSummaryService,
  getLoanProductPerformanceService,
  getMonthlyLoanTrendsService,
  getLoanRepaymentReportService,
  getWrittenOffLoansReportService,
  getPaidOffLoansReportService,
  getDetailedLoanReportService,
  getActiveLoansByOfficerService,
  getLoanDuesVsRepaymentReportService,
  getRepaymentScheduleReportService,
  getLoanLedgerCardsReportService,
  getLoanLedgerSearchResultsService,
  getLoanDisbursementReportService,
  getApplicationApprovalRejectionReportService,
  getLoanAgeAnalysisService,
  getRepaymentChannelStatsService,
  getPortfolioConcentrationReportService,
  getLoanOfficerAnalysisReportService,
  getPortfolioAtRiskService,
  getLoanLedgerCardService,
  getLoanRepaymentScheduleService,
  getLoanGuarantorsReportService,
  getTopBottomBorrowersReportService,
  getBorrowersDetailsReportService,
  getDailyDemandSheetService,
  getLoanCollateralReportService,
  getLoanRepaymentHistoryReportService,
  getWrittenOffLoansRepaymentReportService,
  getRescheduledLoanReportService,
  getPenaltyCollectionReportService,
} from "@/lib/services/loan-reports";

// Map slugs to generator functions
const REPORT_HANDLERS: Record<string, Function> = {
  // Dashboards & Summaries
  summary: getLoanSummaryService,
  "product-performance": getLoanProductPerformanceService,
  "monthly-trends": getMonthlyLoanTrendsService,
  "channel-stats": getRepaymentChannelStatsService,
  "age-analysis": getLoanAgeAnalysisService,
  "par-summary": getPortfolioAtRiskService,
  portfolio: getLoanPortfolioReportService,

  // Specific Reports
  "active-by-officer": getActiveLoansByOfficerService,
  "dues-vs-repayment": getLoanDuesVsRepaymentReportService,
  "written-off": getWrittenOffLoansReportService,
  "paid-off": getPaidOffLoansReportService,
  guarantors: getLoanGuarantorsReportService,
  applications: getApplicationApprovalRejectionReportService,
  "top-bottom-borrowers": getTopBottomBorrowersReportService,
  "borrowers-details": getBorrowersDetailsReportService,
  "daily-demand": getDailyDemandSheetService,
  collateral: getLoanCollateralReportService,
  "repayment-summary": getLoanRepaymentReportService,
  "written-off-repayment": getWrittenOffLoansRepaymentReportService,
  rescheduled: getRescheduledLoanReportService,

  // Bulk Reports
  detailed: getDetailedLoanReportService,
  "all-schedules": getRepaymentScheduleReportService,
  "all-ledgers": getLoanLedgerCardsReportService,
  "ledger-search": getLoanLedgerSearchResultsService,
  "repayment-history": getLoanRepaymentHistoryReportService,
  "penalty-collection": getPenaltyCollectionReportService,

  // Individual Loan Reports
  arrears: getLoanArrearsReportService,
  "arrears-by-age": getLoanArrearsByAgeService,
  outstanding: getLoanOutstandingBalanceService,
  "portfolio-concentration": getPortfolioConcentrationReportService,
  "loan-officer-analysis": getLoanOfficerAnalysisReportService,
  overdue: getLoanOutstandingBalanceService,
  disbursement: getLoanDisbursementReportService,
  "portfolio-at-risk": getLoanPortfolioReportService,
  "ledger-card": getLoanLedgerCardService,
  "repayment-schedule": getLoanRepaymentScheduleService,
};

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ reportType: string }> },
) {
  const params = await props.params;
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { reportType } = params;
    const handler = REPORT_HANDLERS[reportType];

    if (
      !handler &&
      ![
        "arrears",
        "arrears-by-age",
        "outstanding",
        "portfolio",
        "portfolio-at-risk",
        "portfolio-concentration",
        "loan-officer-analysis",
        "overdue",
        "disbursement",
      ].includes(reportType)
    ) {
      return NextResponse.json(
        { success: false, error: `Report type '${reportType}' not found.` },
        { status: 404 },
      );
    }

    // Extract Query Parameters
    const { searchParams } = new URL(request.url);

    // Common Filters
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const branchId = searchParams.get("branchId") || undefined;
    const officerId = searchParams.get("officerId") || undefined;
    const loanId = searchParams.get("loanId") || undefined;
    const memberId = searchParams.get("memberId") || undefined;
    const institutionId = searchParams.get("institutionId") || undefined;
    const loanProductId = searchParams.get("loanProductId") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined;
    const months = searchParams.get("months")
      ? parseInt(searchParams.get("months")!)
      : undefined;
    const dateParam = searchParams.get("date");
    const specificDate = dateParam ? new Date(dateParam) : undefined;

    let data;

    switch (reportType) {
      case "summary":
        data = await getLoanSummaryService(user, {
          startDate,
          endDate,
          branchId,
        });
        break;
      case "product-performance":
        data = await getLoanProductPerformanceService(user, {
          startDate,
          endDate,
          branchId,
        });
        break;
      case "monthly-trends":
        data = await getMonthlyLoanTrendsService(user, months || 6, {
          branchId,
        });
        break;
      case "repayment-summary":
        data = await getLoanRepaymentReportService(user, {
          startDate,
          endDate,
          branchId,
        });
        break;
      case "written-off":
        data = await getWrittenOffLoansReportService(user, {
          branchId,
          officerId,
        });
        break;
      case "paid-off":
        data = await getPaidOffLoansReportService(user, {
          branchId,
          officerId,
        });
        break;
      case "detailed":
        data = await getDetailedLoanReportService(user, { branchId });
        break;
      case "active-by-officer":
        data = await getActiveLoansByOfficerService(user, {
          branchId,
          officerId,
        });
        break;
      case "dues-vs-repayment":
        data = await getLoanDuesVsRepaymentReportService(user, {
          startDate,
          endDate,
          branchId,
          officerId,
        });
        break;
      case "all-schedules":
        data = await getRepaymentScheduleReportService(user, {
          branchId,
          officerId,
          loanId,
        });
        break;
      case "all-ledgers":
        data = await getLoanLedgerCardsReportService(user, {
          branchId,
          officerId,
          memberId,
          institutionId,
        });
        break;
      case "ledger-search":
        data = await getLoanLedgerSearchResultsService(user, {
          branchId,
          officerId,
          memberId,
          institutionId,
        });
        break;
      case "repayment-schedule":
        // expects { branchId?, officerId?, loanId? }
        data = await getLoanRepaymentScheduleService(user, {
          loanId,
          branchId,
          officerId,
        });
        break;
      case "ledger-card":
        // expects a plain string loanId
        data = await getLoanLedgerCardService(user, loanId ?? "");
        break;
      case "guarantors":
        data = await handler(user, loanId);
        break;
      case "borrowers-details":
        data = await handler(user, { branchId, officerId, memberId, institutionId });
        break;
      case "top-bottom-borrowers":
        data = await handler(user, limit);
        break;
      case "daily-demand":
        data = await handler(user, { date: specificDate, branchId, officerId });
        break;
      case "collateral":
      case "repayment-history":
      case "penalty-collection":
      case "rescheduled":
      case "written-off-repayment":
        data = await handler(user, {
          startDate,
          endDate,
          branchId,
          officerId,
          loanId,
          memberId,
          institutionId,
          loanProductId,
          status,
        });
        break;
      default:
        data = await handler(user, {
          startDate,
          endDate,
          branchId,
          officerId,
          loanId,
          memberId,
          institutionId,
          loanProductId,
          status,
        });
        break;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`Error in API route [${params.reportType}]:`, error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
