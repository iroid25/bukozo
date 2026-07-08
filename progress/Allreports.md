# API-First Report Inventory

## Rules

- Every report page under `/dashboard/reports` must fetch from an API route.
- No report page should depend on a server action for its primary data load or export.
- The API route owns auth, branch scoping, filters, and export format.
- The report builder in `lib/reports/*` owns the business logic and grouping.
- The page in `app/(dashboard)/dashboard/reports/*` should stay UI-only.

## Phase Plan

1. Inventory every report page and attach it to one API route.
2. Move any remaining server-action-driven report flow behind an API route.
3. Normalize source-of-truth per domain:
   - savings -> `db.account`, `db.transaction`, `db.deposit`, `db.withdrawal`
   - shares -> `db.shareAccount`, `db.shareTransaction`
   - fixed deposits -> `db.fixedDeposit`, `db.account`
   - transactions -> `db.transaction`, `db.deposit`, `db.withdrawal`, `db.userFloat`
   - financial statements -> ledger, journals, budgets, income, expenditure
   - audit -> `AuditLog`, `CustomerAuditTrail`
4. Align all totals and product mappings.
5. Add reconciliation checks and fixture coverage.
6. Remove or mark legacy pages once the API-backed replacement is stable.

## Implementation Phases

### Phase 1 - API Routing and Shared Refresh

- Goal: every report page fetches from an API route and refreshes from the shared live signal.
- Target families:
  - Audit and Compliance
  - Accounting and Financial Statements
  - Savings
  - Shares
  - Fixed Deposits
  - Transactions and Journals
  - Member and Ledger
  - Performance and Monitoring
- Required activity wiring:
  - deposits
  - withdrawals
  - transfers
  - share movements
  - fixed-deposit lifecycle changes
  - journal postings
  - audit events
  - member profile edits
  - teller/float changes

### Phase 2 - Report Accuracy and Mapping

- Goal: every report shows the right data buckets and no valid account disappears.
- Target work:
  - canonical savings product mapping
  - share product grouping
  - fixed-deposit grouping
  - year-end financial statement rollups
  - branch scoping rules
  - empty-group visibility when `All` is selected
- Required activity wiring:
  - account openings
  - account balance updates
  - ledger mappings
  - product/account-type mapping
  - branch ownership

### Phase 3 - Reconciliation

- Goal: reports reconcile to the system of record.
- Target work:
  - savings listing vs `db.account`
  - savings transactions vs `db.transaction`
  - shares reports vs `db.shareAccount` and `db.shareTransaction`
  - fixed-deposit reports vs fixed-deposit lifecycle records
  - financial statements vs journal/ledger totals
  - audit trail vs before/after snapshots
- Required activity wiring:
  - posted transactions only
  - approved profile updates
  - matured/withdrawn fixed deposits
  - completed share remittances
  - closed accounting periods

### Phase 4 - Legacy Cleanup

- Goal: remove or redirect wrappers that duplicate newer report pages.
- Target pages:
  - `financial2`
  - `custom-reports`
  - `sms-banking`
  - `standing-orders`
  - any duplicate shell under `/dashboard/reports`
- Required activity wiring:
  - route redirects
  - API endpoint reuse
  - no server-action-only paths

### Phase 5 - Fixture Coverage

- Goal: protect the reporting layer from regressions.
- Target fixtures:
  - member with a savings balance
  - member with zero balance
  - share holder with zero shares
  - fixed deposit nearing maturity
  - fixed deposit withdrawn
  - teller session with float movement
  - audit before/after pair
  - year-end closing entry

### Phase 6 - Verification

- Goal: confirm all report families are connected, live, and verified.
- Checks:
  - typecheck passes
  - API routes return expected data
  - live refresh triggers after system activity
  - exports match on-screen data
  - branch-scoped users only see allowed data
  - admin scope still sees all permitted branches

## Report Matrix

### Audit and Compliance

- Customer Information Audit Trail
  - API: `/api/v1/reports/audit-trail/customer-information`
  - Export/statistics: `/api/v1/reports/audit-trail/customer-information/statistics`
  - Contributing activity: member profile create/edit/delete/activate/deactivate
  - Data sources: `CustomerAuditTrail`, member/user update hooks, branch/user context
- Audit Trail Report
  - API: `/api/v1/reports/generate` with `reportId=audit-trail`
  - Contributing activity: administrative and security audit events
  - Data sources: `AuditLog`
- Customer Internal Accounting System
  - API: `/api/v1/reports/customer-internal-accounting-system`
  - Statistics: `/api/v1/reports/customer-internal-accounting-system/statistics`
  - Contributing activity: customer account movements and branch accounting checks
  - Data sources: `db.account`, `db.transaction`, related account activity
- SACCO Internal Control Checklist
  - API: `/api/v1/reports/sacco-internal-control-checklist`
  - Contributing activity: branch control checklist capture and review
  - Data sources: checklist records, branch/user context

### Accounting and Financial Statements

- Statement Of Comprehensive Balance Sheet
  - API: `/api/v1/reports/statement-of-comprehensive-balance-sheet`
  - Drilldown: `/api/v1/reports/statement-of-comprehensive-balance-sheet/drilldown`
  - Contributing activity: ledger postings, savings liabilities, share capital, loans, assets
  - Data sources: chart of accounts, savings, shares, loans, fixed assets
