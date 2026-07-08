# 🚀 Butsco System Functionalities (Desktop & API Guide)

This document tracks the verified and active functionalities of the Butsco Desktop Application and its integration with the backend API.

## 🎨 Premium UI & Design System

- **TailAdmin Aesthetic**: Modern, glassmorphism-inspired UI with clean layouts and high-contrast elements.
- **Typography**: Unified font hierarchy using **Outfit** (Display/Headings) and **Inter** (Body/UI) for a premium feel.
- **Dynamic Design**: Interactive components with hover effects, micro-animations, and full **Dark Mode** support.
- **Error Handling**: Premium validation dialogs and System Conflict Modals for real-time API feedback.

## 👥 User Roles & Capabilities

| Role               | Core Capabilities                                                                      |
| :----------------- | :------------------------------------------------------------------------------------- |
| **Administrator**  | Full system control, global configurations, user management, and audit logs.           |
| **Branch Manager** | Branch-specific operations, staff oversight, and high-level expenditure approvals.     |
| **Accountant**     | Chart of Accounts management, journal entries, bank reconciliations, and budgeting.    |
| **Teller**         | Front-counter operations: Deposits, withdrawals, and loan repayments (Float-based).    |
| **Loan Officer**   | Loan appraisal, applicant verification, and portfolio management.                      |
| **Agent**          | Field operations: Mobile-based member enrollment and basic transactions.               |
| **Data Entrant**   | Efficient entry of member profiles, institution registration, and expenditure records. |
| **Auditor**        | Read-only access to financial ledgers, audit trails, and compliance reports.           |

## 🏗️ Core System Functionalities

### 1. Staff & User Management

- **Unified Lifecycle**: Handled via a high-performance `UserFormModal` with 11+ granular fields.
- **Biometric Ready**: Fingerprint enrollment components integrated into the registration flow.
- **Registration Consistency**: `DATA_ENTRANT` role enabled for both Member and Institution registration.

### 2. Loan Management & Accounting

- **Refined Refactoring**: Dynamic mapping of principal and interest accounts per loan product.
- **Consolidated Repayments**: Unified service logic handles splits between Principal, Interest, and Penalties.
- **Automatic Journaling**: Real-time generation of split journal entries for both Individual and Institution loans.

### 3. Expenditure & Asset Tracking

- **Smart Expenditures**: Categorized tracking under "500000 Expenses" with auto-fill account mapping.
- **Fixed Assets**: Specialized registration for Land, Motorcycle, Furniture, and Buildings with automated depreciation calculations.

## 💳 Financial Operations: External Borrowings

To capture an external loan (e.g., Centenary Bank worth 10M), the system follows these steps:

1. **Liability Account**: Create or use a specific liability account (e.g., `2023xx - External Loan: Centenary`).
2. **Journal Entry (Receipt)**:
   - **Debit**: Receiving Bank Account (e.g., `104000 Bank - Centenary`).
   - **Credit**: The specific Liability Account.
3. **Repayment Tracking**: Repayments are split between Principal (Debiting Liability) and Interest (Debiting `500000 Interest Payments`).

---

## 🔗 Technical API Integration

### Base URL

`Production: https://www.bukonzounitedteacherscooperativesociety.com/api`

### Key Endpoints

- **Auth**: `POST /api/auth/callback/credentials`
- **Users**: `GET/POST/PUT /api/v1/users`
- **Members**: `GET/POST /api/v1/members`
- **Institutions**: `GET/POST /api/v1/institutions`
- **Loans**: `POST /api/v1/loans/repay`, `POST /api/v1/loans/[id]/disburse`
- **Expenditures**: `POST /api/v1/expenditure`
- **Assets**: `POST /api/v1/assets`

---

_Last Updated: March 2026_
