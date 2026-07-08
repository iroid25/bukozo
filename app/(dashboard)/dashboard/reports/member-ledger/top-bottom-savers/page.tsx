"use client";

import TopBottomAccountsReportClient from "../top-bottom-accounts-report-client";

export default function TopBottomSaversPage() {
  return (
    <TopBottomAccountsReportClient
      accountCategory="savings"
      title="Top Bottom Savers"
      description="Ranking of members by savings balance, driven by live savings account activity."
      switchHref="/dashboard/reports/member-ledger/top-bottom-share-holders"
      switchLabel="View Share Holders"
    />
  );
}