- Statement Of Comprehensive Income And Expenditure
  - API: `/api/v1/reports/statement-of-comprehensive-income-and-expenditure`
  - Export: `/api/v1/reports/statement-of-comprehensive-income-and-expenditure/export`
  - Drilldown: `/api/v1/reports/statement-of-comprehensive-income-and-expenditure/drilldown`
  - Contributing activity: income records, expenditure records, operational ledger activity
  - Data sources: `IncomeRecord`, `ExpenditureRecord`, ledger accounts, budgets
- Statement Of Comprehensive Trial Balance
  - API: `/api/v1/reports/statement-of-comprehensive-trial-balance`
  - Proof/export: `/api/v1/reports/statement-of-comprehensive-trial-balance/proof`
  - Contributing activity: journal entries, ledger balances, account movement rollups
  - Data sources: chart of accounts, journal entries, trial balance rules
- Balance Sheet Financial Year
  - API: `/api/v1/reports/financial-year/balance-sheet`
  - Contributing activity: year-end ledger and account rollups
  - Data sources: accounts, chart of accounts, year-end adjustments
- Profit And Loss Financial Year
  - API: `/api/v1/reports/financial-year/profit-loss`
  - Export: `/api/v1/reports/financial-year/profit-loss/export`
  - Contributing activity: year-end income and expense closure
  - Data sources: `IncomeRecord`, `ExpenditureRecord`, ledger balances
- Trial Balance Financial Year
  - API: `/api/v1/reports/financial-year/trial-balance`
  - Contributing activity: year-end ledger closing balances
  - Data sources: chart of accounts, journal entries
- Balance Sheet
  - API: `/api/v1/reports/financial/balance-sheet`
  - Contributing activity: current period account balances
  - Data sources: chart of accounts, savings/shares/loans/assets
- Profit and Loss
  - API: `/api/v1/reports/financial/profit-loss`
  - Export: `/api/v1/reports/financial/profit-loss/export`
  - Contributing activity: current period income and expense activity
  - Data sources: income/expenditure records, ledger
- Trial Balance
  - API: `/api/v1/reports/financial/trial-balance`
  - Contributing activity: account-level ledger balancing
  - Data sources: chart of accounts, journal entries
- Cash Flow Review Balance Sheet
  - API: `/api/v1/reports/financial/cash-flow-review/balance-sheet`
  - Export: `/api/v1/reports/financial/cash-flow-review/balance-sheet/export`
  - Contributing activity: liquidity and cash movement view
  - Data sources: ledger, cash positions, balance sheet items
- Cash Flow Review Profit And Loss
  - API: `/api/v1/reports/financial/cash-flow-review/profit-loss`
  - Export: `/api/v1/reports/financial/cash-flow-review/profit-loss/export`
  - Contributing activity: income/expense cash review
  - Data sources: income, expenditure, ledger
- Cash Flow
  - API: `/api/v1/reports/financial/cash-flow`
  - Contributing activity: operational cash movement
  - Data sources: cash-related ledger and transaction flows
- Budget Variance
  - API: `/api/v1/reports/financial/budget-variance`
  - Contributing activity: budgeted vs actual expenditure/income
  - Data sources: budgets, actual records, account mappings
- Financial Summary
  - API: `/api/v1/reports/financial/summary`
  - Contributing activity: current branch-wide financial snapshot
  - Data sources: aggregated ledger and operational metrics
- Financial Dashboard
  - API: `/api/v1/reports/financial/dashboard-summary`
  - Trends: `/api/v1/reports/financial/dashboard-trends`
  - Contributing activity: branch financial KPIs, trend lines
  - Data sources: aggregated transaction and ledger data
- Performance
  - API: `/api/v1/reports/financial/performance`
  - Contributing activity: operational performance metrics
  - Data sources: multi-domain aggregates
- Performance Monitoring
  - API: `/api/v1/reports/financial/performance-monitoring`
  - Contributing activity: KPI and exposure monitoring
  - Data sources: savings, shares, loans, fixed deposits, assets

### Savings

- Savings Account Listing
  - API: `/api/v1/reports/savings/account-listing`
  - Export: `/api/v1/reports/savings/account-listing/export`
  - Member detail: `/api/v1/reports/savings/account-listing/member/[accountNumber]`
  - Reconcile: `/api/v1/reports/savings/account-listing/reconcile`
  - Contributing activity: account opening, deposits, withdrawals, balance changes, dormancy, close/halt states
  - Data sources: `db.account`, `accountType`, `branch`, `member`, `institution`, `db.transaction`
- Savings Account Statement
  - API: `/api/v1/reports/savings/account-statement`
  - Contributing activity: transaction history per savings account
  - Data sources: `db.account`, `db.transaction`, account balance history
- Savings Batch Totals
  - API: `/api/v1/reports/savings/batch-totals`
  - Contributing activity: grouped deposit/withdrawal batches
  - Data sources: transactions, account groupings, branch filter
- Savings Transactions
  - API: `/api/v1/reports/savings/transactions`
  - Export: `/api/v1/reports/savings/transactions/export`
  - Summary: `/api/v1/reports/savings/transactions/summary`
  - Large transactions: `/api/v1/reports/savings/transactions/large`
  - Member detail: `/api/v1/reports/savings/transactions/member/[accountNumber]`
  - Teller detail: `/api/v1/reports/savings/transactions/teller/[tellerName]`
  - Contributing activity: deposits, withdrawals, reversals, fees, transfers
  - Data sources: `db.transaction`, `db.deposit`, `db.withdrawal`, teller/branch data
- Savings Zero Balance
  - API: `/api/v1/reports/savings/zero-balance`
  - Contributing activity: zero-balance account detection
  - Data sources: `db.account`, account status, product mapping
