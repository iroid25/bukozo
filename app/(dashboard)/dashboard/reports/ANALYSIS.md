# Reports Mismatch & Integration Analysis

This analysis examines the connection between the **Core Banking / SACCO Transaction Functionality** and the **Reports Dashboard** (`/dashboard/reports`) to identify data disconnects, missing fallbacks, and schema discrepancies.

---

## 🔍 Core Architectural Findings

The application still has a few parallel model families, but most high-value reports now read from live operational sources rather than stale legacy tables:
1. **Active Core Models** (Updated during teller operations and active banking features):
   - `Transaction` (general transactions: deposits, withdrawals, transfers)
   - `Deposit` (specific deposit meta-details)
   - `Withdrawal` (specific withdrawal meta-details)
   - `UserFloat` / `FloatTransaction` (teller drawer balances and daily allocations)
   - `FixedAsset` (registered assets)
   - `JournalEntry` (double-entry accounting ledger entries populated via transfers, withdrawals, loan processing, etc.)
   
2. **Extended / legacy reporting models**:
   - `SavingsAccount` & `SavingsTransaction`
   - `ShareAccount` & `ShareTransaction`
   - `TransactionSession` (for cashier/teller sessions)
   - `StandingOrder` & `StandingOrderExecution`
   - `SmsLog` (SMS notifications)
   - `AssetDepreciation` (asset depreciation periods)

Some of these models are still legacy-only, but not all of them are empty. The active share module writes to `ShareAccount` / `ShareTransaction`, the savings balance reports now read from the core `Account` table, and loan-related income now flows through a unified source that includes direct `IncomeRecord` rows plus loan-related fallbacks when needed.

---

## 🚨 The 5 Major Disconnects

### 1. Teller Session Reports (`TransactionSession` vs. `UserFloat`)
- **Queries:** `db.transactionSession` in the legacy analysis, but the live transaction reports now read from `Transaction` and `FloatTransaction` where appropriate.
- **Actual System Behavior:** Tellers open their day and manage floats using the `UserFloat`, `FloatAllocation`, and `FloatReconciliation` models. The old `TransactionSession` model is still not populated by the main teller flow.
- **Impact:** The session-named reports are better treated as legacy wrappers. The float-based cash-status logic now works, but any report still depending on `TransactionSession` directly remains empty.

### 2. Savings Reports
- **Queries:** `Account` for balances and statements, `Transaction` for activity, and `SavingsTransaction` only in older history paths.
- **Actual System Behavior:** The core `Account` table is the source of truth for savings balances, and the dedicated balance/zero-balance reports already read from `Account`.
- **Impact:** Savings balance and statement reporting is connected. The only remaining caution is older transaction-history pages that may still prefer `SavingsTransaction` when it exists.

### 3. Share Reports
- **Queries:** `ShareAccount` and `ShareTransaction`.
- **Actual System Behavior:** The share purchase, transfer, and reconciliation flows write to these tables, so share reports can be populated from live operations.
- **Impact:** Share account balance, statement, concentration, and transaction reports are connected.

### 4. SMS Banking Logs (`SmsLog`)
- **Queries:** `db.smsLog`.
- **Actual System Behavior:** The SMS sending service does not write logs to `SmsLog` table during alerts or notifications.
- **Impact:** The **SMS Banking Logs** report remains empty.

### 5. Standing Orders (`StandingOrder`)
- **Queries:** `db.standingOrder` and `db.standingOrderExecution`.
- **Actual System Behavior:** There is no active feature in the application that registers or schedules standing orders.
- **Impact:** The **Standing Orders** report is completely empty.

### 6. Fixed Assets Depreciation Schedules (`AssetDepreciation`)
- **Queries:** `db.fixedAsset` and `db.assetDepreciation`.
- **Actual System Behavior:** Fixed assets can be registered successfully (`createFixedAsset` creates `FixedAsset` rows and records the transaction in `JournalEntry`). However, there is no automated batch or manual execution that computes and writes depreciation rows to `AssetDepreciation`.
- **Impact:** The **Depreciation Schedule** report returns zero records.

---

## 📊 Report Integration Audit Table

Below is the status of the report endpoints and how they connect to active transactions:

