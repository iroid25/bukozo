# Reports Inventory And Real-Time Implementation Guide

Scanned from the current codebase on 2026-04-28.

## What This Covers

- `Report hub` means a landing page that links to subreports.
- `Report page` means a user-facing report view.
- `API route` means the backend data source the page reads from.
- `Real-time` here means fresh data on open, no stale client imports, and a repeatable refresh path.

## Implementation Status

- Main reports hub is now expanded to include Loans, Manager Reports, Custom Reports, GL Performance, and Savings & Shares Hub.
- Shared report wrapper pages now use `no-store` fetches and refresh polling where appropriate.
- Core loan report screens were swept for stale requests and converted to live requests.
- `savings-performance` now has a live backend route.
- `budget-variance` now has a dedicated public page and uses the comprehensive generator.

## Top-Level Report Hubs

- `/dashboard/reports`
- `/dashboard/reports/financial-dashboard`
- `/dashboard/reports/financial`
- `/dashboard/reports/financial2`
- `/dashboard/reports/financial-statements`
- `/dashboard/reports/transactions`
- `/dashboard/reports/fixed-deposits`
- `/dashboard/reports/savings`
- `/dashboard/reports/shares`
- `/dashboard/reports/savings-shares-reports`
- `/dashboard/reports/fixed-assets`
- `/dashboard/reports/standing-orders`
- `/dashboard/reports/sms-banking`
- `/dashboard/reports/agent-performance`
- `/dashboard/reports/manager`
- `/dashboard/reports/custom-reports`
- `/dashboard/reports/gl-performance`
- `/dashboard/reports/loans`

## Report Pages By Category

### Financial Dashboard

- Page: `/dashboard/reports/financial-dashboard`
- Data: `/api/v1/reports/financial/summary`
- Data: `/api/v1/reports/financial/trends?months=12`
- Behavior: already refresh-oriented, but still not a shared live-report abstraction.

### Financial Statements

- Page: `/dashboard/reports/financial-statements/balance-sheet`
- Data: `/api/v1/reports/financial/balance-sheet`
- Page: `/dashboard/reports/financial-statements/trial-balance`
- Data: `/api/v1/reports/financial/trial-balance`
- Page: `/dashboard/reports/financial-statements/income-statement`
- Data: `/api/v1/reports/financial/profit-loss`
- Page: `/dashboard/reports/financial-statements/cash-flow`
- Data: `/api/v1/reports/financial/cash-flow`
- Page alias: `/dashboard/reports/financial-statements/profit-loss`
- Data: `/api/v1/reports/financial/profit-loss`
- Page: `/dashboard/reports/financial-statements/budget-variance`
- Data: `/api/v1/reports/comprehensive` with `reportType=budget-variance`

### Transactions

- `/dashboard/reports/transactions/sequence-session` -> `/api/v1/reports/transactions/sequence-session`
- `/dashboard/reports/transactions/sequence-transaction` -> `/api/v1/reports/transactions/sequence-transaction`
- `/dashboard/reports/transactions/journal-session` -> `/api/v1/reports/transactions/journal-session`
- `/dashboard/reports/transactions/journal-transaction` -> `/api/v1/reports/transactions/journal-transaction`
- `/dashboard/reports/transactions/daysheet-session` -> `/api/v1/reports/transactions/daysheet-session`
- `/dashboard/reports/transactions/daysheet-transaction` -> `/api/v1/reports/transactions/daysheet-transaction`
- `/dashboard/reports/transactions/register-session` -> `/api/v1/reports/transactions/register-session`
- `/dashboard/reports/transactions/register-transaction` -> `/api/v1/reports/transactions/register-transaction`
- `/dashboard/reports/transactions/cashier-status` -> `/api/v1/reports/transactions/cashier-status`

### Fixed Deposits