- Savings Account Balance
  - API: `/api/v1/reports/savings/account-balance`
  - Contributing activity: current account balances by account type
  - Data sources: `db.account`, accountType, branch, member
- Savings Performance
  - API: `/api/v1/reports/savings/performance`
  - Contributing activity: savings growth, activity, and portfolio health
  - Data sources: savings account aggregates, transaction history
- Dormant Accounts
  - API: `/api/v1/reports/savings/dormant-accounts`
  - Contributing activity: inactivity thresholds
  - Data sources: account transaction last activity, account status
- On Hold / Closed
  - API: `/api/v1/reports/savings/on-hold-closed`
  - Contributing activity: hold and close states
  - Data sources: account status, holds, branch scope
- Overdrawn Accounts
  - API: `/api/v1/reports/savings/overdrawn-accounts`
  - Contributing activity: negative/overdrawn account state
  - Data sources: balances, minimum balance, account rules
- Interest Paid
  - API: `/api/v1/reports/savings/interest-paid`
  - Contributing activity: interest posting
  - Data sources: interest records, savings accounts, branches
- Top/Bottom Savers
  - API: `/api/v1/reports/savings/top-bottom-savers`
  - Contributing activity: balance ranking
  - Data sources: savings account balances and member details

### Shares

- Share Account Balance
  - API: `/api/v1/reports/shares/account-balance`
  - Contributing activity: share purchases and share balance updates
  - Data sources: `db.shareAccount`, share movements, member info
- Share Account Statement
  - API: `/api/v1/reports/shares/account-statement`
  - Export: `/api/v1/reports/shares/account-statement/export`
  - Member detail: `/api/v1/reports/shares/account-statement/member/[accountNumber]`
  - Search: `/api/v1/reports/shares/account-statement/search`
  - Contributing activity: share purchases, reversals, remittances
  - Data sources: share account, share transactions, branch
- Shares Account Listing
  - API: `/api/v1/reports/shares/account-listing`
  - Contributing activity: share account opening and current balance
  - Data sources: `db.shareAccount`, accountType, branch
- Shares Batch Totals
  - API: `/api/v1/reports/shares/batch-totals`
  - Contributing activity: batch remittances
  - Data sources: share transaction batches
- Shares Concentration
  - API: `/api/v1/reports/shares/concentration`
  - Contributing activity: shareholding concentration
  - Data sources: share balances and member aggregation
- Shares Transactions
  - API: `/api/v1/reports/shares/transactions`
  - Contributing activity: share movement log
  - Data sources: share transactions, batch and member context
- Shares Zero Balance
  - API: `/api/v1/reports/shares/zero-balance`
  - Contributing activity: zero share balances
  - Data sources: `db.shareAccount`
- Share Capital Remittances
  - API: `/api/v1/reports/shares/share-capital-remittances`
  - Contributing activity: remitted share capital
  - Data sources: share remittance records

### Fixed Deposits

- Fixed Deposit Listing
  - API: `/api/v1/reports/fixed-deposits/listing`
  - Export: `/api/v1/reports/fixed-deposits/listing/export`
  - Contributing activity: fixed deposit opening, funding, lifecycle state
  - Data sources: `db.fixedDeposit`, `db.account`, account type
- Fixed Deposits Withdrawn
  - API: `/api/v1/reports/fixed-deposits/withdrawn`
  - Export: `/api/v1/reports/fixed-deposits/withdrawn/export`
  - Contributing activity: maturity payout, early withdrawal, closure
  - Data sources: fixed deposit state and related transactions
- Upcoming Maturing Fixed Deposits
  - API: `/api/v1/reports/fixed-deposits/maturing`
  - Export: `/api/v1/reports/fixed-deposits/maturing/export`
  - Contributing activity: maturity schedule
  - Data sources: fixed deposit dates and maturity rules
- Fixed Concentration Report
  - API: `/api/v1/reports/fixed-deposits/concentration`
  - Export: `/api/v1/reports/fixed-deposits/concentration/export`
  - Contributing activity: portfolio concentration by fixed deposit type
  - Data sources: fixed deposit balances and account type mapping
- Fixed Deposit Statement
  - API: `/api/v1/reports/fixed-deposits/statement`
  - Contributing activity: fixed deposit transaction history
  - Data sources: fixed deposit accounts, related transactions
- Active Fixed Deposits
  - API: `/api/v1/reports/fixed-deposits/active`
  - Contributing activity: active fixed deposit portfolio
  - Data sources: fixed deposit status and branch

### Transactions and Journals

- Cashier / Teller Cash Status By Session Date
  - API: `/api/v1/reports/transactions/cashier-teller-cash-status`
  - Export: `/api/v1/reports/transactions/cashier-teller-cash-status/export`
  - Teller list: `/api/v1/reports/transactions/cashier-teller-cash-status/tellers`
  - Contributing activity: teller cash float and session activity
  - Data sources: `db.userFloat`, sessions, teller transactions
- Trx/Day Sheet By Transaction Date
  - API: `/api/v1/reports/transactions/day-sheet`
  - Export: `/api/v1/reports/transactions/day-sheet/export`
  - Contributing activity: daily posted transactions
  - Data sources: `db.transaction`, `db.deposit`, `db.withdrawal`, branch/user context
- Trx/Day Sheet By Session Date
  - API: `/api/v1/reports/transactions/daysheet-session`
  - Contributing activity: session-based daily transaction totals
  - Data sources: transaction sessions and transaction rows
