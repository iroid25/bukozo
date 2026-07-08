# BUTSACCO System: Complete Operations & Interaction Guide

This guide provides a step-by-step breakdown of every functionality in the BUTSACCO system, including navigation paths, clickable source links, live hosted links, and exactly what happens when you interact with system elements.

---

## 1. User Management (Staff & Member Onboarding)

**Description:** Central hub for managing the identity and access levels of everyone in the Sacco.

- **Hosted Links (Live):**
  - [Live: Tellers Management](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/users/tellers)
  - [Live: Members Management](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/users/members)
- **Direct Source Links:**
  - [Tellers Management Page](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/users/tellers/page.tsx>)
  - [Members Management Page](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/users/members/page.tsx>)
- **Navigation:** Sidebar > **User Management** > (Select: **Tellers**, **Agents**, **Members**, etc.)
- **How it Works:**
  1. The Admin selects a user category.
  2. The system loads a list of all users in that category.
  3. New users are added via a multi-step form that captures bio-data, branch assignment, and role permissions.
- **Interactions:**
  - **Click "Add New"**: Opens a creation form. Upon submission, a new record is created in the database and the user is immediately assigned to their branch.
  - **Click "View/Edit"**: Opens the User Profile. You can update details or change a user's status (Active/Inactive).
  - **Member Approval Workflow**: New members are marked as "Pending" and must be approved by a Admin or Branch Manager. Members receive an immediate "Welcome" in-app notification upon registration, and additional notifications once approved or rejected.
  - **Comprehensive Notifications**: Members receive real-time alerts for all key activities: loan disbursements, repayments, deposits, withdrawals, and internal transfers. - **Password Security**: Supports compulsory password expiration and forced resets via the Admin/Security settings.
  - **Click "Delete" (or Deactivate)**: Immediately revokes the user's login access, preventing further system interaction.

---

## 2. Account Management (Member Products)

**Description:** Managing the financial accounts that members hold (Savings, Shares, etc.).

- **Hosted Links (Live):**
  - [Live: Member Accounts](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/accounts)
  - [Live: Account Types Configuration](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/account-types)
- **Direct Source Links:**
  - [Member Accounts Page](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/accounts/page.tsx>)
  - [Account Types Config Page](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/account-types/page.tsx>)
- **Navigation:** Sidebar > **Account Management** > **Member Accounts**
- **How it Works:**
  1. Staff search for a member by Name or Member Number.
  2. The system displays all accounts associated with that member.
  3. Accounts are tied to "Account Types" which define interest rates and withdrawal rules.
- **Interactions:**
  - **Click "Create Account"**: Triggers a modal. Selecting a product (e.g., "Regular Savings") automatically pulls in the configuration (min balance, etc.).
  - **Click Account Number**: Redirects to the **Account Ledger**. This view shows a chronological list of every transaction affecting that specific balance.
  - **Click "Sync Balance"**: Refreshes the real-time balance from the ledger to the main account display.
  - **Shares Account**: Tracks "Number of Shares" and enforces transfer-only withdrawal logic.
  - **Fixed Deposits**: Advanced term tracking with Start/End dates and withdrawal locks until the period expires. Funding is restricted to transfers from Voluntary Savings.

---

## 3. Transaction Hub (Deposits & Withdrawals)

**Description:** The core operational engine for processing money movements.

### 3.1. Cash Deposits

- **Hosted Link (Live):** [Live: Deposits](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/deposits)
- **Direct Source Link:** [Deposits Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/deposits/page.tsx>)
- **Navigation:** Sidebar > **Account Management** > **Deposits**
- **Workflows:**
  - **Click "New Deposit"**: Opens a form with a searchable account selector.
  - **Click "Submit Deposit"**:
    1. Records a `CREDIT` to the member's account.
    2. Records a `DEBIT` to the Teller's Float.
    3. Updates the General Ledger (Savings Liability increases, Cash-at-Hand increases).

### 3.2. Cash Withdrawals

- **Hosted Link (Live):** [Live: Withdrawals](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/withdraw-test)
- **Direct Source Link:** [Withdrawals Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/withdraw-test/page.tsx>)
- **Navigation:** Sidebar > **Account Management** > **Withdrawals**
- **Workflows:**
  - **Click "Initiate Withdrawal"**: Generates an OTP (Verification Code) sent to the member or displayed for the Teller.
  - **Click "Verify & Process"**: Deducts funds from the member and adds a credit to the Teller's Float (since they gave out physical cash).

---

## 4. Loan Management Lifecycle

**Description:** Management of credit products from application to final repayment.

### 4.1. Application & Appraisal

- **Hosted Link (Live):** [Live: Loan Applications](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/loan-applications)
- **Direct Source Link:** [Loan Applications Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/loan-applications/page.tsx>)
- **Interactions:**
  - **Applications**: Digital loan application workflow with stages (Submitted -> In Analysis -> Approved -> Disbursed).
- **Institution Loan Hub**: Multi-section form capturing administrators, signatories, and operating instructions.
- **Guarantor Search Engine**: Real-time member search for linking guarantors to both individual and institution applications, ensuring precise KYC validation.
- **Duration Accuracy**: System prioritizes user-entered repayment periods (e.g., 5 months) and automatically calculates interest based on the actual duration (e.g. 1% per month).
- **Collateral**: Register and value collateral.
  - **Click "Appraise"**: Loan Officers enter scoring data. System calculates the debt-to-income ratio.

### 4.2. Approval & Disbursement

