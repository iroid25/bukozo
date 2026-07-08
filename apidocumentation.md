SACCO SYSTEM – API ENDPOINTS (Markdown Version)

Below is a fully organized and clean Markdown version of your endpoint list for Web, Desktop, and Mobile apps.

🌐 WEB APP ENDPOINTS
(Complete Management System)
Authentication & User Management
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/register
POST /api/v1/auth/reset-password

GET /api/v1/users
POST /api/v1/users
PUT /api/v1/users
GET /api/v1/users/:id
DELETE /api/v1/users/:id

POST /api/profile/update (Mandatory Profile Completion)

Branch Management
GET /api/v1/branches
POST /api/v1/branches
PUT /api/v1/branches/:id
DELETE /api/v1/branches/:id
GET /api/v1/branches/:id/statistics

Member Management
GET /api/v1/members
POST /api/v1/members
PUT /api/v1/members/:id
GET /api/v1/members/:id

PUT /api/v1/members/:id/approve (Approve member)
DELETE /api/v1/members/:id/approve (Reject member - requires 'reason' in body)

GET /api/v1/members/:id/accounts
GET /api/v1/members/:id/loans
GET /api/v1/members/:id/transactions

Institution Management
GET /api/v1/institutions
POST /api/v1/institutions
PUT /api/v1/institutions/:id
GET /api/v1/institutions/:id

POST /api/v1/institutions/:id/approve
POST /api/v1/institutions/:id/reject

Account Management
GET /api/v1/accounts
POST /api/v1/accounts
PUT /api/v1/accounts/:id
GET /api/v1/accounts/:id

GET /api/v1/accounts/:id/balance
GET /api/v1/accounts/:id/transactions

POST /api/v1/accounts/:id/close
POST /api/v1/accounts/:id/suspend

GET /api/v1/account-types
POST /api/v1/account-types

Transaction Management
GET /api/v1/transactions
POST /api/v1/transactions/deposit (Sends Email Alert)
POST /api/v1/transactions/withdrawal (Sends Email Alert & Withdrawal OTP)
POST /api/v1/transactions/verify-withdrawal

GET /api/v1/transactions/:id
GET /api/v1/transactions/:id/receipt (Returns system-generated PDF receipt)
POST /api/v1/transactions/:id/reverse

GET /api/v1/transactions/recent