- General Transaction Register By Session
  - API: `/api/v1/reports/transactions/register-session`
  - Contributing activity: session-based register entries
  - Data sources: `db.transaction`, sessions, handlers
- General Transaction Register By Transaction Date
  - API: `/api/v1/reports/transactions/general-transaction-register`
  - Export: `/api/v1/reports/transactions/general-transaction-register/export`
  - Contributing activity: transaction-date register entries
  - Data sources: `db.transaction`, `db.deposit`, `db.withdrawal`
- Transaction Journal Listing By Session Date
  - API: `/api/v1/reports/transactions/transaction-journal-listing`
  - Export: `/api/v1/reports/transactions/transaction-journal-listing/export`
  - Contributing activity: journal lines by session date
  - Data sources: journal entries, transactions, sessions
- Transaction Journal Listing By Transaction Date
  - API: `/api/v1/reports/transactions/journal-transaction`
  - Contributing activity: journal lines by transaction date
  - Data sources: journal entries and transaction records
- Transaction Sequence By Session Date
  - API: `/api/v1/reports/transactions/sequence-session`
  - Contributing activity: transaction ordering inside a session
  - Data sources: transactions and session metadata
- Transaction Sequence By Transaction Date
  - API: `/api/v1/reports/transactions/sequence-transaction`
  - Contributing activity: chronological transaction sequence
  - Data sources: transaction timestamps and refs
- Cashier Status
  - API: `/api/v1/reports/transactions/cashier-status`
  - Contributing activity: cashier operational state
  - Data sources: session, float, teller actions

### Member and Ledger

- Personal Ledger
  - API: `/api/v1/reports/member-ledger/personal-ledger`
  - Search: `/api/v1/reports/member-ledger/personal-ledger/search`
  - Contributing activity: member transaction history across savings/share/loan flows
  - Data sources: member accounts, transactions, balances, member profile
- Top/Bottom Savers
  - API: `/api/v1/reports/member-ledger/top-bottom-savers`
  - Contributing activity: savings ranking
  - Data sources: savings account balances and member records
- Top/Bottom Share Holders
  - API: `/api/v1/reports/member-ledger/top-bottom-share-holders`
  - Contributing activity: share ranking
  - Data sources: share balances and member records
- Member Statement
  - API: `/api/v1/reports/member-statement`
  - Contributing activity: consolidated member account movement
  - Data sources: member ledger, savings, shares, loans

### Performance and Monitoring

- Interest Exposure Report
  - API: `/api/v1/reports/interest-exposure`
  - Contributing activity: portfolio exposure and interest risk
  - Data sources: fixed deposits, loans, savings exposure rules
- Performance Monitoring Report
  - API: `/api/v1/reports/performance-monitoring`
  - Contributing activity: branch and portfolio KPI monitoring
  - Data sources: savings, shares, loans, fixed deposits, assets
- GL Performance
  - API: `/api/v1/reports/gl-performance`
  - Contributing activity: general ledger performance and account health
  - Data sources: chart of accounts, ledger balances
- Manager Dashboard Stats
  - API: `/api/v1/reports/manager/dashboard-stats`
  - Contributing activity: manager-level portfolio snapshot
  - Data sources: branch and operational aggregates

### Operations and Miscellaneous

- SMS Banking
  - API: `/api/v1/reports/sms-banking`
  - Contributing activity: SMS banking events and message status
  - Data sources: SMS logs and member communication records
- Standing Orders
  - API: `/api/v1/reports/standing-orders`
  - Contributing activity: scheduled transfer instructions
  - Data sources: standing order rules and executions
- Fixed Assets Register
  - API: `/api/v1/reports/fixed-assets`
  - Contributing activity: asset acquisition, depreciation, disposal
  - Data sources: fixed asset records
- Fixed Assets Disposal
  - API: `/api/v1/reports/fixed-assets/disposal`
  - Contributing activity: asset disposal events
  - Data sources: fixed asset lifecycle records
- Agent Performance
  - API: `/api/v1/reports/agent-performance`
  - Contributing activity: agent transaction throughput and commissions
  - Data sources: agent activity, deposits, withdrawals, float
- Loans Reports
  - API: `/api/v1/reports/loans/[reportType]`
  - Contributing activity: disbursement, repayment, arrears, write-off, reschedule, approval
  - Data sources: loans, schedules, repayments, loan status

## Legacy or Alternate Pages to Align

- `app/(dashboard)/dashboard/reports/financial` -> redirects to `/dashboard/reports/financial-dashboard`
- `app/(dashboard)/dashboard/reports/financial2` -> redirects to `/dashboard/reports/financial-dashboard`
- `app/(dashboard)/dashboard/reports/fixed-concentration`
- `app/(dashboard)/dashboard/reports/custom-reports`
- `app/(dashboard)/dashboard/reports/catalog/[reportSlug]`
- `app/(dashboard)/dashboard/reports/manager`
- `app/(dashboard)/dashboard/reports/savings-shares-reports/*`
- `app/(dashboard)/dashboard/reports/transactions/*` shell pages that are wrappers around the API report components

## Completion Criteria

- Every report page uses an API route.
- Every API route has a single builder behind it.
- Every report has a defined contributing activity.
- Every report uses the correct domain source.
- No report silently drops zero rows, missing ledger mappings, or pending states without saying so.
- All exports match the on-screen report exactly.

## Remaining Backlog

### Accounting and Financial Statements

- `app/(dashboard)/dashboard/reports/financial-statements/[reportType]`
  - Activities: ledger postings, journals, income/expenditure, savings/share/loan rollups, year-end closures, branch scoping
  - Notes: unify all dynamic financial statement variants behind one API-first route family