| Report Name | Page Route | API Endpoint | DB Model Queried | Connection Status & Details |
| :--- | :--- | :--- | :--- | :--- |
| **Audit Trail (Customer Info)** | `/dashboard/reports/audit-trail/customer-information` | `/api/v1/reports/audit-trail/customer-information` | `CustomerAuditTrail` | **Fully Connected** (Raw SQL insertion matches user updates). |
| **General Audit Trail** | `/dashboard/reports/activity` | `/api/v1/reports/activity` | `AuditLog` | **Fully Connected** (Logged system actions). |
| **Customer Accounting System** | `/dashboard/reports/customer-internal-accounting-system` | `/api/v1/reports/customer-internal-accounting-system` | `Account`, `Deposit`, `Withdrawal`, `Loan` | **Fully Connected** (Direct links to core tables). |
| **Balance Sheet** | `/dashboard/reports/financial-statements/balance-sheet` | `/api/v1/reports/financial/balance-sheet` | `JournalEntry`, `ChartOfAccount` | **Fully Connected** (Double-entry entries recorded). |
| **Profit & Loss** | `/dashboard/reports/financial-statements/profit-loss` | `/api/v1/reports/financial/profit-loss` | `IncomeRecord`, `ExpenditureRecord`, loan-income fallbacks | **Fully Connected** (Loan-related income now rolls in from the unified income source). |
| **Trial Balance** | `/dashboard/reports/financial-statements/trial-balance` | `/api/v1/reports/financial/trial-balance` | `JournalEntry`, `ChartOfAccount` | **Fully Connected** (Ledger account balances). |
| **Statement of Comp. Balance Sheet** | `/dashboard/reports/statement-of-comprehensive-balance-sheet` | `/api/v1/reports/statement-of-comprehensive-balance-sheet` | `JournalEntry`, `ChartOfAccount` | **Fully Connected** (Ledger account balances). |
| **Savings Account Listing** | `/dashboard/reports/savings/savings-listing` | `/api/v1/reports/savings/account-listing` | `Account` (original model) | **Fully Connected** (Pulls accounts from core database). |
| **Savings Account Statement** | `/dashboard/reports/savings/savings-account-statement` | `/api/v1/reports/savings/account-statement` | `Account`, `Transaction` | **Fully Connected** (Pulls active transactions). |
| **Savings Transactions Report** | `/dashboard/reports/savings-shares-reports/savings` | `/api/v1/reports/savings/transactions` | `SavingsTransaction` / `Transaction` | **Partially Connected** (Uses `Transaction` fallback when the legacy table is empty). |
| **Savings Account Balances** | `/dashboard/reports/savings/savings-balances` | `/api/v1/reports/savings/account-balance` | `Account` | **Fully Connected** (Core savings balances live in `Account`). |
| **Savings Zero Balance** | `/dashboard/reports/savings/zero-balance` | `/api/v1/reports/savings/zero-balance` | `Account` | **Fully Connected** (Uses the core account table). |
| **Share Concentration** | `/dashboard/reports/savings-shares-reports/shares` | `/api/v1/reports/shares/concentration` | `ShareAccount` | **Connected** (Share module writes to `ShareAccount` and `ShareTransaction`). |
| **Shares Transaction Report** | `/dashboard/reports/shares/share-transactions` | `/api/v1/reports/shares/transactions` | `ShareTransaction` | **Connected** (Share module writes transaction rows directly). |
| **Maturing Fixed Deposits** | `/dashboard/reports/fixed-deposits/maturing` | `/api/v1/reports/fixed-deposits/maturing` | `FixedDeposit` | **Fully Connected** (FD operations write to this model). |
| **Cashier Teller Session Status** | `/dashboard/reports/transactions/cashier-teller-cash-status-by-session-date` | `/api/v1/reports/transactions/cashier-teller-cash-status` | `UserFloat`, `FloatTransaction` | **Connected** (Float-based status now drives the report). |
| **Trx/Day Sheet By Session** | `/dashboard/reports/transactions/trx-day-sheet-by-session-date` | `/api/v1/reports/transactions/daysheet-session` | `Transaction` / float bridge | **Connected enough for live data** (legacy session naming, but the data source is live transactions). |
| **Trx/Day Sheet By Trx Date** | `/dashboard/reports/transactions/trx-day-sheet-by-transaction-date` | `/api/v1/reports/transactions/daysheet-transaction` | `Transaction` | **Fully Connected** (Pulls active deposits/withdrawals). |
| **Transaction Register By Session** | `/dashboard/reports/transactions/register-session` | `/api/v1/reports/transactions/register-session` | `Transaction` | **Connected enough for live data** (legacy session naming, but built from live transactions). |
| **Transaction Register By Date** | `/dashboard/reports/transactions/general-transaction-register-by-transaction-date` | `/api/v1/reports/transactions/general-transaction-register` | `Transaction` | **Fully Connected** (Pulls all active transactions). |
| **Journal Listing By Date** | `/dashboard/reports/transactions/journal-transaction` | `/api/v1/reports/transactions/journal-transaction` | `JournalEntry` | **Fully Connected** (Pulls ledger updates). |
| **Standing Orders** | `/dashboard/reports/standing-orders` | `/api/v1/reports/standing-orders` | `StandingOrder` | **Disconnected** (No active registrations exist yet). |
| **SMS Banking** | `/dashboard/reports/sms-banking` | `/api/v1/reports/sms-banking` | `Notification` | **Connected** (Bulk SMS writes notification rows; report reads SMS notifications). |
| **Asset Depreciation Schedule** | `/dashboard/reports/fixed-assets/depreciation` | `/api/v1/reports/fixed-assets` (depr.) | `FixedAsset` | **Connected** (Depreciation is calculated from active fixed assets on demand). |

---

## 🛠️ Recommendations for Synchronization

1. **Unify the remaining legacy transaction views**:
   - Keep migrating the remaining legacy reports toward core tables where possible. The savings balance reports already use `Account`, but some older report paths still query extension tables directly.
   
2. **Introduce a Float-to-Session Bridge**:
   - If the UI still needs session-branded views, generate them from the live float and transaction data rather than relying on the empty `TransactionSession` table.
   
3. **Register Standing Orders**:
   - Add hook calls in the transaction schedules to populate `StandingOrder` tables, or retire the report if standing orders remain unsupported.

4. **Optional depreciation posting job**:
   - If you want depreciation to post to the ledger automatically, add a server action or automated schedule that writes `AssetDepreciation` rows and matching `JournalEntry` records. The report itself already calculates depreciation from active assets.
