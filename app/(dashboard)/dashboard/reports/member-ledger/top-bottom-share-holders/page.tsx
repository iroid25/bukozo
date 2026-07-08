"use client";

import TopBottomAccountsReportClient from "../top-bottom-accounts-report-client";

export default function TopBottomShareHoldersPage() {
  return (
    <TopBottomAccountsReportClient
      accountCategory="shares"
      title="Top Bottom Share Holders"
      description="Ranking of members by shareholding, driven by live share account activity."
      switchHref="/dashboard/reports/member-ledger/top-bottom-savers"
      switchLabel="View Savers"
    />
  );
}
