# Reports Mismatch & Integration Analysis

This analysis examines the connection between the **Core Banking / SACCO Transaction Functionality** and the **Reports Dashboard** (`/dashboard/reports`) to identify data disconnects, missing fallbacks, and schema discrepancies. 

---

## 🔍 Core Architectural Findings

The application utilizes two parallel sets of database models, leading to data siloing and empty reports:
1. **Active Core Models** (Updated during teller operations and active banking features):
   - `Transaction` (general transactions: deposits, withdrawals, transfers)
   - `Deposit` (specific deposit meta-details)
   - `Withdrawal` (specific withdrawal meta-details)
   - `UserFloat` / `FloatTransaction` (teller drawer balances and daily allocations)
   - `FixedAsset` (registered assets)
   - `JournalEntry` (double-entry accounting ledger entries populated via transfers, withdrawals, loan processing, etc.)
   
2. **Extended Reporting Models** (Defined in `schema-extension.prisma` and queried by the new report generator logic):
   - `SavingsAccount` & `SavingsTransaction`
   - `ShareAccount` & `ShareTransaction`
   - `TransactionSession` (for cashier/teller sessions)
   - `StandingOrder` & `StandingOrderExecution`
   - `SmsLog` (SMS notifications)
   - `AssetDepreciation` (asset depreciation periods)

No active operations write to the second set of models (except seeds or resets). As a result, reports that query them directly return empty or seeded records.

---

## 🚨 The 5 Major Disconnects

### 1. Teller Session Reports (`TransactionSession` vs. `UserFloat`)
- **Queries:** `db.transactionSession` (e.g. cashier status, sequence by session, day sheet by session).
- **Actual System Behavior:** Tellers open their day and manage floats using the `UserFloat`, `FloatAllocation`, and `FloatReconciliation` models. No code creates or manages `TransactionSession` records.
- **Impact:** All 4 reports that filter by **"Session Date"** or **"Teller Session"** return **zero results**.

### 2. Savings & Share Transactions Mismatch (`SavingsTransaction` vs. `Transaction`)
- **Queries:** `db.savingsTransaction` and `db.shareTransaction`.
- **Actual System Behavior:** `TransactionService.processDeposit` and withdrawal logic write to `Transaction`, `Deposit`, and `Withdrawal` tables. They do not write to `SavingsTransaction` or `ShareTransaction`.
- **Impact:**
  - **Savings Transactions Report:** Has a built-in fallback: if no `SavingsTransaction` rows are found, it queries `Transaction` and maps it. This report displays data successfully.
  - **Other Savings/Share Reports:** Reports querying `SavingsTransaction` directly (e.g., Interest Paid, Share Concentration, Share Statement) do not have this fallback and return empty.

### 3. SMS Banking Logs (`SmsLog`)
- **Queries:** `db.smsLog`.
- **Actual System Behavior:** The SMS sending service does not write logs to `SmsLog` table during alerts or notifications.
- **Impact:** The **SMS Banking Logs** report remains empty.

### 4. Standing Orders (`StandingOrder`)
- **Queries:** `db.standingOrder` and `db.standingOrderExecution`.
- **Actual System Behavior:** There is no active feature in the application that registers or schedules standing orders.
- **Impact:** The **Standing Orders** report is completely empty.

