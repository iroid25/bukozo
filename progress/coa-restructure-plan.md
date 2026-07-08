# SACCO Chart of Accounts Restructure Plan

## Goal
Restructure the chart of accounts into a clean SACCO-style hierarchy so the system only keeps accounts that belong to one of these five core categories:

- Assets
- Liabilities
- Equity
- Income
- Expenditures

Member-level detail should stay in subledgers and report sources, not as loose chart-of-account rows.

## Core Design Rules

1. Use a fixed numeric hierarchy with gaps for future growth.
2. Keep pillar accounts as category headers only.
3. Keep control accounts in the GL.
4. Push member-specific rows, deductions, and remittance history into subledger/report tables.
5. Remove duplicate or one-off operational accounts from the active COA view.
6. Soft-archive bad accounts instead of deleting them so journal history stays intact.

## Proposed Numbering Structure

### 1xxxxx - Assets

- `100000` - Assets
- `101000` - Current Assets
- `102000` - Cash and Bank
- `103000` - Fixed Assets
- `104000` - Receivables
- `105000` - Loans Receivable
- `106000` - Investments
- `107000` - Other Assets

Suggested children:

- Cash on hand
- Bank accounts
- Mobile money float
- Member loans receivable
- Interest receivable
- Prepayments
- Office equipment
- Buildings
- Motor vehicles

### 2xxxxx - Liabilities

- `200000` - Liabilities
- `201000` - Member Savings
- `202000` - Fixed Deposits
- `203000` - External Loans
- `204000` - Accounts Payable
- `205000` - Accruals and Provisions

Suggested children:

- Voluntary savings
- Compulsory savings
- Junior savings
- Fixed deposit savings
- External short-term loans
- External long-term loans
- Interest payable

### 3xxxxx - Equity

- `300000` - Equity
- `301000` - Share Capital
- `302000` - Statutory Reserves
- `303000` - Retained Earnings
- `304000` - Grants and Donations

Suggested children:

- Share capital by member class or source
- Sacco reserves
- Retained earnings
- Capital grants

Note: individual member share deductions should not become separate GL accounts. They should appear as source rows under the share capital control account and in the report view.

### 4xxxxx - Income

- `400000` - Income
- `401000` - Loan Interest Income
- `402000` - Fees and Commissions
- `403000` - Penalties and Fines
- `404000` - Investment Income
- `405000` - Other Income

Suggested children:

- Interest on loans
- Account opening fees
- Statement fees
- Withdrawal fees
- Penalty income
- Share transfer fees

### 5xxxxx - Expenditures

- `500000` - Expenditures
- `501000` - Staff Costs
- `502000` - Administration Costs
- `503000` - Finance Costs
- `504000` - Loan Loss Provision
- `505000` - Depreciation
- `506000` - Other Operating Costs

Suggested children:

- Salaries
- Rent
- Stationery
- Bank charges
- Audit fees
- Depreciation expense

## What To Keep, Move, Or Remove

### Keep

- Core pillars and control accounts.
- Legitimate posting accounts that roll up into financial statements.
- Asset accounts like cash, bank, fixed assets, receivables, and loans receivable.
- Liability accounts like member deposits, fixed deposits, and external borrowings.
- Equity accounts like share capital, reserves, and retained earnings.
- Income and expenditure posting accounts that feed reports.

### Move

- Member-specific balances into subledger tables.
- Share deductions from loan applications into share-capital source rows.
- Insurance deductions and remittance-style detail into report source rows, not standalone COA children.
- Misclassified accounts into the correct category and parent.

### Remove From Active COA View

- Duplicate accounts with the same purpose.
- One-off personal rows that do not represent a reusable GL account.
- Accounts that are only used for reporting history and should live in source tables instead.
- Legacy placeholder rows that never carry operational value.

## Practical Cleanup Rules For Existing Data

1. If the account is a real GL control or posting account, keep it.
2. If the account is a member-specific balance or deduction record, move it out of COA.
3. If two accounts represent the same thing, merge them into one canonical code.
4. If a name is duplicated but the purpose is the same, keep one and archive the rest.
5. If an account does not map cleanly to one of the five pillars, mark it inactive and review it.

## Suggested Migration Phases

### Phase 1 - Freeze

- Stop new ad hoc COA creation.
- Allow only approved account creation through a controlled form.

### Phase 2 - Audit

- Export the current COA list.
- Tag each row as:
  - keep
  - rename
  - move
  - merge
  - archive

### Phase 3 - Reclassify

- Update ledger type, parent account, and naming for valid rows.
- Move member-level and report-only detail into subledgers.

### Phase 4 - Archive Noise

- Soft deactivate accounts that do not belong in the active COA.
- Keep them searchable in admin review mode if needed.

### Phase 5 - Validate

- Run trial balance checks.
- Confirm balance sheet and income statement rollups.
- Confirm share capital and savings totals match subledger source rows.

### Phase 6 - Lock In Rules

- Enforce code ranges in the create/edit flow.
- Prevent orphan accounts unless explicitly allowed.
- Keep the list page defaulted to the approved structure only.

## Files To Update

- `app/(dashboard)/dashboard/accounting/chart-of-accounts/page.tsx`
- `app/(dashboard)/dashboard/accounting/chart-of-accounts/components/NewAccountForm.tsx`
- `app/(dashboard)/dashboard/accounting/chart-of-accounts/components/COATree.tsx`
- `app/api/v1/chart-of-accounts/route.ts`
- `app/api/v1/chart-of-accounts/[id]/route.ts`
- `lib/services/chartOfAccounts.ts`
- `prisma/seed-chart-of-accounts.ts`

## Validation Checklist

- Every visible account belongs to one of the five core categories.
- Share capital members show in report source rows, not as stray accounts.
- Duplicate account names are removed or merged.
- The trial balance still balances.
- Legacy accounts are still preserved as inactive history.

## Recommended Next Step

Produce a migration map from the current code list to the new structure, then apply the map in small batches so we can verify totals after each batch.

## Current State Assessment

The imported COA dataset is already mostly inside the five SACCO pillars:

- Total rows in the working export: 345
- Numeric COA rows: 338
- Noise / review rows: 7

The review rows are import artifacts, not real accounts. They should be archived from the active COA view:

- `GL A/C No.`
- `<info@maripatechagency.com>0  INTEREST ON LOANS`
- `Total: 337`

So the immediate cleanup is not a broad mass-delete. It is:

1. Remove malformed header rows from the active import source.
2. Keep the 338 numeric rows as the live restructuring base.
3. Apply the migration map to the numeric rows in batches.

## Finish Line

We are done with the planning stage once:

- the malformed rows are excluded from live COA imports,
- the numeric rows are mapped into the final hierarchy,
- and the audit summary stays stable after the reclassify pass.
