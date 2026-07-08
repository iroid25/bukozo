# Mobile API Integration Guide

This is the complete API reference for the Bukonzo United Teachers SACCO mobile application. It covers every available endpoint, authentication flows, and step-by-step integration instructions.

**Last Updated:** March 1, 2026

## Base URL

```
Production: https://www.bukonzounitedteacherscooperativesociety.com/api
```

---

# PART 1: COMPLETE API ENDPOINT REFERENCE

---

## 1. Authentication

| Method | Endpoint                     | Description                            |
| :----- | :--------------------------- | :------------------------------------- |
| `GET`  | `/auth/csrf`                 | Get CSRF token (required before login) |
| `POST` | `/auth/callback/credentials` | Login with email/phone + password      |
| `GET`  | `/auth/session`              | Get current session / user profile     |
| `POST` | `/v1/auth/forgot-password`   | Send password reset OTP to email       |
| `POST` | `/v1/auth/reset-password`    | Reset password using OTP               |
| `POST` | `/auth/verify-otp`           | Verify OTP code                        |
| `POST` | `/profile/update`            | Update user profile details            |

---

## 2. Member Management

| Method   | Endpoint                         | Description                                           |
| :------- | :------------------------------- | :---------------------------------------------------- |
| `GET`    | `/v1/members`                    | List all members (filterable)                         |
| `POST`   | `/v1/members`                    | Create/register a new member (Includes Welcome Notif) |
| `GET`    | `/v1/members/[memberId]`         | Get a specific member's full details                  |
| `PUT`    | `/v1/members/[memberId]/approve` | Approve a pending member member (Admin/Manager)       |
| `DELETE` | `/v1/members/[memberId]/approve` | Reject a pending member (Admin/Manager)               |
| `GET`    | `/v1/members/me`                 | Get logged-in member's profile & summary stats        |
| `GET`    | `/v1/members/me/analytics`       | Get member's personal analytics                       |
| `GET`    | `/v1/member/dashboard`           | Get member dashboard data                             |
| `GET`    | `/v1/users`                      | List all users                                        |
| `GET`    | `/v1/users/[id]`                 | Get specific user details                             |

---

## 3. Account Management

| Method | Endpoint                                    | Description                               |
| :----- | :------------------------------------------ | :---------------------------------------- |
| `GET`  | `/v1/accounts`                              | List all accounts                         |
| `POST` | `/v1/accounts`                              | Create a new account                      |
| `GET`  | `/v1/accounts/[accountId]`                  | Get account details                       |
| `GET`  | `/v1/accounts/[accountId]/transactions`     | Get transaction history for an account    |
| `POST` | `/v1/accounts/[accountId]/early-withdrawal` | Process early withdrawal (fixed deposits) |
| `GET`  | `/v1/accounts/my-account`                   | Get logged-in member's accounts           |
| `GET`  | `/v1/accounts/my-account/statistics`        | Account statistics for logged-in member   |
| `GET`  | `/v1/accounts/my-account/transactions`      | Transaction history for logged-in member  |
| `GET`  | `/v1/accounts/search`                       | Search accounts by number/name            |
| `GET`  | `/v1/accounts/assets`                       | List asset accounts                       |
| `GET`  | `/v1/accounts/liabilities`                  | List liability accounts                   |
| `GET`  | `/v1/account-types`                         | List all account types                    |
| `GET`  | `/v1/account-types/[id]`                    | Get specific account type                 |
| `POST` | `/v1/account-types/[id]/toggle-default`     | Toggle default status of account type     |
| `GET`  | `/v1/account-types/fees`                    | Get fee configuration for account types   |
| `GET`  | `/v1/account-types/for-creation`            | Get account types available for creation  |

---

## 4. Transactions (Deposits & Withdrawals)

