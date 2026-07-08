# API Correctness Implementation Guide

Prepared from the current codebase on 2026-06-23.

## Goal

Make the ledger, report pages, and member forms consistent with the backend API so users see the right balances, the right print output, and the right member data everywhere.

## Core Rule

- The UI must not invent report values.
- Reports must read from the API source of truth.
- If a transaction affects money, the API must write the journal/income record that the report expects.
- If a field is captured during member onboarding, it must be stored, exposed by API, and rendered in the relevant ledger/report views.

## Issues To Fix

### 1. Balance sheet expanded print shows the summary boxes instead of the detailed report

Current behavior:
- The expanded print action is wired to the top summary area.
- The detailed balance sheet below has no dedicated print action.

Required correction:
- The print action must target the detailed report table/hierarchy.
- The print view must hide summary cards and only show the report body.

API/data rule:
- Do not print from cached UI state if the detailed report API already returns the full statement.

Relevant screens:
- `/dashboard/reports/financial-statements/balance-sheet`
- `/dashboard/reports/statement-of-comprehensive-balance-sheet`

Implementation steps:
- Add a print button next to the detailed report body.
- Ensure the print HTML only renders the detailed report.
- Keep summary cards visible on screen, but hidden in print mode if they are not part of the required output.

Acceptance check:
- Print preview should open with the detailed balance sheet rows.
- Summary cards should not be the first thing printed unless explicitly requested.

### 2. Member creation form needs home address details

Current behavior:
- The member/client onboarding form does not clearly capture home address.
- Home address needs village, parish, and sub-county for better identity matching.

Required correction:
- Add structured address inputs for:
  - Village
  - Parish
  - Sub-county
  - Optional district if needed by your local workflow

API/data rule:
- The member create/update API must persist these fields.
- The member fetch APIs must return them.
- The member detail and ledger screens must display them.

Recommended location:
- Member onboarding form
- Member edit form
- Member detail page
- Personal ledger report header and identity block

Acceptance check:
- A newly created member can be searched and identified by the full home address.
- Same-name members can be distinguished using the new address fields.

### 3. Income and expenditure report is missing amounts for some income sources

Current behavior:
- Some income sources exist in the ledger but do not show a monetary value in the comprehensive income and expenditure report.
- Examples mentioned:
  - loan related income
  - sale of trees
  - withdrawal fee charged

Required correction:
- Each income source must be posted into the correct income journal path.
- The report must read those journaled values from the backend, not from labels alone.

API/data rule:
- The report API should read posted income records and/or journal entries that correspond to the income category.
- If a fee or income source is created in a transaction flow, that flow must write the journal entry and income record in the same transaction.

Relevant backend areas:
- `app/api/v1/withdrawals/verify/route.ts`
- `app/api/v1/withdrawals/confirm/route.ts`
- `app/api/v1/withdrawals/route.ts`
- `app/api/v1/mobile-money/withdrawals/route.ts`
- `lib/reports/income-expense-report.ts`
- `lib/services/income-structure.ts`

Implementation steps:
- Make sure every income source has a real posting path.
- Add missing journal entry creation where the transaction only deducts balances.
- Keep the report mapping aligned with the actual GL account codes.

Acceptance check:
- `405001 Withdrawal fee charged` should show money in the report when a fee exists.
- Loan-related income and similar sources should show values in the correct section.

### 4. Next of kin must appear in member ledger/account views

Current behavior:
- Next of kin is captured in the system, but it is not always visible in the member ledger and personal ledger screens.

Required correction:
- Include next of kin in the member ledger account header or identity panel.
- Include the relationship and contact details if available.

API/data rule:
- The member detail API must return next of kin fields.
- The personal ledger API must include them in its payload if the report page needs them.

Recommended places to show it:
- Member ledger summary
- Personal ledger report header
- Member profile panel

Acceptance check:
- A user reading the ledger can see who the next of kin is without opening another page.

### 5. Account type needs voluntary savings and compulsory savings, not only generic savings

Current behavior:
- The account type display currently uses a generic savings category in some places.
- Users may want statements for voluntary savings only or compulsory savings only.

Required correction:
- Split savings-facing labels into:
  - Voluntary savings
  - Compulsory savings

API/data rule:
- The account-type API should expose the correct savings subtype.
- Report filters should use that subtype rather than a single “Savings” label.

Recommended data model direction:
- Introduce explicit savings subtype fields if they do not already exist.
- Make the personal ledger and savings reports filter by subtype.

Acceptance check:
- A user can request only voluntary savings or only compulsory savings.
- The ledger labels are no longer ambiguous.

### 6. Preliminary information such as email, occupation, and next of kin should be filled and visible

Current behavior:
- The data is captured in parts of the system, but some fields are not surfaced consistently.

Required correction:
- Ensure onboarding captures:
  - email
  - occupation
  - next of kin
  - home address
- Ensure the ledger and member detail views display the stored values.

API/data rule:
- The create/update member API must store these fields.
- The read APIs must return them in a stable shape.

Acceptance check:
- The member profile and ledger views show the same preliminary information that was captured at registration.

### 7. Personal ledger report shows no data even when transactions exist

Current behavior:
- The user sees transaction activity on the account, but the personal ledger report comes back empty or incomplete.

Likely causes:
- The report API is filtering by the wrong account subtype.
- The report API is using the wrong date field.
- The report is reading from a table that is not the actual transaction source.
- The branch filter is excluding valid rows.

Required correction:
- Trace the personal ledger report API end to end.
- Make sure it reads from the true transaction source for the selected account.
- Make sure its filters match the UI filter controls.

Relevant route:
- `/api/v1/reports/member-ledger/personal-ledger`

Implementation steps:
- Confirm the transaction source table used by the report.
- Confirm the date column used for filtering.
- Confirm the accountId/memberId linkage.
- Confirm branch scoping and role scoping.
- Add a drilldown path if the report returns rows but the UI hides them.

Acceptance check:
- An account with real transactions must show them in personal ledger.
- The report should match the transaction list for the same period and branch.

## API-First Implementation Order

1. Fix transaction posting first.
2. Fix report consumption second.
3. Fix member onboarding and member detail payloads third.
4. Fix report labels and filters last.

## Suggested Backend Work Items

- Normalize withdrawal fee posting across all withdrawal APIs.
- Ensure `incomeRecord` and `journalEntry` are created together where required.
- Add report fallback only for legacy data, not as the main long-term source.
- Add member address and next-of-kin fields to the API response models.
- Split savings account subtype handling in account-type APIs and reports.
- Rework personal ledger queries so they read the actual posting tables.

## Suggested UI Work Items

- Add a print button beside the detailed balance sheet report.
- Add home address fields to the member create form.
- Show next of kin in member detail and ledger views.
- Add explicit voluntary/compulsory savings filters.
- Show empty-state messages only when the API really returns no rows.

## Verification Checklist

- Balance sheet print preview shows the detailed report, not the summary cards.
- New member onboarding can store and display village, parish, and sub-county.
- Income and expenditure report shows posted fee income and other income sources.
- Member ledger shows next of kin.
- Personal ledger can filter voluntary vs compulsory savings.
- Personal ledger returns transactions when transactions exist.

## Notes

- For any financial screen, treat the API as the source of truth.
- If the UI and API disagree, fix the API flow first.
- If legacy rows exist without the right postings, backfill them carefully and idempotently.