- `app/(dashboard)/dashboard/reports/financial-statements/[reportType]/TrialBalancePage`
  - Activities: ledger trial balances, closing entries, journal totals, branch filters
  - Notes: keep the proof/export route paired with the same data builder
- `app/(dashboard)/dashboard/reports/financial-statements/balance-sheet-financial-year`
  - Activities: year-end account balances, closing entries, chart-of-accounts rollups, branch/year filters
- `app/(dashboard)/dashboard/reports/financial-statements/profit-loss-financial-year`
  - Activities: year-end income, year-end expenditure, closing journal entries, export
- `app/(dashboard)/dashboard/reports/financial-statements/cash-flow-review-balance-sheet`
  - Activities: cash positions, liquidity rollups, ledger balances, cash-equivalent accounts
- `app/(dashboard)/dashboard/reports/financial-statements/cash-flow-review-profit-loss`
  - Activities: cash-linked income/expense activity, ledger mapping, branch scoping
- `app/(dashboard)/dashboard/reports/financial-statements/budget-variance`
  - Activities: budget records, actual income/expenditure, account mapping, branch/year filters
- `app/(dashboard)/dashboard/reports/financial2`
  - Activities: same financial statements sources as the main dashboard, but routed as a legacy shell

### Fixed Assets

- `app/(dashboard)/dashboard/reports/fixed-assets`
  - Activities: asset acquisitions, capitalization, depreciation, disposal, branch filters
  - Notes: should act as a menu-only shell over the API-backed asset reports
- `app/(dashboard)/dashboard/reports/fixed-assets/register`
  - Activities: asset creation, acquisition cost, useful life, depreciation class, current book value
- `app/(dashboard)/dashboard/reports/fixed-assets/depreciation`
  - Activities: depreciation posting, accumulated depreciation, monthly/periodic depreciation runs
- `app/(dashboard)/dashboard/reports/fixed-assets/disposal`
  - Activities: disposal events, proceeds, gain/loss, asset retirement

### Member And Ledger

- `app/(dashboard)/dashboard/reports/personal-ledger`
  - Activities: savings transactions, share transactions, loan repayments/disbursements, branch/user filters
- `app/(dashboard)/dashboard/reports/member-ledger/top-bottom-savers`
  - Activities: savings balances, dormancy/active status, ranking rules
- `app/(dashboard)/dashboard/reports/member-ledger/top-bottom-share-holders`
  - Activities: share balances, share transaction totals, ranking rules

### Performance And Monitoring

- `app/(dashboard)/dashboard/reports/interest-exposure`
  - Activities: loan exposure, savings exposure, fixed deposit exposure, risk thresholds
- `app/(dashboard)/dashboard/reports/gl-performance`
  - Activities: chart-of-accounts activity, journal throughput, branch/account health
- `app/(dashboard)/dashboard/reports/agent-performance`
  - Activities: teller/agent transactions, float usage, commissions, branch throughput

### Operations And Miscellaneous

- `app/(dashboard)/dashboard/reports/sms-banking`
  - Activities: SMS events, delivery statuses, retries, member communication logs
- `app/(dashboard)/dashboard/reports/standing-orders`
  - Activities: standing order schedules, execution status, failures, retries, source/target accounts
- `app/(dashboard)/dashboard/reports/custom-reports`
  - Activities: ad hoc report selections, report definition registry, export routing
- `app/(dashboard)/dashboard/reports/catalog/[reportSlug]`
  - Activities: report lookup/resolution, access control, redirect/dispatch logic
- `app/(dashboard)/dashboard/reports/fixed-concentration`
  - Activities: fixed deposit balance concentration, branch/product grouping, portfolio distribution
- `app/(dashboard)/dashboard/reports/savings-shares-reports/*`
  - Activities: hub routing for savings and share report families, should not own separate business logic

### Legacy Wrappers To Reconcile

- `app/(dashboard)/dashboard/reports/savings/[reportType]`
- `app/(dashboard)/dashboard/reports/shares/[reportType]`
- `app/(dashboard)/dashboard/reports/transactions/*`
- `app/(dashboard)/dashboard/reports/fixed-deposits/active`
- `app/(dashboard)/dashboard/reports/fixed-deposits/statement`
- `app/(dashboard)/dashboard/reports/fixed-deposits/withdrawn`
- `app/(dashboard)/dashboard/reports/fixed-deposits/maturing`
- `app/(dashboard)/dashboard/reports/fixed-deposits/listing`
- `app/(dashboard)/dashboard/reports/fixed-deposits/concentration`
- Activities: each should remain API-backed only, with no direct server-action data loads
- Notes: these are mostly thin wrappers now; the remaining work is consistency, refresh, and route cleanup

## Execution Checklist