| Method | Endpoint                                       | Description                          |
| :----- | :--------------------------------------------- | :----------------------------------- |
| `GET`  | `/v1/transactions`                             | List all transactions (filterable)   |
| `GET`  | `/v1/transactions/[id]`                        | Get specific transaction details     |
| `POST` | `/v1/transactions/deposit`                     | Process a cash deposit               |
| `GET`  | `/v1/transactions/deposits`                    | List all deposits                    |
| `GET`  | `/v1/transactions/deposits/my-deposits`        | My deposit history                   |
| `POST` | `/v1/transactions/withdraw`                    | Initiate a withdrawal (sends OTP)    |
| `GET`  | `/v1/transactions/withdrawals`                 | List all withdrawals                 |
| `GET`  | `/v1/transactions/withdrawals/my-withdrawals`  | My withdrawal history                |
| `GET`  | `/v1/transactions/my-transactions`             | All my transactions                  |
| `GET`  | `/v1/transactions/account/[accountId]`         | Transactions for specific account    |
| `GET`  | `/v1/transactions/member/[memberId]`           | Transactions for specific member     |
| `GET`  | `/v1/transactions/institution/[institutionId]` | Transactions for institution         |
| `GET`  | `/v1/transactions/pending`                     | List pending transactions            |
| `GET`  | `/v1/transactions/failed`                      | List failed transactions             |
| `GET`  | `/v1/transactions/today`                       | Today's transactions                 |
| `GET`  | `/v1/transactions/statistics`                  | Transaction statistics               |
| `GET`  | `/v1/transactions/stats`                       | Transaction summary stats            |
| `POST` | `/v1/transactions/reverse`                     | Reverse a transaction                |
| `POST` | `/v1/transfers/internal`                       | Internal account-to-account transfer |
| `POST` | `/v1/shares/transfer`                          | Transfer shares between members      |

---

## 5. Loan Management

### Loan Products

| Method   | Endpoint                  | Description                   |
| :------- | :------------------------ | :---------------------------- |
| `GET`    | `/v1/loans/products`      | List all loan products        |
| `POST`   | `/v1/loans/products`      | Create a loan product (Admin) |
| `GET`    | `/v1/loans/products/[id]` | Get specific product details  |
| `PATCH`  | `/v1/loans/products/[id]` | Update a loan product         |
| `DELETE` | `/v1/loans/products/[id]` | Delete a loan product         |

### Loan Applications

| Method  | Endpoint                               | Description                         |
| :------ | :------------------------------------- | :---------------------------------- |
| `GET`   | `/v1/loans/applications`               | List all applications (filterable)  |
| `POST`  | `/v1/loans/applications`               | Submit individual loan application  |
| `GET`   | `/v1/loans/applications/[id]`          | Get specific application details    |
| `PATCH` | `/v1/loans/applications/[id]`          | Update an application               |
| `POST`  | `/v1/loans/applications/[id]/decision` | Approve/Reject an application       |
| `GET`   | `/v1/loans/applications/statistics`    | Application statistics              |
| `POST`  | `/v1/loans/applications/institution`   | Submit institution loan application |
| `GET`   | `/v1/loans/applications/institution`   | List institution loan applications  |

### Active Loans

| Method   | Endpoint               | Description                     |
| :------- | :--------------------- | :------------------------------ |
| `GET`    | `/v1/loans`            | List all loans                  |
| `POST`   | `/v1/loans`            | Create a loan record            |
| `GET`    | `/v1/loans/[id]`       | Get specific loan details       |
| `PUT`    | `/v1/loans/[id]`       | Update a loan                   |
| `DELETE` | `/v1/loans/[id]`       | Delete a loan                   |
| `GET`    | `/v1/loans/active`     | List active loans               |
| `POST`   | `/v1/loans/active`     | Query active loans with filters |
| `GET`    | `/v1/loans/my-loans`   | Get logged-in member's loans    |
| `GET`    | `/v1/loans/stats`      | Loan statistics                 |
| `GET`    | `/v1/loans/statistics` | Loan portfolio statistics       |

### Disbursement & Repayment

