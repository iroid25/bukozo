# COA Source Routing Plan

## Goal
Only approved financial sources should create or update Chart of Account rows. Everything else should stay in subledgers, reports, or review-only screens.

## Approved COA Categories

- Assets
- Liabilities
- Income
- Expenditures

## Current Source Areas To Monitor

| Source | What It Produces | COA Target | Allowed |
|---|---|---|---|
| `app/api/v1/journal-entries/auto/income` | Debit cash, credit income | Assets + Income | Yes |
| `app/api/v1/journal-entries/auto/expenditure` | Debit expense, credit cash | Expenditures + Assets | Yes |
| `app/api/v1/journal-entries/auto/loan-disbursement` | Loan receivable + cash movement | Assets | Yes |
| `app/api/v1/journal-entries/auto/loan-repayment` | Cash + loan reversal | Assets | Yes |
| `app/api/v1/loans/products` | Standardized ledger links for loans | Assets + Income | Yes |
| `app/api/v1/liabilities` | Liability creation | Liabilities | Yes |
| `app/api/v1/accounts/assets/create` | Asset children | Assets | Yes |
| `app/api/v1/accounts/liabilities/create` | Liability children | Liabilities | Yes |
| `app/api/v1/accounts/expenditures/create` | Expenditure children | Expenditures | Yes |
| `app/api/v1/reports/shares/share-capital-remittances` | Share capital remittance history | Review/report only | No |

## What Must Be Blocked

- Any account from legacy dumps like `chart_data.json`
- Any account not matching the four allowed categories for this view
- Any page that tries to create ad hoc COA rows outside the allowed source map
- Any report page that is only meant to display history but not create GL rows

## Enforcement Steps

1. Add a central source-routing map in code.
2. Make create/update forms consult the map before saving.
3. Reject unapproved sources with a clear reason.
4. Keep share capital remittance history in report tables, not in random COA children.
5. Hide or archive legacy rows not in the approved categories.
6. Restrict the active snapshot view to approved prefixes only:
   - exact approved codes only
   - block legacy subaccounts such as `107009 UNATU LOAN`

## Immediate Next Fix

Wire the accounting pages and journal entry routes to the routing map so we can stop legacy accounts like `103001 UNATU SACCO` from surfacing in the active COA view.