### 5. Fixed Assets Depreciation Schedules (`AssetDepreciation`)
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
| **Profit & Loss** | `/dashboard/reports/financial-statements/profit-loss` | `/api/v1/reports/financial/profit-loss` | `IncomeRecord`, `ExpenditureRecord` | **Fully Connected** (Synced during deposits/fees). |
| **Trial Balance** | `/dashboard/reports/financial-statements/trial-balance` | `/api/v1/reports/financial/trial-balance` | `JournalEntry`, `ChartOfAccount` | **Fully Connected** (Ledger account balances). |
| **Statement of Comp. Balance Sheet** | `/dashboard/reports/statement-of-comprehensive-balance-sheet` | `/api/v1/reports/statement-of-comprehensive-balance-sheet` | `JournalEntry`, `ChartOfAccount` | **Fully Connected** (Ledger account balances). |
| **Savings Account Listing** | `/dashboard/reports/savings/savings-listing` | `/api/v1/reports/savings/account-listing` | `Account` (original model) | **Fully Connected** (Pulls accounts from core database). |
| **Savings Account Statement** | `/dashboard/reports/savings/savings-account-statement` | `/api/v1/reports/savings/account-statement` | `Account`, `Transaction` | **Fully Connected** (Pulls active transactions). |
| **Savings Transactions Report** | `/dashboard/reports/savings-shares-reports/savings` | `/api/v1/reports/savings/transactions` | `SavingsTransaction` / `Transaction` | **Partially Connected** (Uses `Transaction` fallback). |
| **Savings Account Balances** | `/dashboard/reports/savings/savings-balances` | `/api/v1/reports/savings/account-balance` | `SavingsAccount` | **Disconnected** (Active accounts are in `Account` model). |
| **Savings Zero Balance** | `/dashboard/reports/savings/zero-balance` | `/api/v1/reports/savings/zero-balance` | `SavingsAccount` | **Disconnected** (Queries extension instead of core). |
| **Share Concentration** | `/dashboard/reports/savings-shares-reports/shares` | `/api/v1/reports/shares/concentration` | `ShareAccount` | **Disconnected** (Active share accounts are not in `ShareAccount`). |
| **Shares Transaction Report** | `/dashboard/reports/shares/share-transactions` | `/api/v1/reports/shares/transactions` | `ShareTransaction` | **Disconnected** (No active share transaction writes). |
| **Maturing Fixed Deposits** | `/dashboard/reports/fixed-deposits/maturing` | `/api/v1/reports/fixed-deposits/maturing` | `FixedDeposit` | **Fully Connected** (FD operations write to this model). |
| **Cashier Teller Session Status** | `/dashboard/reports/transactions/cashier-teller-cash-status-by-session-date` | `/api/v1/reports/transactions/cashier-teller-cash-status` | `TransactionSession`, `UserFloat` | **Partially Disconnected** (Session filters fail; float table works). |
| **Trx/Day Sheet By Session** | `/dashboard/reports/transactions/trx-day-sheet-by-session-date` | `/api/v1/reports/transactions/daysheet-session` | `TransactionSession` | **Disconnected** (Session table has zero records). |
| **Trx/Day Sheet By Trx Date** | `/dashboard/reports/transactions/trx-day-sheet-by-transaction-date` | `/api/v1/reports/transactions/daysheet-transaction` | `Transaction` | **Fully Connected** (Pulls active deposits/withdrawals). |
| **Transaction Register By Session** | `/dashboard/reports/transactions/register-session` | `/api/v1/reports/transactions/register-session` | `TransactionSession` | **Disconnected** (Zero records returned). |
| **Transaction Register By Date** | `/dashboard/reports/transactions/general-transaction-register-by-transaction-date` | `/api/v1/reports/transactions/general-transaction-register` | `Transaction` | **Fully Connected** (Pulls all active transactions). |
| **Journal Listing By Date** | `/dashboard/reports/transactions/journal-transaction` | `/api/v1/reports/transactions/journal-transaction` | `JournalEntry` | **Fully Connected** (Pulls ledger updates). |
| **Standing Orders** | `/dashboard/reports/standing-orders` | `/api/v1/reports/standing-orders` | `StandingOrder` | **Disconnected** (No active registrations exist). |
| **SMS Banking** | `/dashboard/reports/sms-banking` | `/api/v1/reports/sms-banking` | `SmsLog` | **Disconnected** (No active logs written). |
| **Asset Depreciation Schedule** | `/dashboard/reports/fixed-assets/depreciation` | `/api/v1/reports/fixed-assets` (depr.) | `AssetDepreciation` | **Disconnected** (Depreciation engine unimplemented). |

---

## 🛠️ Recommendations for Synchronization

1. **Unify the Account & Transaction Models**:
   - Align write paths inside `TransactionService` to write records to both core and extended reporting schemas (e.g. insert into `SavingsTransaction` whenever a savings `Transaction` is processed, or migrate reporting to query `Transaction` & `Account` directly).
   
2. **Introduce a Float-to-Session Bridge**:
   - Write a helper to auto-generate a `TransactionSession` record when a teller activates their float (`UserFloat.isActiveForDay` starts) and close it when they start reconciliation, ensuring all session reports work transparently.
   
3. **Register SMS Logs & Standing Orders**:
   - Add hook calls in the notification actions and transaction schedules to populate `SmsLog` and `StandingOrder` tables.

4. **Implement an Asset Depreciation Job**:
   - Create a server action or automated schedule (`pnpm run cron:depreciate`) that fetches active `FixedAsset` rows, calculates their monthly straight-line/declining-balance depreciation, inserts `AssetDepreciation` entries, and posts matching `JournalEntry` records to clear the book value.