| Method | Endpoint                             | Description                       |
| :----- | :----------------------------------- | :-------------------------------- |
| `POST` | `/v1/loans/disburse`                 | Disburse a loan (global endpoint) |
| `POST` | `/v1/loans/[id]/disburse`            | Disburse specific loan            |
| `POST` | `/v1/loans/repay`                    | Make a loan repayment (global)    |
| `POST` | `/v1/loans/[id]/repayment`           | Repay specific loan               |
| `GET`  | `/v1/loans/[id]/repayment`           | Get repayment history for a loan  |
| `POST` | `/v1/loans/[id]/pay-from-account`    | Repay loan from savings account   |
| `GET`  | `/v1/loans/repayments`               | List all repayments               |
| `POST` | `/v1/loans/repayments`               | Record a repayment                |
| `GET`  | `/v1/loans/repayments/my-repayments` | My repayment history              |
| `GET`  | `/v1/loans/repayments/statistics`    | Repayment statistics              |

### Loan Schedules & Rescheduling

| Method  | Endpoint                     | Description                            |
| :------ | :--------------------------- | :------------------------------------- |
| `GET`   | `/v1/loans/[id]/schedule`    | Get repayment schedule for a loan      |
| `POST`  | `/v1/loans/schedule/preview` | Preview a schedule before disbursement |
| `POST`  | `/v1/loans/[id]/reschedule`  | Reschedule a loan                      |
| `GET`   | `/v1/loans/reschedules`      | List all reschedules                   |
| `PATCH` | `/v1/loans/reschedules/[id]` | Update a reschedule                    |

---

## 6. Mobile Money & Payments

| Method | Endpoint                       | Description                                    |
| :----- | :----------------------------- | :--------------------------------------------- |
| `POST` | `/payment/initiate`            | Initiate a Pesapal payment (Deposit/Repayment) |
| `GET`  | `/payment/status`              | Check payment status                           |
| `POST` | `/v1/mobile-money/withdrawals` | Initiate mobile money withdrawal               |
| `POST` | `/webhook`                     | Pesapal webhook callback (internal)            |

---

## 7. Float & Vault (Teller/Agent)

### Teller Float

| Method | Endpoint                 | Description                           |
| :----- | :----------------------- | :------------------------------------ |
| `GET`  | `/v1/float`              | Get teller float info                 |
| `POST` | `/v1/float/allocate`     | Allocate float to teller (Accountant) |
| `POST` | `/v1/float/reconcile`    | Submit EOD reconciliation             |
| `GET`  | `/v1/float/balance`      | Get current float balance             |
| `GET`  | `/v1/float/transactions` | Float transaction history             |
| `GET`  | `/v1/float/statistics`   | Float statistics                      |

### Vault / Reserve

| Method | Endpoint                     | Description               |
| :----- | :--------------------------- | :------------------------ |
| `GET`  | `/v1/vault`                  | Get vault info            |
| `POST` | `/v1/vault/add-funds`        | Add funds to vault        |
| `POST` | `/v1/vault/withdraw-funds`   | Withdraw funds from vault |
| `POST` | `/v1/vault/reconcile`        | Vault reconciliation      |
| `GET`  | `/v1/vault/balance`          | Vault balance             |
| `GET`  | `/v1/vault/statistics`       | Vault statistics          |
| `GET`  | `/v1/vault/transactions`     | Vault transaction history |
| `GET`  | `/v1/reserve`                | Get reserve info          |
| `POST` | `/v1/reserve/allocate`       | Allocate from reserve     |
| `POST` | `/v1/reserve/return/propose` | Propose reserve return    |

---

## 8. Role-Based Dashboards