- `/dashboard/reports/fixed-deposits/listing` -> `/api/v1/reports/fixed-deposits/listing`
- `/dashboard/reports/fixed-deposits/active` -> `/api/v1/reports/fixed-deposits/active`
- `/dashboard/reports/fixed-deposits/statement` -> `/api/v1/reports/fixed-deposits/statement`
- `/dashboard/reports/fixed-deposits/maturing` -> `/api/v1/reports/fixed-deposits/maturing`
- `/dashboard/reports/fixed-deposits/withdrawn` -> `/api/v1/reports/fixed-deposits/withdrawn`

### Savings

- `/dashboard/reports/savings/savings-listing` -> `/api/v1/reports/savings/account-listing`
- `/dashboard/reports/savings/savings-balances` -> `/api/v1/reports/savings/account-balance`
- `/dashboard/reports/savings/inactive-accounts` -> `/api/v1/reports/savings/dormant-accounts`
- `/dashboard/reports/savings/dormant-accounts` -> `/api/v1/reports/savings/dormant-accounts`
- `/dashboard/reports/savings/zero-balance` -> `/api/v1/reports/savings/zero-balance`
- `/dashboard/reports/savings/overdrawn` -> `/api/v1/reports/savings/overdrawn-accounts`
- `/dashboard/reports/savings/savings-performance` -> `/api/v1/reports/savings/performance`
- `savings-performance` now resolves to a live savings performance endpoint.

### Shares

- `/dashboard/reports/shares/shares-listing` -> `/api/v1/reports/comprehensive` with `reportType=shares-listing`
- `/dashboard/reports/shares/shares-performance` -> currently only appears as a catalog link
- `/dashboard/reports/shares/shares-transfers` -> currently only appears as a catalog link
- `/dashboard/reports/shares/[reportType]` currently supports `shares-listing`, `shares-performance`, `shares-transfers`
- `/dashboard/reports/savings-shares-reports/shares` is the newer hub for share reporting

### Fixed Assets

- `/dashboard/reports/fixed-assets/register` -> `/api/v1/reports/fixed-assets` with `reportType=assets-registered`
- `/dashboard/reports/fixed-assets` menu entry -> `/api/v1/reports/fixed-assets` with `reportType=assets-listing`
- `/dashboard/reports/fixed-assets/depreciation` -> `/api/v1/reports/fixed-assets` with `reportType=assets-depreciation`
- `/dashboard/reports/fixed-assets/disposal` -> `/api/v1/reports/fixed-assets` with `reportType=assets-disposal`

### Agent Performance

- `/dashboard/reports/agent-performance` -> `/api/v1/reports/agent-performance`

### General Ledger Performance

- `/dashboard/reports/gl-performance` -> live client-driven report with polling refresh
- Data now refreshes from the client component with a polling loop
- Fetches use `no-store` so the page behaves like a live report instead of a cached snapshot

### Manager Reports

- `/dashboard/reports/manager` -> `/api/v1/reports/manager/dashboard-stats`
- Links out to:
- `/dashboard/reports/savings-shares-reports`
- `/dashboard/reports/loans`
- `/dashboard/reports/financial-statements/trial-balance`
- `/dashboard/reports/financial-statements/balance-sheet`
- `/dashboard/reports/financial-statements/income-statement`
- `/dashboard/reports/financial-statements/cash-flow`

### Loan Reports

- `/dashboard/reports/loans` -> `/api/v1/reports/loans/summary`
- `/dashboard/reports/loans` -> `/api/v1/reports/loans/product-performance`
- `/dashboard/reports/loans` -> `/api/v1/reports/loans/monthly-trends`
- `/dashboard/reports/loans` -> `/api/v1/reports/loans/age-analysis`
- `/dashboard/reports/loans` -> `/api/v1/reports/loans/channel-stats`
- The backend route also supports many more slugs under `/api/v1/reports/loans/[reportType]`

### Custom Reports

- `/dashboard/reports/custom-reports`
- Data comes from:
- `/api/v1/reports/custom/cash-flow`
- `/api/v1/reports/custom/balance-sheet`
- `/api/v1/reports/custom/profit-loss`