Loan Management
GET /api/v1/loans (List all loans)
POST /api/v1/loans/applications (Apply for a loan - Sends Email Alert)
POST /api/v1/loans/applications/institution (Apply for institutional loan - Sends Email Alert)
GET /api/v1/loans/active (Active loans)
GET /api/v1/loans/my-loans (Member's loans)
GET /api/v1/loans/:id

POST /api/v1/loans/:id/approve (Sends Email Alert)
POST /api/v1/loans/:id/reject
POST /api/v1/loans/disburse (Roles: ADMIN, BRANCHMANAGER, LOANOFFICER, TELLER - Sends Email Alert)
POST /api/v1/loans/disburse (Legacy/Batch)
POST /api/v1/loans/repay (Sends Email Alert - **Splits Ledger by Principal/Interest/Penalty**)

GET /api/v1/loans/products (List products)
GET /api/v1/loans/statistics (Loan Portfolio Stats)
GET /api/v1/loans/repayments (Repayment History)
GET /api/v1/loans/reschedules (Reschedule Requests)

Float Management
GET /api/v1/float/balance
POST /api/v1/float/allocate
POST /api/v1/float/reconcile
POST /api/v1/float/start-day
POST /api/v1/float/end-day

GET /api/v1/float/reconciliations
POST /api/v1/float/reconciliations/:id/approve

GET /api/v1/float/transactions

Vault Management (Accountant Node)
GET /api/v1/vault (Get Vault & Recent Transactions)
POST /api/v1/vault (Initialize Vault for current user)
GET /api/v1/vault/balance
GET /api/v1/vault/statistics
POST /api/v1/vault/add-funds
POST /api/v1/vault/withdraw-funds
POST /api/v1/vault/reconcile

Organisational Reserve (Admin Node)
GET /api/v1/reserve (Fetch Main Office Reserve)
POST /api/v1/reserve/allocate (Allocate Float to Teller/Vault)
POST /api/v1/reserve/return (Return Excess Float)

Legacy Vault Endpoints (Deprecated)
GET /api/v1/vaults/:id/transactions

Income & Expenditure Management
GET /api/v1/income
POST /api/v1/income
GET /api/v1/income/statistics
GET /api/v1/income/categories
GET /api/v1/income/branches
PUT /api/v1/income/:id
DELETE /api/v1/income/:id

GET /api/v1/expenditure
POST /api/v1/expenditure
GET /api/v1/expenditure/statistics
GET /api/v1/expenditure/categories
GET /api/v1/expenditure/branches
PUT /api/v1/expenditure/:id
POST /api/v1/expenditure/:id/approve

### Fixed Asset Management
**Base Route:** `/api/v1/fixed-assets`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/v1/fixed-assets` | List all registered fixed assets. |
| POST | `/api/v1/fixed-assets` | Register a new Fixed Asset and **Sync to COA**. |
| GET | `/api/v1/fixed-assets/:id` | Get details of a specific asset. |
| PUT | `/api/v1/fixed-assets/:id` | Update asset information. |
| DELETE| `/api/v1/fixed-assets/:id` | Delete an asset record. |

> [!NOTE]
> Creating a Fixed Asset via the API automatically creates a corresponding hierarchical entry in the **Chart of Accounts** under `Fixed assets (101000)`. It uses a **4-digit hierarchy** (e.g., `101300 Furniture & Fittings` -> `101301 boardroom furniture`) for granular tracking.

### Chart of Accounts (COA)
**Base Route:** `/api/v1/accounting/coa`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/v1/accounting/coa` | Fetch the hierarchical Chart of Accounts tree. |
| GET | `/api/v1/accounting/coa?type=trial-balance` | Fetch COA data formatted for Trial Balance. |

#### **Standard Classification (Hierarchical):**
1. **100000 Assets**
   - **101000 Fixed assets** (e.g., 101300 Furniture, 101301 Boardroom Furniture)
   - **102000 Current assets** (e.g., 102001 Cash, 102003 Loans)
2. **200000 Liabilities**
3. **300000 Equity**
4. **400000 Income**
5. **500000 Expenses**

Reports & Analytics

### Financial Reports
GET /api/v1/reports/financial
GET /api/v1/reports/cash-flow
GET /api/v1/reports/trial-balance
GET /api/v1/reports/profit-loss

### Loan Reports (Dynamic Route)
**Base Route:** `GET /api/v1/reports/loans/[reportType]`

This unified endpoint handles all loan-related reports. Dedicated legacy routes (e.g., `/api/v1/reports/loans/disbursement`) have been consolidated into this dynamic handler.

**Query Parameters:**
- `branchId` (UUID) - Filter by branch.
- `officerId` (UUID) - Filter by loan officer.
- `loanProductId` (UUID) - Filter by loan product.
- `startDate` / `endDate` (YYYY-MM-DD) - Date range filtering.
- `status` (String) - Loan status (e.g., DISBURSED, OVERDUE).
- `loanId` (UUID) - For individual loan reports (ledger-card, repayment-schedule).
- `memberId` (UUID) - Filter by member.
- `limit` (Number) - For top-bottom borrowers.
- `months` (Number) - For monthly trends.
- `date` (YYYY-MM-DD) - For daily demand sheet.

#### Supported Report Types (`[reportType]` slugs):

**Summaries & Dashboards:**
- `summary` - General portfolio summary.
- `product-performance` - Performance breakdown by product.
- `monthly-trends` - Month-over-month loan volume.
- `channel-stats` - Repayment stats by channel (Bank, Cash, Mobile Money).
- `par-summary` - Portfolio at Risk analysis.
- `portfolio` - General loan portfolio listing with detail dialogs.
- `portfolio-concentration` - Concentration by product and branch (Total/Avg size).

**Operations & Technical:**
- `disbursement` - Disbursement details (Includes Total Interest).
- `outstanding` - Outstanding balances (**P/I/Penalty split**).
- `dues-vs-repayment` - Payment performance analysis.
- `repayment-history` - Detailed logs of all payments made (Interest/Penalty/Principal breakdown).
- `arrears` - Detailed arrears list.
- `arrears-by-age` - 6-bracket aging analysis.
- `overdue` - List of overdue loans.
- `written-off` - Loans written off.
- `written-off-repayment` - History of payments on written-off loans.
- `paid-off` - Fully paid loans (Includes Days +/- column).
- `rescheduled` - History of loan reschedules.
- `applications` - Approval/Rejection statistics.

**Member & Officer Detail:**
- `borrowers-details` - Detail list with interactive Guarantor/Collateral dialogs.
- `loan-officer-analysis` - Performance metrics for loan officers.
- `active-by-officer` - Loans assigned per officer.
- `guarantors` - Details of loan guarantors (Includes phone numbers).
- `collateral` - Details of loan securities.
- `top-bottom-borrowers` - High and low exposure members.
- `daily-demand` - Daily collection sheet.

**Individual & Bulk Data:**
- `ledger-card` - Full individual history (Includes Reschedules/Write-offs).
- `repayment-schedule` - Amortization schedule for a specific loan.
- `repayment-history` - Global repayment logs.
- `all-ledgers` - Bulk export of ledger cards.
- `all-schedules` - Bulk export of payment schedules.
- `detailed` - Full flat-file loan dump.

**Example Request:**
```
GET /api/v1/reports/loans/outstanding?branchId=abc-123&startDate=2024-01-01
```

### Deprecated Endpoints (Removed)
The following routes have been fully replaced by the dynamic route above:
- `GET /api/v1/reports/loans/disbursement`
- `GET /api/v1/reports/loans/outstanding`
- `GET /api/v1/reports/loans/portfolio-concentration`
- ... and 14 other specific reporting routes.


Dashboard Endpoints
GET /api/v1/admin/dashboard
GET /api/v1/branch-manager/dashboard
GET /api/v1/branch-manager/statistics
GET /api/v1/branch-manager/trends

GET /api/v1/teller/dashboard
GET /api/v1/accountant/dashboard

Notifications
GET /api/v1/notifications
PUT /api/v1/notifications (Mark as read - requires 'notificationId' in body)
PUT /api/v1/notifications/mark-all-read (Mark all user notifications as read)
DELETE /api/v1/notifications?id=:id (Delete notification)

💻 DESKTOP APP ENDPOINTS (Teller / Agent)
Core Teller Operations
POST /api/v1/auth/login
GET /api/v1/teller/dashboard
GET /api/v1/teller/float-balance
POST /api/v1/teller/start-day
POST /api/v1/teller/end-day

Quick Member Search
GET /api/v1/members/search?query=
GET /api/v1/members/:id/quick-info
GET /api/v1/accounts/:accountNumber

Transactions (Optimized)
POST /api/v1/transactions/deposit (Sends Email Alert)
POST /api/v1/transactions/withdrawal (Sends Email Alert & Withdrawal OTP)
POST /api/v1/transactions/verify-withdrawal
GET /api/v1/transactions/recent
GET /api/v1/transactions/:id/receipt (Returns system-generated PDF receipt)

Loan Operations
POST /api/v1/loans/:id/repay (Sends Email Alert)
GET /api/v1/loans/:id/balance
POST /api/v1/loans/:id/disburse (Sends Email Alert)

Float Management
GET /api/v1/float/balance
POST /api/v1/float/reconcile
GET /api/v1/float/transactions/today

Offline Sync
POST /api/v1/sync/transactions
GET /api/v1/sync/pending
POST /api/v1/sync/upload

📱 MOBILE APP ENDPOINTS (Member Self-Service)
Authentication
POST /api/v1/mobile/auth/login
POST /api/v1/mobile/auth/register
POST /api/v1/mobile/auth/verify-otp
POST /api/v1/mobile/auth/forgot-password
POST /api/v1/mobile/auth/reset-password

Member Dashboard
GET /api/v1/mobile/dashboard
GET /api/v1/mobile/profile
PUT /api/v1/mobile/profile

Account Operations
GET /api/v1/mobile/accounts
GET /api/v1/mobile/accounts/:id/balance
GET /api/v1/mobile/accounts/:id/transactions
GET /api/v1/mobile/accounts/:id/statement

Loan Operations
GET /api/v1/mobile/loans
POST /api/v1/mobile/loans/apply (Sends Email Alert)
GET /api/v1/mobile/loans/:id
GET /api/v1/mobile/loans/:id/schedule
POST /api/v1/mobile/loans/:id/request-repayment (Sends Email Alert)

GET /api/v1/mobile/loan-products
POST /api/v1/mobile/loans/:id/calculate

Mobile Money Integration
POST /api/v1/mobile/deposit (Sends Email Alert)
POST /api/v1/mobile/withdraw (Sends Email Alert & OTP)
GET /api/v1/mobile/transaction-status/:id

Notifications
GET /api/v1/mobile/notifications
POST /api/v1/mobile/notifications/:id/read
POST /api/v1/mobile/notifications/settings

Support
POST /api/v1/mobile/support/ticket
GET /api/v1/mobile/support/tickets
GET /api/v1/mobile/faqs

System & Administration
POST /api/migration/members (Admin: Bulk Member Import/Migration)

🎯 PRIORITY ENDPOINTS TO BUILD FIRST
Phase 1: Core Banking (MVP)

✅ /api/v1/auth/\*

✅ /api/v1/users

✅ /api/v1/branches

/api/v1/members

/api/v1/accounts

/api/v1/transactions/deposit

/api/v1/transactions/withdrawal

Phase 2: Loan System

/api/v1/loan-products

/api/v1/loans/apply

/api/v1/loans/:id/approve

/api/v1/loans/:id/disburse

/api/v1/loans/:id/repay

Phase 3: Float & Vault

/api/v1/float/\*

/api/v1/vaults/\*

Phase 4: Reports & Analytics

/api/v1/branch-manager/dashboard

/api/v1/reports/\*

Phase 5: Mobile Money & Mobile App

/api/v1/mobile/\*

Mobile money integration

📊 SUMMARY BY PLATFORM
Platform Core Endpoints Optional
Web App ~80–100 Full management system
Desktop App ~30–40 Teller operations
Mobile App ~20–25 Member self-service

If you'd like, I can also:
✅ Generate OpenAPI/Swagger documentation
✅ Create folder structure + controllers for each module
✅ Implement actual endpoint code (Node.js, Laravel, Django, Go, etc.)

Just tell me which platform or module you want to build first! 🚀

---

## 👥 Member Onboarding & Migration Workflows

### 1. Migrated/Seeded Members (Legacy Data)
Members imported from the legacy system have specific login requirements and a mandatory profile update step.

#### **Step 1: First-Time Login**
- **Username:** Registered **Phone Number** (e.g., `0771234567` or `+256771234567`)
- **Default Password:** `Member@2026`
- **Action:** Call `POST /api/v1/auth/login` (Web) or `POST /api/v1/mobile/auth/login` (Mobile).

#### **Step 2: Mandatory Profile Update (Access Block)**
Upon successful login, the system checks for **Email** and **NIN**. Since legacy data lacks these fields, the user's dashboard access is **blocked** until they complete their profile.

- **Check:** If `user.email` is null OR `member.nin` is null -> Redirect to Profile Completion.
- **Mobile App Logic:**
    1. Login User.
    2. Check `user.email` in login response.
    3. If missing, navigate to `CompleteProfileScreen`.

#### **Step 3: Submitting Profile Details**
Use the **Profile Update Endpoint** to submit the missing information.

**Endpoint:** `POST /api/profile/update`  
**Headers:** `Authorization: Bearer <token>`  
**Body:**
```json
{
  "email": "john.doe@example.com",
  "nin": "CM12345678ABCD",
  "surname": "DOE",
  "otherNames": "JOHN",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE",
  "maritalStatus": "MARRIED",
  "town": "Kasese",
  "address": "Bwera, Kasese",
  "phone": "+256771234567",
  "nokName": "JANE DOE",
  "nokRelationship": "SPOUSE",
  "nokPhone": "+256700000000"
}
```

#### **Step 4: Completion**
- On HTTP 200 OK, the user is fully active.
- Redirect them to the main Dashboard.
- Future logins will no longer prompt for this update.

---

## 📱 Mobile Implementation Guide: Complete Profile

This section details the implementation of the **Mandatory Profile Completion** screen for the mobile app.

### **When to Show**
1.  **After Login:** Inspect the login response `user` object.
    *   If `user.email` is `null` OR `user.isVerified` is `false` (legacy users), redirect to `CompleteProfileScreen`.
    *   **Do not** allow navigation to the Dashboard until this step is completed.

### **Form Fields & Validation**
The following fields are **mandatory**. Validate them on the client side before submission.

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| **email** | String (Email) | Yes | Valid email format. Unique in system. |
| **nin** | String | Yes | National ID Number (min 5 chars). Unique. |
| **surname** | String | Yes | Family name. |
| **otherNames** | String | Yes | Given names. |
| **dateOfBirth** | Date (YYYY-MM-DD) | Yes | User must be 18+. |
| **gender** | Enum | Yes | Options: `MALE`, `FEMALE`, `OTHER`. |
| **maritalStatus** | Enum | Yes | Options: `SINGLE`, `MARRIED`, `DIVORCED`, `WIDOWED`, `SEPARATED`, `OTHER`. |
| **occupation** | String | No | Current job/profession. |
| **citizenship** | String | No | e.g., "Ugandan". |
| **address** | String | Yes | Physical residential address. |
| **phone** | String | Yes | Mobile number (e.g., `+256...`). |
| **nokName** | String | Yes | Next of Kin full name. |
| **nokRelationship** | String | No | e.g., "Spouse", "Father". |
| **nokPhone** | String | Yes | Next of Kin phone number. |

### **API Interaction**
- **Method:** `POST`
- **URL:** `/api/profile/update`
- **Auth:** Bearer Token (from login response)

#### **Success Response (HTTP 200)**
```json
{
  "success": true
}
```
*Action:* Show success message ("Profile Updated"), then navigate to **Dashboard**.

#### **Error Respons (HTTP 400)**
```json
{
  "fieldErrors": {
    "email": ["Email already in use."],
    "nin": ["NIN already registered."]
  }
}
```
*Action:* Display error messages under the respective form fields.

### **UI/UX Tips**
- **Pre-fill:** If the login response contains any partial data (e.g., `phone`), pre-fill the form.
- **Date Picker:** Use a native date picker for `dateOfBirth`.
- **Dropdowns:** Use bottom sheets or pickers for `gender` and `maritalStatus`.
- **Keyboard:** Use `email-address` keyboard for email, `phone-pad` for phone numbers.