| Method | Endpoint                                     | Description              |
| :----- | :------------------------------------------- | :----------------------- |
| `GET`  | `/v1/teller/dashboard`                       | Teller dashboard summary |
| `GET`  | `/v1/teller/float-balance`                   | Teller's current float   |
| `POST` | `/v1/teller/start-day`                       | Start teller session     |
| `POST` | `/v1/teller/end-day`                         | End teller session       |
| `GET`  | `/v1/teller/reconciliation/status`           | Reconciliation status    |
| `GET`  | `/v1/admin/dashboard`                        | Admin dashboard          |
| `GET`  | `/v1/agent/dashboard`                        | Agent dashboard          |
| `GET`  | `/v1/accountant/dashboard`                   | Accountant dashboard     |
| `GET`  | `/v1/accountant/cash-position`               | Cash position overview   |
| `GET`  | `/v1/accountant/pending-approvals`           | Pending approval items   |
| `GET`  | `/v1/accountant/trends`                      | Financial trends         |
| `POST` | `/v1/accountant/expenditure/[id]/approve`    | Approve expenditure      |
| `POST` | `/v1/accountant/expenditure/[id]/reject`     | Reject expenditure       |
| `POST` | `/v1/accountant/reconciliation/[id]/approve` | Approve reconciliation   |
| `POST` | `/v1/accountant/reconciliation/[id]/reject`  | Reject reconciliation    |
| `GET`  | `/v1/reports/manager/dashboard-stats`        | Manager dashboard stats  |

---

## 9. Statements

| Method | Endpoint                       | Description                        |
| :----- | :----------------------------- | :--------------------------------- |
| `GET`  | `/v1/statements`               | List all generated statements      |
| `GET`  | `/v1/statements/[id]`          | Get specific statement             |
| `GET`  | `/v1/statements/[id]/data`     | Get statement data (for rendering) |
| `POST` | `/v1/statements/[id]/email`    | Email a statement to member        |
| `GET`  | `/v1/statements/members`       | List members with statements       |
| `GET`  | `/v1/statements/statistics`    | Statement generation stats         |
| `GET`  | `/v1/statements/stats`         | Statement summary                  |
| `GET`  | `/v1/reports/member-statement` | Generate member statement          |

---

## 10. Reports

### Loan Reports (Unified)

| Method | Endpoint                              | Description                            |
| :----- | :------------------------------------ | :------------------------------------- |
| `GET`  | `/v1/reports/loans/[reportType]`      | Dynamic loan reports (see types below) |
| `GET`  | `/v1/reports/loans/portfolio-at-risk` | PAR report                             |

**Report Types** (pass as `[reportType]`):
`summary`, `portfolio`, `outstanding`, `disbursements`, `repayment-history`, `arrears`, `aging`, `paid-off`, `borrower-details`, `top-borrowers`, `officer-analysis`, `concentration`, `approval-rejection`, `write-offs`, `repayment-schedule`, `ledger-card`

### Savings Reports

| Method | Endpoint                                 | Description             |
| :----- | :--------------------------------------- | :---------------------- |
| `GET`  | `/v1/reports/savings/account-balance`    | Account balances        |
| `GET`  | `/v1/reports/savings/account-listing`    | Account listing         |
| `GET`  | `/v1/reports/savings/account-statement`  | Account statement       |
| `GET`  | `/v1/reports/savings/batch-totals`       | Batch totals            |
| `GET`  | `/v1/reports/savings/dormant-accounts`   | Dormant accounts        |
| `GET`  | `/v1/reports/savings/interest-paid`      | Interest paid           |
| `GET`  | `/v1/reports/savings/on-hold-closed`     | On-hold/closed accounts |
| `GET`  | `/v1/reports/savings/overdrawn-accounts` | Overdrawn accounts      |
| `GET`  | `/v1/reports/savings/top-bottom-savers`  | Top/bottom savers       |
| `GET`  | `/v1/reports/savings/transactions`       | Savings transactions    |
| `GET`  | `/v1/reports/savings/zero-balance`       | Zero balance accounts   |

### Shares Reports

| Method | Endpoint                                     | Description             |
| :----- | :------------------------------------------- | :---------------------- |
| `GET`  | `/v1/reports/shares/account-balance`         | Share account balances  |
| `GET`  | `/v1/reports/shares/account-listing`         | Share account listing   |
| `GET`  | `/v1/reports/shares/account-statement`       | Share account statement |
| `GET`  | `/v1/reports/shares/batch-totals`            | Share batch totals      |
| `GET`  | `/v1/reports/shares/concentration`           | Share concentration     |
| `GET`  | `/v1/reports/shares/on-hold-closed`          | On-hold/closed shares   |
| `GET`  | `/v1/reports/shares/top-bottom-shareholders` | Top/bottom shareholders |
| `GET`  | `/v1/reports/shares/transactions`            | Share transactions      |
| `GET`  | `/v1/reports/shares/zero-balance`            | Zero balance shares     |