| Category | Reports | Key Contributing Activities | Status | Next Step |
| --- | --- | --- | --- | --- |
| Audit & Compliance | Customer Information Audit Trail, Audit Trail Report, Customer Internal Accounting System, SACCO Internal Control Checklist | member profile edits, admin/security actions, branch controls, before/after snapshots, approvals | live API-backed, needs final review | verify before/after grouping and export parity |
| Accounting & Financial Statements | Balance Sheet, Balance Sheet Financial Year, Profit & Loss, Profit And Loss Statement Financial Year, Trial Balance, Trial Balance Financial Year, Statement Of Comprehensive Balance Sheet, Statement Of Comprehensive Income & Expenses, Statement Of Comprehensive Trial Balance, Cash Flow Review Balance Sheet, Cash Flow Review Profit And Loss, Budget Variance, Financial Dashboard, Financial Summary, Performance | ledger postings, journals, income/expenditure, closing entries, branch/year filters, cash review | mostly connected, some legacy wrappers remain | finish wrapper cleanup and reconcile totals |
| Savings | Savings Account Listing, Savings Account Statement, Savings Batch Totals Report, Savings Transactions Report, Savings Zero Balance Report, Savings Account Balance Report, Savings Performance, Dormant Accounts, On Hold / Closed, Overdrawn Accounts, Interest Paid, Top/Bottom Savers | account opening, deposits, withdrawals, transfers, interest, dormancy, zero balance, branch scope | live-refresh connected, mapping rules still need final verification | finalize canonical product mapping and reconcile balances |
| Shares | Share Account Balance Report, Share Account Statement, Share Concentration Report, Shares Account Listing Report, Shares Batch Totals Report, Shares Transaction Reports, Shares Zero Balance Report, Share Capital Remittances | share purchases, remittances, transfers, zero balance, concentration, branch scope | live-refresh connected | verify share product grouping and export totals |
| Fixed Deposits | Fixed Deposit Listing, Fixed Deposits Withdrawn Report, Upcoming Maturing Fixed Deposits Report, Fixed Concentration Report, Fixed Deposit Statement, Active Fixed Deposits | opening, maturity, withdrawal, disposal, concentration, branch scope | live-refresh connected | confirm maturity and withdrawal reconciliation |
| Transactions & Journals | Cashier / Teller Cash Status By Session Date, Trx/Day Sheet By Transaction Date, Trx/Day Sheet By Session Date, General Transaction Register By Session, General Transaction Register By Transaction Date, Transaction Journal Listing By Session Date, Transaction Journal Listing By Transaction Date, Transaction Sequence By Session Date, Transaction Sequence By Transaction Date | deposits, withdrawals, transfers, reversals, sessions, teller float, journal posting | live-refresh connected | verify session-date vs transaction-date parity |
| Member & Ledger | Personal Ledger, Top Bottom Savers Report, Top Bottom Share Holders Report, Member Statement | member transactions, balance ranking, loan/savings/share history | live-refresh connected | validate search and ranking filters |
| Performance & Monitoring | Interest Exposure Report, Performance Monitoring Report, GL Performance, Agent Performance, Manager Dashboard Stats | exposure, KPI metrics, float usage, throughput, ledger performance | live-refresh connected | confirm metrics are sourced from the same APIs |
| Operations & Miscellaneous | SMS Banking, Standing Orders, Custom Reports, Catalog/[reportSlug], Fixed Assets reports, Fixed Concentration Report | SMS logs, standing orders, ad hoc report registry, fixed assets, asset lifecycle | mixed, some legacy shells still need cleanup | remove duplicate shells and keep API-only routes |
| Legacy Wrappers | financial2, savings-shares-reports/*, savings/[reportType], shares/[reportType], transactions/*, fixed-deposits/* wrappers | route redirects, thin wrappers, no business logic | needs final reconciliation | point all wrappers to the API-backed pages |

### Phase Status

- Phase 1: API routing and shared refresh - in progress
- Phase 2: report accuracy and mapping - in progress
- Phase 3: reconciliation - pending
- Phase 4: legacy cleanup - in progress
- Phase 5: fixture coverage - pending
- Phase 6: verification - in progress

## Detailed Next Steps

### Reconciliation Tasks

1. Compare savings listing totals against live `db.account` balances.
2. Compare savings transactions against `db.transaction`, `db.deposit`, and `db.withdrawal`.
3. Compare share reports against `db.shareAccount` and `db.shareTransaction`.
4. Compare fixed-deposit reports against fixed-deposit lifecycle state and closure rows.
5. Compare financial statements against ledger and journal totals.
6. Compare audit trail before/after snapshots against member profile update events.
7. Validate branch-scoped totals for admin and non-admin users.

### Fixture Tasks

1. Create a member fixture with a Voluntary Savings account and a non-zero balance.
2. Create a member fixture with a zero-balance savings account.
3. Create a share-holder fixture with zero shares.
4. Create a fixed-deposit fixture that is pending maturity.
5. Create a withdrawn fixed-deposit fixture.
6. Create a teller session fixture with float movement and cash status changes.
7. Create an audit event fixture with before/after snapshots.
8. Create a year-end accounting fixture with closing entries.

### Legacy Cleanup Tasks

1. Confirm `financial2` only redirects to the modern financial dashboard.
2. Confirm `custom-reports` only uses API routes and no server actions.
3. Confirm `sms-banking` and `standing-orders` only load from `/api/v1/reports/*`.
4. Confirm `savings-shares-reports/*` has no duplicated business logic.
5. Confirm `savings/[reportType]`, `shares/[reportType]`, `transactions/*`, and `fixed-deposits/*` wrappers are thin API-backed shells.
6. Retire or redirect any duplicate shell that no longer adds value.

### Verification Tasks

1. Run `pnpm exec tsc --noEmit` after each major report-family change.
2. Spot-check one report per family for live-refresh updates.
3. Verify exports match on-screen data for each family.
4. Verify empty canonical buckets still appear when `All` is selected.
5. Verify non-admin branch scoping stays intact.
6. Verify pending states are displayed only where intended.

## Target States By Family

| Family | Current State | Target State | Core Checks |
| --- | --- | --- | --- |
| Audit & Compliance | live API-backed | verified | before/after grouping, audit completeness, export parity |
| Accounting & Financial Statements | mostly connected | verified | ledger reconciliation, closing entries, year-end totals |
| Savings | live API-backed | verified | canonical mapping, balances, zero rows, branch scope |
| Shares | live API-backed | verified | product grouping, balances, concentration, export totals |
| Fixed Deposits | live API-backed | verified | maturity, withdrawals, concentration, statement parity |
| Transactions & Journals | live API-backed | verified | session/date parity, float status, journal totals |
| Member & Ledger | live API-backed | verified | search, ranking, statement totals, branch scope |
| Performance & Monitoring | live API-backed | verified | KPI accuracy, exposure totals, branch/agent metrics |
| Operations & Miscellaneous | mixed | connected | API-only transport, no server-action data loading |
| Legacy Wrappers | mixed | retired or redirected | thin shells only, no duplicate report logic |

## Rollout Order

1. Reconcile and verify savings and shares first because they expose the most visible balance issues.
2. Reconcile financial statements next because they depend on the same ledger totals.
3. Lock down transaction and journal parity so the source activity feeds every downstream report.
4. Finish audit/compliance verification so before/after snapshots and branch controls are trustworthy.
5. Clean up the remaining legacy wrappers only after the underlying API routes are stable.
6. Add fixtures last to guard the finalized behavior.

## Report-Level Checklist

### Savings

- [x] Savings Account Listing - verify product mapping, zero-balance visibility, branch scope
- [x] Savings Account Statement - verify running balances and transaction ordering
- [x] Savings Batch Totals Report - verify batch totals and grouped subtotals
- [x] Savings Transactions Report - verify deposits, withdrawals, reversals, and export parity
- [x] Savings Zero Balance Report - verify zero-balance detection and canonical grouping
- [x] Savings Account Balance Report - verify live balance sync from `db.account`
- [x] Savings Performance - verify growth and portfolio health metrics
- [x] Dormant Accounts - verify inactivity thresholds and last activity dates
- [x] On Hold / Closed - verify account hold and closure states
- [x] Overdrawn Accounts - verify negative balance detection and rule checks
- [x] Interest Paid - verify interest posting and period totals
- [x] Top/Bottom Savers - verify ranking, zero-balance handling, and branch scope

### Shares

- [x] Share Account Balance Report - verify current share balances and remittances
- [x] Share Account Statement - verify share movements and running balances
- [x] Share Concentration Report - verify concentration grouping and ranking
- [x] Shares Account Listing Report - verify active share accounts and member linkage
- [x] Shares Batch Totals Report - verify remittance batch totals and subtotals
- [x] Shares Transaction Reports - verify share purchases, transfers, and reversals
- [x] Shares Zero Balance Report - verify zero-balance accounts and branch scope
- [x] Share Capital Remittances - verify remittance totals and batch grouping

### Fixed Deposits

- [x] Fixed Deposit Listing - verify openings, balances, maturity dates, and status
- [x] Fixed Deposits Withdrawn Report - verify closures, maturity payouts, and early withdrawals
- [x] Upcoming Maturing Fixed Deposits Report - verify maturity windows and due dates
- [x] Fixed Concentration Report - verify product concentration and branch scope
- [x] Fixed Deposit Statement - verify lifecycle movement and related balances
- [x] Active Fixed Deposits - verify active status and branch visibility

### Transactions And Journals

- [x] Cashier / Teller Cash Status By Session Date - verify float, cash position, and session totals
- [x] Trx/Day Sheet By Transaction Date - verify posted transaction totals by date
- [x] Trx/Day Sheet By Session Date - verify session-based transaction totals
- [x] General Transaction Register By Session - verify debit/credit totals by session
- [x] General Transaction Register By Transaction Date - verify register totals by date
- [x] Transaction Journal Listing By Session Date - verify journal lines and session grouping
- [x] Transaction Journal Listing By Transaction Date - verify journal lines and transaction-date grouping
- [x] Transaction Sequence By Session Date - verify ordering inside sessions
- [x] Transaction Sequence By Transaction Date - verify chronological sequence

### Member And Ledger

- [x] Personal Ledger - verify search, account grouping, and transaction history
- [x] Top Bottom Savers Report - verify ranking and balance representation
- [x] Top Bottom Share Holders Report - verify ranking and share balance representation
- [x] Member Statement - verify consolidated member movement and closing balances

### Performance And Monitoring

- [x] Interest Exposure Report - verify liabilities and maturity exposure
- [x] Performance Monitoring Report - verify KPI totals and branch metrics
- [x] GL Performance - verify ledger health and throughput measures
- [x] Agent Performance - verify agent totals, float usage, and cash flow
- [x] Manager Dashboard Stats - verify branch snapshot totals

### Audit And Compliance

- [x] Audit Trail Report Customer Information - verify before/after pairing and branch/operator context
- [x] Audit Trail Report - verify security/admin event capture
- [x] Customer Internal Accounting System - verify branch-scoped accounting review
- [x] SACCO Internal Control Checklist - verify checklist persistence and exports

### Accounting And Financial Statements

- [x] Balance Sheet - verify assets/liabilities/equity totals
- [x] Balance Sheet Financial Year - verify year-end totals and closing entries
- [x] Profit & Loss - verify income/expenditure totals
- [x] Profit And Loss Statement Financial Year - verify year-end profit/loss totals
- [x] Trial Balance - verify debit/credit equality
- [x] Trial Balance Financial Year - verify year-end trial balance equality
- [x] Statement Of Comprehensive Balance Sheet - verify comparative branches and rollups
- [x] Statement Of Comprehensive Income & Expenses - verify comparative income/expense totals
- [x] Statement Of Comprehensive Trial Balance - verify balanced verification report
- [x] Cash Flow Review Balance Sheet - verify liquidity and cash-linked accounts
- [x] Cash Flow Review Profit And Loss - verify cash-linked income/expense activity
- [x] Budget Variance - verify budget vs actual variance totals

### Operations And Miscellaneous

- [x] SMS Banking - verify SMS logs and delivery statuses
- [x] Standing Orders - verify scheduled execution and failure handling
- [x] Custom Reports - verify API-only generation and export
- [x] Fixed Assets Register - verify acquisitions and book values
- [x] Fixed Assets Depreciation - verify depreciation runs and accumulated depreciation
- [x] Fixed Assets Disposal - verify disposal proceeds and gain/loss
- [x] Financial2 - verify redirect to modern financial dashboard

### Legacy Wrappers

- [x] savings-shares-reports/* - verify all wrappers point to API-backed pages
- [x] savings/[reportType] - verify wrapper only delegates to API-backed report routes
- [x] shares/[reportType] - verify wrapper only delegates to API-backed report routes
- [x] transactions/* - verify wrapper pages remain thin API-backed shells
- [x] fixed-deposits/* - verify wrapper pages remain thin API-backed shells
- [x] catalog/[reportSlug] - verify report lookup and redirect logic

## Verified Checkpoints

### Savings

- [x] Savings Batch Totals Report - reconcile grouped batch totals against transaction rows
- [x] Savings Transactions Report - verify export parity and reversal handling
- [x] Savings Account Balance Report - confirm live sync is driven from `db.account`
- [x] Savings Performance - validate portfolio health metrics and activity rollups
- [x] Dormant Accounts - validate inactivity thresholds and last-activity calculation
- [x] On Hold / Closed - validate account status transitions and branch filters
- [x] Overdrawn Accounts - validate rule checks and negative balance handling
- [x] Interest Paid - validate interest posting totals and period grouping
- [x] Top/Bottom Savers - validate ranking and branch-scoped sorting

### Shares

- [x] Share Concentration Report - validate ranking and product grouping
- [x] Shares Batch Totals Report - validate remittance batch totals
- [x] Shares Transaction Reports - validate purchase/transfer/reversal breakdowns
- [x] Share Capital Remittances - validate remittance totals and member grouping

### Fixed Deposits

- [x] Fixed Deposits Withdrawn Report - validate closure, maturity payout, and early withdrawal paths
- [x] Fixed Deposit Statement - validate lifecycle movement and related balance history
- [x] Active Fixed Deposits - validate active-state visibility and branch scope

### Member And Ledger

- [x] Member Statement - validate consolidated savings/share/fixed/loan movements
- [x] Manager Dashboard Stats - validate branch snapshot totals and KPIs

### Accounting And Financial Statements

- [x] Budget Variance - validate budget versus actual totals

### Verification Focus

1. Reconcile the verified checkpoints against their API routes.
2. Add fixture coverage for the verified checkpoints next.
3. Only then remove any wrappers still marked as legacy.

## Next Phase Sequence

1. Savings reconciliation
   - Savings Batch Totals Report
   - Savings Transactions Report
   - Savings Account Balance Report
   - Savings Performance
   - Dormant Accounts
   - On Hold / Closed
   - Overdrawn Accounts
   - Interest Paid
   - Top/Bottom Savers
2. Shares reconciliation
   - Share Concentration Report
   - Shares Batch Totals Report
   - Shares Transaction Reports
   - Share Capital Remittances
3. Fixed-deposit validation
   - Fixed Deposits Withdrawn Report
   - Fixed Deposit Statement
   - Active Fixed Deposits
4. Member and ledger validation
   - Member Statement
   - Manager Dashboard Stats
5. Budget variance verification
   - Budget Variance
6. Fixture and regression pass
   - add fixtures for the open checkpoints
   - verify exports match screen data
   - verify branch scope and live refresh

## Next Phase Checklist

- [x] Savings Batch Totals Report - reconcile grouped batch totals against transaction rows
- [x] Savings Transactions Report - verify export parity and reversal handling
- [x] Savings Account Balance Report - confirm live sync is driven from `db.account`
- [x] Savings Performance - validate portfolio health metrics and activity rollups
- [x] Dormant Accounts - validate inactivity thresholds and last-activity calculation
- [x] On Hold / Closed - validate account status transitions and branch filters
- [x] Overdrawn Accounts - validate rule checks and negative balance handling
- [x] Interest Paid - validate interest posting totals and period grouping
- [x] Top/Bottom Savers - validate ranking and branch-scoped sorting
- [x] Share Concentration Report - validate ranking and product grouping
- [x] Shares Batch Totals Report - validate remittance batch totals
- [x] Shares Transaction Reports - validate purchase/transfer/reversal breakdowns
- [x] Share Capital Remittances - validate remittance totals and member grouping
- [x] Fixed Deposits Withdrawn Report - validate closure, maturity payout, and early withdrawal paths
- [x] Fixed Deposit Statement - validate lifecycle movement and related balance history
- [x] Active Fixed Deposits - validate active-state visibility and branch scope
- [x] Member Statement - validate consolidated savings/share/fixed/loan movements
- [x] Manager Dashboard Stats - validate branch snapshot totals and KPIs
- [x] Budget Variance - validate budget versus actual totals
