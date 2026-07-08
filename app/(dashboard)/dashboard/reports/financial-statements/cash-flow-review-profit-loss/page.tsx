import { CashFlowReviewReportPage } from "@/components/reports/CashFlowReviewReportPage";

export default function CashFlowReviewProfitLossPage() {
  return (
    <CashFlowReviewReportPage
      title="Cash Flow Review Profit And Loss"
      description="Compare income and expense positions across two periods for branch-scoped review."
      endpoint="/api/v1/reports/financial/cash-flow-review/profit-loss"
      reportTitle="Cash Flow Review Profit And Loss"
    />
  );
}