### Financial Reports

| Method | Endpoint                                   | Description          |
| :----- | :----------------------------------------- | :------------------- |
| `GET`  | `/v1/reports/financial/balance-sheet`      | Balance Sheet        |
| `GET`  | `/v1/reports/financial/profit-loss`        | Profit & Loss        |
| `GET`  | `/v1/reports/financial/trial-balance`      | Trial Balance        |
| `GET`  | `/v1/reports/financial/cash-flow`          | Cash Flow Statement  |
| `GET`  | `/v1/reports/financial/summary`            | Financial Summary    |
| `GET`  | `/v1/reports/financial/performance`        | Performance Metrics  |
| `GET`  | `/v1/reports/financial/trends`             | Financial Trends     |
| `GET`  | `/v1/reports/financial-year/balance-sheet` | FY Balance Sheet     |
| `GET`  | `/v1/reports/financial-year/profit-loss`   | FY Profit & Loss     |
| `GET`  | `/v1/reports/financial-year/trial-balance` | FY Trial Balance     |
| `GET`  | `/v1/reports/custom/balance-sheet`         | Custom Balance Sheet |
| `GET`  | `/v1/reports/custom/cash-flow`             | Custom Cash Flow     |
| `GET`  | `/v1/reports/custom/profit-loss`           | Custom Profit & Loss |

### Transaction Reports

| Method | Endpoint                                        | Description             |
| :----- | :---------------------------------------------- | :---------------------- |
| `GET`  | `/v1/reports/transactions/cashier-status`       | Cashier status          |
| `GET`  | `/v1/reports/transactions/daysheet-session`     | Daysheet by session     |
| `GET`  | `/v1/reports/transactions/daysheet-transaction` | Daysheet by transaction |
| `GET`  | `/v1/reports/transactions/journal-session`      | Journal by session      |
| `GET`  | `/v1/reports/transactions/journal-transaction`  | Journal by transaction  |
| `GET`  | `/v1/reports/transactions/register-session`     | Register by session     |
| `GET`  | `/v1/reports/transactions/register-transaction` | Register by transaction |
| `GET`  | `/v1/reports/transactions/sequence-session`     | Sequence by session     |
| `GET`  | `/v1/reports/transactions/sequence-transaction` | Sequence by transaction |

### Other Reports

| Method | Endpoint                               | Description              |
| :----- | :------------------------------------- | :----------------------- |
| `GET`  | `/v1/reports/fixed-deposits/active`    | Active fixed deposits    |
| `GET`  | `/v1/reports/fixed-deposits/listing`   | FD listing               |
| `GET`  | `/v1/reports/fixed-deposits/maturing`  | Maturing FDs             |
| `GET`  | `/v1/reports/fixed-deposits/statement` | FD statement             |
| `GET`  | `/v1/reports/fixed-deposits/withdrawn` | Withdrawn FDs            |
| `GET`  | `/v1/reports/fixed-assets`             | Fixed assets report      |
| `GET`  | `/v1/reports/activity`                 | User activity log        |
| `GET`  | `/v1/reports/activity/statistics`      | Activity statistics      |
| `GET`  | `/v1/reports/comprehensive`            | Comprehensive report     |
| `POST` | `/v1/reports/generate`                 | Generate a custom report |
| `GET`  | `/v1/reports/sms-banking`              | SMS banking report       |
| `GET`  | `/v1/reports/standing-orders`          | Standing orders report   |

---

## 11. Other Endpoints