### Savings and Shares Mega Hub

- `/dashboard/reports/savings-shares-reports/savings`
- `/dashboard/reports/savings-shares-reports/shares`
- `/dashboard/reports/savings-shares-reports/share-capital-remittances`
- This hub is a catalog layer, not a dedicated data endpoint by itself.

## Backend Report Routes

### Financial

- `/api/v1/reports/financial/summary`
- `/api/v1/reports/financial/trends`
- `/api/v1/reports/financial/dashboard-summary`
- `/api/v1/reports/financial/dashboard-trends`
- `/api/v1/reports/financial/transactions`
- `/api/v1/reports/financial/balance-sheet`
- `/api/v1/reports/financial/trial-balance`
- `/api/v1/reports/financial/profit-loss`
- `/api/v1/reports/financial/cash-flow`
- `/api/v1/reports/financial/performance`

### Financial Year

- `/api/v1/reports/financial-year/balance-sheet`
- `/api/v1/reports/financial-year/profit-loss`
- `/api/v1/reports/financial-year/trial-balance`

### Transactions

- `/api/v1/reports/transactions/cashier-status`
- `/api/v1/reports/transactions/daysheet-session`
- `/api/v1/reports/transactions/daysheet-transaction`
- `/api/v1/reports/transactions/journal-session`
- `/api/v1/reports/transactions/journal-transaction`
- `/api/v1/reports/transactions/register-session`
- `/api/v1/reports/transactions/register-transaction`
- `/api/v1/reports/transactions/sequence-session`
- `/api/v1/reports/transactions/sequence-transaction`

### Loans

- `/api/v1/reports/loans/[reportType]`
- Supported slugs in code today:
- `summary`
- `product-performance`
- `monthly-trends`
- `channel-stats`
- `age-analysis`
- `par-summary`
- `portfolio`
- `active-by-officer`
- `dues-vs-repayment`
- `written-off`
- `paid-off`
- `guarantors`
- `applications`
- `top-bottom-borrowers`
- `borrowers-details`
- `daily-demand`
- `collateral`
- `repayment-summary`
- `written-off-repayment`
- `rescheduled`
- `detailed`
- `all-schedules`
- `all-ledgers`
- `ledger-search`
- `repayment-history`
- `penalty-collection`
- `arrears`
- `arrears-by-age`
- `outstanding`
- `portfolio-concentration`
- `loan-officer-analysis`
- `overdue`
- `disbursement`
- `portfolio-at-risk`
- `ledger-card`
- `repayment-schedule`

### Fixed Deposits

- `/api/v1/reports/fixed-deposits/listing`
- `/api/v1/reports/fixed-deposits/active`
- `/api/v1/reports/fixed-deposits/statement`
- `/api/v1/reports/fixed-deposits/maturing`
- `/api/v1/reports/fixed-deposits/withdrawn`

### Fixed Assets

- `/api/v1/reports/fixed-assets`
- Supported `reportType` values:
- `assets-registered`
- `assets-listing`
- `assets-depreciation`
- `assets-disposal`

### Savings

- `/api/v1/reports/savings/account-listing`
- `/api/v1/reports/savings/account-balance`
- `/api/v1/reports/savings/account-statement`
- `/api/v1/reports/savings/batch-totals`
- `/api/v1/reports/savings/dormant-accounts`
- `/api/v1/reports/savings/interest-paid`
- `/api/v1/reports/savings/on-hold-closed`
- `/api/v1/reports/savings/overdrawn-accounts`
- `/api/v1/reports/savings/top-bottom-savers`
- `/api/v1/reports/savings/transactions`
- `/api/v1/reports/savings/zero-balance`

### Shares

- `/api/v1/reports/shares/account-balance`
- `/api/v1/reports/shares/account-listing`
- `/api/v1/reports/shares/account-statement`
- `/api/v1/reports/shares/batch-totals`
- `/api/v1/reports/shares/concentration`
- `/api/v1/reports/shares/on-hold-closed`
- `/api/v1/reports/shares/share-capital-remittances`
- `/api/v1/reports/shares/top-bottom-shareholders`
- `/api/v1/reports/shares/transactions`
- `/api/v1/reports/shares/zero-balance`

