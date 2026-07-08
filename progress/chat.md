# Project Context & Detailed Progress Log - Bukonzo Teachers Sacco

This document serves as a comprehensive "brain dump" of the project's evolution, architectural decisions, and current state. It is intended to help any AI agent or developer quickly understand the context when switching devices or sessions.

## Project Overview
**Bukonzo Teachers Sacco** is a specialized loan and savings management system. It uses a Next.js 14/15 stack with Prisma, NextAuth, and Tailwind CSS. The system manages Members, Agents, Tellers, Loan Officers, and Managers.

---

## Technical Context & Architecture

### 1. Role-Based Access Control (RBAC)
- **Roles**: `ADMIN`, `BRANCHMANAGER`, `TELLER`, `AGENT`, `MEMBER`, `LOANOFFICER`, `ACCOUNTANT`, `AUDITOR`.
- **Configuration**: Managed primarily in `config/protected-routes.ts`.
- **Navigation**: The `Sidebar.tsx` and `Navbar.tsx` dynamically render content based on these roles.
- **Routing**: `app/(dashboard)/dashboard/page.tsx` acts as a central router, redirecting roles to their specific dashboard pages (e.g., `/dashboard/pages/loan-officer`).

### 2. Loan Processing Workflow
- **Stages**: `DRAFT` -> `SUBMITTED` -> `IN_ANALYSIS` -> `FORWARDED_TO_MANAGER` -> `APPROVED`/`REJECTED` -> `DISBURSED`.
- **Key Files**: 
    - `actions/loanprocess/loanWorkflow.ts`: Contains the server actions for state transitions.
    - `app/(dashboard)/dashboard/loanprocess/officer-tracking/page.tsx`: The primary interface for Loan Officers.
    - `app/(dashboard)/dashboard/loans/manager-loan-process-tracking/`: The approval interface for Managers.

### 3. Recent Major Shift: Loan Officers vs Tellers
- **Change**: Restricted loan allocation and management solely to `LOANOFFICER` role (previously handled by Tellers).
- **Impact**: Database fields like `loanOfficerId` are now primary, though `allocatedTellerId` is maintained in some places for legacy compatibility.
- **UI Standard**: Terminology has been updated across the app to use "Loan Officer" for all loan-related assignments.

---

## Major Milestones & Bug Fixes

### Phase 1: Stability & Profile Completion
- **Fix**: Implemented the `MEMBER` profile completion flow. Fixed redirects that were trapping users in infinite loops if their profile (NIN, approval) was incomplete.
- **Dashboard Stability**: Resolved the "Critical Error" on the dashboard by restructuring `DashboardLayout` to isolate member-specific validation from staff members.

### Phase 2: Loan Ledger & Financial Integrity
- **Feature**: Implemented the **Loan Ledger**. This provides a running balance of disbursements and repayments.
- **Logic**: Every time a repayment is made, the ledger calculates the new outstanding balance based on the previous entry.

### Phase 3: Routing & Accessibility
- **Fix**: Corrected a widespread redirect bug where the app pointed to `/login` instead of the correct `/auth/signin`.
- **Fix**: Resolved the **"Officer Tracking" 404 error** caused by a pluralization typo (`officer-trackings`) in the route config.
- **Refinement**: Granted Loan Officers access to `Member Accounts`, `Chart of Accounts`, and `System Guide` to facilitate their appraisal work.

---

## Current State of the Codebase

### Important Directories
- `app/(dashboard)/`: Contains all main functional pages.
- `actions/`: Centralized logic for data mutations (Server Actions).
- `config/`: Configuration for routes, auth, and UI metadata.
- `components/reusable-ui/`: Shared components like `DataTable`.

### Known Implementation Patterns
- **Auth**: Always use `getAuthUser()` from `@/config/useAuth` for server-side session checks.
- **UI**: Uses `sonner` for notifications and `lucide-react` for icons.
- **Modals**: Most complex actions (Decisions, Disbursements) are handled in `Dialog` components found in the `components/` subdirectories.

---

### Phase 4: API Consolidation & Batch 4 Enhancements
- **Consolidation**: Cleaned up the API layer by removing **17 redundant reporting routes** and unifying them under a single dynamic route: `/api/v1/reports/loans/[reportType]`.
- **Reporting Enhancements**:
    - **Repayment**: Split paid amounts into Principal, Interest, and Penalty.
    - **Disbursement**: Added "Total Interest" to help officers understand total loan value.
    - **Aging**: Included member names in brackets for easier identification.
    - **Paid-Off**: Added "Days +/-" column to show early/late completion performance.
- **Dynamic UI**:
    - **Portfolio Dashboard**: Summary cards are now clickable, opening breakdown dialogs by loan product.
    - **Guarantor/Security**: Enhanced table views in "Borrower Details" to open detail dialogs with phone numbers.
- **Financial Integrity**: Corrected the Teller/Vault repayment logic to ensure funds correctly flow from the Member to the Teller's local float and then to the central SACCO reserve.

---

### Phase 5: Institution Loans, Reporting & Build Stability (Current Session)
- **Institution Loan Hub**: Completed the multi-section institution loan application form with administrators, operating instructions, and disbursement configuration.
- **Guarantor Search Engine**: Integrated real-time member search for linking guarantors to both individual and institution loan applications.
- **Voluntary Savings Disbursement**: Configured default loan disbursement to the member's Voluntary Savings Account.
- **Loan Ledger Card Restructuring**:
    - Credit Side: Loan Amount (Principal) + Total Loan Interest.
    - Debit Side: Principal Paid + Interest Paid.
    - Transactions filtered to the specific loan only.
- **Standardized Report Headers**: All printed reports now display "Bukonzo United Teachers SACCO".
- **Interest Corrections**: Fixed "Starter Fund" product to 12% p.a. (1% monthly). System now calculates interest based on user-entered repayment period.
- **Build Fixes**: Resolved duplicate import errors in `InstitutionLoanApplicationForm.tsx` and a `calculateLoanSchedule` type mismatch in `actions/loanReports.ts`.

---
## Next Steps
- [x] Verify the performance of the unified reporting API under load with realistic data.
- [ ] Extend the dynamic API pattern to other modules (Savings, Deposits) for total system consistency.
- [ ] Update the mobile app frontend to consume the unified reporting endpoint.
- [ ] Final UAT with pilot users.

---
*Last updated: March 1, 2026 - Antigravity AI Agent*