| Method   | Endpoint                             | Description                          |
| :------- | :----------------------------------- | :----------------------------------- |
| `GET`    | `/v1/accounting/coa`                 | Chart of Accounts                    |
| `GET`    | `/v1/analytics/loan-officers`        | Loan officer analytics               |
| `GET`    | `/v1/analytics/tellers`              | Teller analytics                     |
| `GET`    | `/v1/assets`                         | Asset management                     |
| `GET`    | `/v1/fixed-assets`                   | Fixed assets CRUD                    |
| `GET`    | `/v1/institutions`                   | List institutions                    |
| `GET`    | `/v1/institutions/[id]`              | Institution details                  |
| `GET`    | `/v1/notifications`                  | User notifications                   |
| `PUT`    | `/v1/notifications`                  | Mark a specific notification as read |
| `PUT`    | `/v1/notifications/mark-all-read`    | Mark all user notifications as read  |
| `DELETE` | `/v1/notifications?id=[id]`          | Delete a notification                |
| `POST`   | `/v1/reconciliation/approve`         | Approve reconciliation               |
| `GET`    | `/v1/system/interest-config`         | Interest configuration               |
| `GET`    | `/v1/system/interest-config/client`  | Client-side interest config          |
| `GET`    | `/v1/system/interest-config/history` | Interest config history              |
| `GET`    | `/v1/system/withdrawal-config`       | Withdrawal fee configuration         |
| `POST`   | `/v1/withdrawals`                    | Process a withdrawal                 |
| `GET`    | `/active-loans`                      | Quick active loans list              |
| `GET`    | `/loan-repayments`                   | Quick repayments list                |
| `POST`   | `/v1/loans/migrate`                  | Migrate legacy loans from Excel      |
| `POST`   | `/migration/members`                 | Migrate legacy members               |

---

## 12. File Uploads (UploadThing)

| Slug                   | Max Size | Purpose                       |
| :--------------------- | :------- | :---------------------------- |
| `userProfileImage`     | 2 MB     | Profile photos                |
| `fileUploads`          | 1 MB     | General documents (PDF, etc.) |
| `institutionDocuments` | 2 MB     | Institution certificates      |
| `migrationFile`        | 16 MB    | Bulk data import files        |

**Endpoint:** `POST /api/uploadthing?slug=[slug]`

---

# PART 2: MOBILE INTEGRATION INSTRUCTIONS

---

## Step 1: Authentication Flow

The backend uses **NextAuth.js** with JWT sessions. Here is the complete login flow:

```
┌─────────────┐    1. GET /auth/csrf     ┌─────────────┐
│  Mobile App  │ ──────────────────────►  │   Backend   │
│              │ ◄──────────────────────  │             │
│              │    { csrfToken: "..." }  │             │
│              │                          │             │
│              │  2. POST credentials     │             │
│              │ ──────────────────────►  │             │
│              │ ◄──────────────────────  │             │
│              │  Set-Cookie: session     │             │
│              │                          │             │
│              │  3. All future requests  │             │
│              │  include session cookie  │             │
└─────────────┘                          └─────────────┘
```

### 1. Get CSRF Token

```http
GET https://www.bukonzounitedteacherscooperativesociety.com/api/auth/csrf
```

**Response:** `{ "csrfToken": "abc123..." }`

### 2. Login

```http
POST https://www.bukonzounitedteacherscooperativesociety.com/api/auth/callback/credentials
Content-Type: application/json

{
  "identifier": "user@email.com",
  "password": "yourpassword",
  "csrfToken": "abc123...",
  "redirect": "false"
}
```

**Important:** Extract and persist the `next-auth.session-token` cookie from the response headers.

### 3. Verify Session

