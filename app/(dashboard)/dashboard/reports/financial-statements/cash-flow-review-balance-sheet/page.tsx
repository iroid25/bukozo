import { CashFlowReviewReportPage } from "@/components/reports/CashFlowReviewReportPage";

export default function CashFlowReviewBalanceSheetPage() {
  return (
    <CashFlowReviewReportPage
      title="Cash Flow Review Balance Sheet"
      description="Compare balance sheet positions across two periods for branch-scoped review."
      endpoint="/api/v1/reports/financial/cash-flow-review/balance-sheet"
      reportTitle="Cash Flow Review Balance Sheet"
    />
  );
}