### Operations And Compliance

- `/api/v1/reports/activity`
- `/api/v1/reports/activity/statistics`
- `/api/v1/reports/agent-performance`
- `/api/v1/reports/manager/dashboard-stats`
- `/api/v1/reports/standing-orders`
- `/api/v1/reports/sms-banking`
- `/api/v1/reports/member-statement`
- `/api/v1/reports/generate`
- `/api/v1/reports/comprehensive`

### Shared Generator Slugs

- `/api/v1/reports/generate` accepts `reportId`
- Savings:
- `savings-deposits`
- `savings-withdrawals`
- `savings-balance`
- Shares:
- `shares-statement`
- `shares-balance`
- `shares-concentration`
- `shares-listing`
- `shares-batch-totals`
- `shares-on-hold`
- `shares-zero-balance`
- `shares-top-bottom`
- `shares-transactions`
- Loans:
- `loan-disbursements`
- `loan-repayments`
- `loan-outstanding`
- Financial:
- `income-report`
- `expenditure-report`
- `income-vs-expenditure`
- Operations:
- `float-transactions`
- `vault-transactions`
- `branch-performance`
- Members:
- `customer-accounts-listing`
- `customer-contacts`
- `blacklisted-clients`
- `transferred-clients`
- Audit:
- `audit-trail`
- `error-corrected-transactions`
- `transaction-authorization`
- `eod-supervision`
- `system-users`
- Performance:
- `performance-monitoring`
- `performance-indicators`

### Comprehensive Generator Slugs

- `/api/v1/reports/comprehensive` accepts `reportType`
- Fixed deposit:
- `fd-concentration`
- `fd-reversed`
- `fd-interest-exposure`
- Shares:
- `share-statement`
- Savings:
- `savings-overdrawn-age`
- Financial:
- `coa-listing`
- `budget-variance`
- `comprehensive-trial-balance`
- `comprehensive-balance-sheet`
- `comprehensive-income`
- General:
- `account-statement`
- `personal-ledger`
- `clients-registered`
- `customer-feedback`

## Gaps Found

- `financial` and `financial2` still deserve a legacy audit before we build more surface area on top of them.

## Real-Time Standards

- Use server-only data access only in API routes, server actions, or server components.
- Never import Prisma-backed services into a client component.
- Client report pages should fetch via `fetch(..., { cache: "no-store" })`.
- If a page is a summary dashboard, add a refresh loop or invalidation hook.
- If a page is a table report, keep a visible `generatedAt` stamp.
- When a report mutates data elsewhere in the app, refresh it with `router.refresh()`, `revalidatePath()`, or a sync version hook.
- Prefer `useSession()` in client components instead of server auth helpers.

## Recommended Migration Order

1. Financial dashboard and financial statements
2. Transaction reports
3. Loan reports
4. Manager and agent performance reports
5. Fixed deposits
6. Savings and shares
7. Fixed assets
8. Standing orders and SMS banking
9. GL performance
10. Custom and comprehensive generator reports

## Per-Report Implementation Checklist

1. Confirm the page is a client component or server component.
2. Identify the exact backend route or generator slug.
3. Make the backend route branch-aware and permission-safe.
4. Make the client fetch live data with `no-store`.
5. Add a manual refresh button.
6. Add polling if the report should feel live.
7. Show `generatedAt`, branch scope, and filter scope.
8. Add loading, empty, and error states.
9. Add an export path if users need CSV, XLSX, or PDF.
10. Run `pnpm build` after each change.

## One-By-One Workflow

- Pick one report.
- Move its data fetch behind a server route if it is still mixed into the client bundle.
- Verify the page renders from the route with live data.
- Add or update tests if the report has business rules.
- Mark the report as done in this guide.
- Repeat for the next report.