```http
GET https://www.bukonzounitedteacherscooperativesociety.com/api/auth/session
Cookie: next-auth.session-token=YOUR_TOKEN
```

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@email.com",
    "role": "MEMBER",
    "branchId": "branch-uuid"
  },
  "expires": "2026-04-01T..."
}
```

### 4. Use Token in All Requests

Every subsequent API request must include the session cookie:

```http
GET https://www.bukonzounitedteacherscooperativesociety.com/api/v1/members/me
Cookie: next-auth.session-token=YOUR_TOKEN
```

---

## Step 2: Core Member Screens

### Home / Dashboard

**Call:** `GET /api/v1/members/me`

- Returns: profile summary, total balance, active loans count, outstanding balance, savings goal progress.

### My Accounts

**Call:** `GET /api/v1/accounts/my-account`

- Returns: array of all accounts (savings, shares, fixed deposits) with balances.

### Account Detail

**Call:** `GET /api/v1/accounts/my-account/transactions?limit=20&offset=0`

- Returns: paginated transaction history for the member's accounts.

### My Loans

**Call:** `GET /api/v1/loans/my-loans?limit=20&offset=0&status=ACTIVE`

- Returns: list of active loans with outstanding balances and next payment dates.

### My Transactions

**Call:** `GET /api/v1/transactions/my-transactions?limit=20`

- Returns: all recent transactions (deposits, withdrawals, transfers).

---

## Step 3: Making Deposits (Mobile Money)

### Flow:

1. **Initiate Payment:**

```http
POST /api/payment/initiate
{
  "phoneNumber": "0700123456",
  "amount": 50000,
  "transactionType": "deposit",
  "accountId": "uuid-of-savings-account",
  "description": "Monthly savings"
}
```

2. **Open WebView:** Load the returned `checkoutUrl` in a WebView. The user completes the payment via Pesapal (MTN/Airtel prompt).

3. **Poll for Status:**

```http
GET /api/payment/status?reference=DEPOSIT-173...
```

4. **Success:** The backend automatically credits the member's account once Pesapal confirms.

---

## Step 4: Loan Operations

### View Available Loan Products

```http
GET /api/v1/loans/products
```

### Submit Loan Application

```http
POST /api/v1/loans/applications
{
  "memberId": "uuid",
  "loanProductId": "uuid",
  "amountApplied": 1000000,
  "purpose": "School fees",
  "repaymentPeriodMonths": 6,
  "employmentStatus": "EMPLOYED",
  "monthlyIncome": 500000,
  "collateralOffered": "Motor vehicle logbook"
}
```

### Preview Repayment Schedule (Before Applying)

```http
POST /api/v1/loans/schedule/preview
{
  "principal": 1000000,
  "interestRate": 2.5,
  "periodMonths": 6,
  "interestType": "FLAT_RATE"
}
```

### View My Loan Schedule

```http
GET /api/v1/loans/[loanId]/schedule
```

### Make Loan Repayment (Mobile Money)

```http
POST /api/payment/initiate
{
  "phoneNumber": "0700123456",
  "amount": 200000,
  "transactionType": "repayment",
  "loanId": "uuid-of-loan",
  "description": "Monthly repayment"
}
```

### Make Loan Repayment (Cash — Teller App)

```http
POST /api/v1/loans/repay
{
  "loanId": "uuid",
  "amount": 200000,
  "paymentMethod": "CASH"
}
```

---

## Step 5: Teller / Agent Operations

### Start Day

```http
POST /api/v1/teller/start-day
{ "openingBalance": 5000000 }
```

### Get Dashboard

```http
GET /api/v1/teller/dashboard
```

Returns: current float, transaction counts, reconciliation status.

### Process Cash Deposit

```http
POST /api/v1/transactions/deposit
{
  "accountId": "uuid",
  "amount": 100000,
  "description": "Cash deposit",
  "paymentMethod": "CASH"
}
```

### Process Cash Withdrawal

```http
POST /api/v1/transactions/withdraw
{
  "accountId": "uuid",
  "amount": 50000,
  "description": "Cash withdrawal"
}
```

This sends an OTP to the member. After verification:

```http
POST /api/v1/withdrawals
{
  "transactionId": "uuid",
  "otp": "123456"
}
```

### End Day / Reconcile

```http
POST /api/v1/teller/end-day
{
  "closingBalance": 4800000,
  "notes": "All clear"
}
```

---

## Step 6: File Uploads (Profile Pictures, Documents)

### Recommended: Use UploadThing SDK

```javascript
// React Native
import { generateReactHelpers } from "@uploadthing/react-native";