- **Hosted Link (Live):** [Live: Active Loans](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/loans)
- **Direct Source Link:** [Active Loans Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/loans/page.tsx>)
- **Interactions:**
  - **Click "Approve" (Managers Only)**: Moves the loan to "Ready for Disbursement" status.
  - **Click "Disburse"**:
    1. Creates a Loan Account.
    2. **Default Destination**: Credits the Member's **Voluntary Savings account** with the loan amount.
    3. **Automated Float Reduction**: Disbursement amount is automatically deducted from the teller/branch float.
    4. Generates a **Professional Repayment Schedule** automatically using the `calculateLoanSchedule` engine.

---

## 5. Float Management (Cash Control)

**Description:** Precision tracking of physical cash held by Tellers.

- **Hosted Link (Live):** [Live: Float Management](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/floats)
- **Direct Source Link:** [Float Management Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/floats/page.tsx>)
- **Interactions:**
  - **Click "Allocate Float" (Accountant)**: Selects a Teller and a source Vault. Clicking "Confirm" moves the digital balance to the Teller.
  - **Click "Reconcile" (Teller)**: At EOD, the Teller clicks this and enters their physical cash count.
  - **Click "Verify Reconciliation" (Accountant)**: If the physical matches the system, the accountant clicks "Approve" to close the Teller's session.

---

## 6. Reserve Management (The Vault)

**Description:** Oversight of the Sacco's high-value cash reserves.

- **Hosted Links (Live):**
  - [Live: Branch Reserve](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/reserve)
  - [Live: Org Vault](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/accounts/vault)
- **Direct Source Links:**
  - [Branch Reserve Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/reserve/page.tsx>)
  - [Org Vault Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/accounts/vault/page.tsx>)
- **Interactions:**
  - **Click "Vault In"**: Records a transfer of cash into the strong room (e.g., from a bank deposit).
  - **Click "Vault Out"**: Records removal of cash (e.g., to fund Tellers or a bank deposit).

---

## 7. Account Holds (Fund Security)

**Description:** Placing "Freezes" on funds to prevent withdrawal.

- **Hosted Link (Live):** [Live: Account Holds](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/holds)
- **Direct Source Link:** [Account Holds Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/holds/page.tsx>)
- **Interactions:**
  - **Click "Place Hold"**: Opens the searchable selector. Selecting an account and clicking "Confirm" creates a lock on a specific amount.
  - **Click "Lift Hold"**: Instantly releases the locked funds, making them available for withdrawal again.

---

## 8. Reports & Analytics

**Description:** Strategic data exports for managers and auditors with standardized branding.

- **Hosted Link (Live):** [Live: Reports Dashboard](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/reports)
- **Direct Source Link:** [Reports Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/reports/page.tsx>)
- **Branding**: All reports are headed with **"Bukonzo United Teachers SACCO"** for official documentation.
- **Loan Ledger Card**:
  - **Filtered View**: Shows only transactions for the specific loan in question.
  - **Credit Side**: Displays the Principal (Loan Amount) and Total Loan Interest.
  - **Debit Side**: Breaks down repayments into **Principal Paid** and **Interest Paid** for clear auditing.
- **Interactions:**
  - **Select Date Range**: Filters the database query.
  - **Click "Generate PDF/Excel"**: Triggers a background worker that compiles the data into a downloadable file.

---

## 9. Mobile Money Integration

**Description:** Automated digital transactions via Airtel/MTN.

- **Hosted Link (Live):** [Live: Mobile Money Hub](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/mobile-money/deposits)
- **Direct Source Link:** [MM Hub Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/mobile-money/deposits/page.tsx>)
- **Interactions:**
  - **Click "Initiate Pull" (Deposit)**: Sends a USSD prompt to the member's phone.
  - **Click "Initiate Push" (Withdrawal/Loan)**: Sends funds from the Sacco balance directly to the member's wallet.

---

## 10. Expenditure & Category Management

**Description:** Managing organizational costs and budget structures.

- **Hosted Links (Live):**
  - [Live: Expenditure Categories](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/accounts/expenditure-categories)
  - [Live: Expenditures](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/accounts/expenditures)
- **Direct Source Links:**
  - [Category Management](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/accounts/expenditure-categories/page.tsx>)
  - [Expenditure Form](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/accounts/expenditures/new/ExpenditureRecordForm.tsx>)
- **Interactions:**
  - **Hierarchical View**: Expenditure items are nested under Parent Categories for better budgeting.
  - **Auto-Branch Detection**: New expenditure records automatically detect and set the creator's branch.
  - **Account Sync**: Creating a category automatically generates the corresponding entry in the Chart of Accounts.

---

## 11. Asset Management

**Description:** Registry of physical and non-physical sacco assets.

- **Hosted Links (Live):** [Live: Assets](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/accounts/assets)
- **Direct Source Links:** [Assets Management](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/accounts/assets/page.tsx>)
- **Interactions:**
  - **Registration**: Capture Quantity, Receipt Numbers, and detailed descriptions for every asset.
- **Hierarchical Registry**: Assets are automatically synced to the Chart of Accounts using a **4-digit hierarchy** (e.g., `101300 Furniture & Fittings` -> `101301 boardroom furniture`).
- **Depreciation Tracking**: Linked to the general ledger for accurate financial reporting.

---

## 12. Audit & Settings

**Description:** Monitoring system logs and security.

- **Hosted Link (Live):** [Live: Audit Log](https://www.bukonzounitedteacherscooperativesociety.com/dashboard/settings/audit-log)
- **Direct Source Link:** [Audit Log Source](<file:///d:/anti%20gravv/mm%20intergration%20buttsac/butsacco-dec-2/app/(dashboard)/dashboard/settings/audit-log/page.tsx>)
- **Interactions:**
  - **Click "View Details"**: Shows a detailed audit trail of a specific transaction or user action.