const { useUploadThing } = generateReactHelpers({
  url: "https://www.bukonzounitedteacherscooperativesociety.com/api/uploadthing",
});

// Usage
const { startUpload } = useUploadThing("userProfileImage");
await startUpload([selectedFile]);
```

### Manual Upload (if SDK unavailable)

1. **Get presigned URL:**

```http
POST /api/uploadthing?slug=userProfileImage
{ "files": [{ "name": "photo.jpg", "size": 102400, "type": "image/jpeg" }] }
```

2. **Upload to returned presigned URL** using `FormData`.

---

## Step 7: Notifications

```http
GET /api/v1/notifications
```

Returns unread notifications (loan status, transaction confirmations, etc.).

### Mark as Read

```http
PUT /api/v1/notifications
{ "notificationId": "uuid" }
```

### Mark All as Read

```http
PUT /api/v1/notifications/mark-all-read
```

---

## Step 8: Error Handling

All API errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

| HTTP Status | Meaning                              |
| :---------- | :----------------------------------- |
| `200`       | Success                              |
| `201`       | Created                              |
| `400`       | Bad Request (validation error)       |
| `401`       | Unauthorized (session expired)       |
| `403`       | Forbidden (insufficient permissions) |
| `404`       | Not Found                            |
| `500`       | Internal Server Error                |

**Session Expired Handling:** If you receive `401`, redirect the user to the login screen and clear the stored session token.

---

## Step 9: Offline Support & Sync

For areas with poor connectivity:

1. **Queue Transactions Locally:** Store pending deposits/withdrawals in local SQLite/AsyncStorage.
2. **Batch Sync:** When online, send queued items to:

```http
POST /api/v1/sync/transactions
{ "transactions": [...] }
```

3. **Conflict Resolution:** The server will reject duplicate `transactionReference` values, so include unique client-generated references.

---

## Step 10: Recommended Tech Stack for Mobile

| Layer           | Recommendation                                            |
| :-------------- | :-------------------------------------------------------- |
| **Framework**   | React Native / Expo                                       |
| **HTTP Client** | Axios (with cookie support via `axios-cookiejar-support`) |
| **State**       | Zustand or React Query                                    |
| **Storage**     | AsyncStorage / MMKV                                       |
| **Navigation**  | React Navigation                                          |
| **File Upload** | `@uploadthing/react-native`                               |
| **WebView**     | `react-native-webview` (for Pesapal payments)             |
| **Offline DB**  | WatermelonDB or SQLite                                    |

### Cookie Handling (Critical)

```javascript
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const jar = new CookieJar();
const api = wrapper(
  axios.create({
    baseURL: "https://www.bukonzounitedteacherscooperativesociety.com/api",
    jar,
    withCredentials: true,
  }),
);

// Login
const csrf = await api.get("/auth/csrf");
await api.post("/auth/callback/credentials", {
  identifier: "user@email.com",
  password: "password",
  csrfToken: csrf.data.csrfToken,
  redirect: "false",
});

// All subsequent requests automatically include the session cookie
const profile = await api.get("/v1/members/me");
```

---

## Quick Reference: Common Query Parameters

| Parameter       | Used In             | Description                                  |
| :-------------- | :------------------ | :------------------------------------------- |
| `limit`         | Most `GET` lists    | Number of results (default: 20)              |
| `offset`        | Most `GET` lists    | Pagination offset                            |
| `status`        | Loans, transactions | Filter by status (e.g., `ACTIVE`, `PENDING`) |
| `startDate`     | Reports             | Filter from date (`YYYY-MM-DD`)              |
| `endDate`       | Reports             | Filter to date (`YYYY-MM-DD`)                |
| `memberId`      | Transactions        | Filter by member                             |
| `loanProductId` | Reports             | Filter by loan product                       |
| `branchId`      | Member lists        | Filter by branch                             |
| `search`        | Members, accounts   | Free-text search                             |

---

_This document covers all 127 API route files in the system. For detailed request/response schemas, refer to the source code in `app/api/`._
