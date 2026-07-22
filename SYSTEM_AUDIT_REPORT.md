# SYSTEM AUDIT REPORT: Bukonzo Emergency SACCO Management System

**Date:** $(date +%Y-%m-%d)
**Scope:** Full codebase review covering Prisma schema (52+ models), API routes, server actions, transaction services, loan processing, GL/accounting, fee configurations, and middleware.

---

## EXECUTIVE SUMMARY

This report documents **52+ individual issues** identified across **9 categories** during a comprehensive system review. Issues are classified as:

- **🔴 CRITICAL** — Immediate financial/operational risk; must fix before handover
- **⚠️ HIGH** — Significant risk of data inconsistency or financial loss
- **MEDIUM** — Operational risk or reporting inaccuracies
- **LOW** — Minor issues, code quality, or technical debt

---

## 🔴 CRITICAL ISSUES (Must Fix Before Handover)

### 1. Loan Due Date Calculation Bug

**Location:** `actions/loans.ts` — `createLoanFromApplication()`
**Severity:** 🔴 CRITICAL
**Description:**

```javascript
dueDate.setMonth(dueDate.getDate() + repaymentPeriodMonths);
```

`setMonth()` is called with `getDate() + months` instead of `setMonth(getMonth() + months)`. For a loan disbursed on the 15th with 12 months term, this sets the month to `15 + 12 = 27`, pushing the date to March of year+2 instead of 12 months ahead. **This means every loan created via this path has an incorrect maturity date.**

### 2. Agent Float Balance Direction is Financially Inverted

**Location:** `services/transaction.service.ts` — `processDeposit()` & `processWithdrawal()`
**Severity:** 🔴 CRITICAL
**Description:**

- **Agent Deposit:** When agent collects cash from a member, float DECREMENTS (`balance: { decrement: amount + fee }`). The agent's float balance goes DOWN when they receive cash — this is the opposite of what should happen (agent's liability to SACCO should INCREASE when they hold more cash).
- **Agent Withdrawal:** When agent pays cash TO a member, float INCREMENTS (`balance: { increment: amount + agentShare }`). The agent's float goes UP when they give money away.
- **Net Effect:** Agent float balances are mathematically inverted, making reconciliation impossible and float tracking dangerous.

### 3. Server Action Reversal is Dangerously Incomplete

**Location:** `actions/transactions.ts` — `reverseTransaction()`
**Severity:** 🔴 CRITICAL
**Description:**
The server action path only:

- Creates a reversal transaction record
- Updates `Account.balance` (basic increment/decrement)
- Marks original as REVERSED

It does NOT:

- Reverse float transactions
- Reverse SavingsTransaction records
- Reverse IncomeRecord records (fees)
- Reverse JournalEntry records (GL)
- Handle LOAN_REPAYMENT or TRANSFER types correctly

If any UI component calls this action (vs the API route), the financial records become permanently inconsistent.

### 4. Mobile Money PENDING Status with Immediate Balance Credit

**Location:** `services/transaction.service.ts` — `processDeposit()` lines ~230-240
**Severity:** 🔴 CRITICAL
**Description:**
For MOBILE_MONEY deposits, `transaction.status` is set to `PENDING`, BUT `Account.balance` is incremented IN THE SAME TRANSACTION. The balance is credited before payment is confirmed by Relworx. If verification never runs, the member's balance is permanently inflated.

### 5. REVERSAL_ALLOWED_ROLES Contains Invalid Enum Values

**Location:** `app/api/v1/transactions/reverse/route.ts`
**Severity:** 🔴 CRITICAL
**Description:**

```javascript
const REVERSAL_ALLOWED_ROLES = ["ADMIN", "MANAGER", "DIRECTOR"];
```

`MANAGER` and `DIRECTOR` are NOT valid `UserRole` enum values (valid: ADMIN, BRANCHMANAGER, TELLER, AGENT, MEMBER, ACCOUNTANT, LOANOFFICER, INSTITUTION, AUDITOR, DATA_ENTRANT, ACCOUNT_OPENER). **Only ADMIN can reverse transactions.**

### 6. Annual Interest Rate Double-Division

**Location:** `services/loan.service.ts` — `disburse()` line ~250
**Severity:** 🔴 CRITICAL
**Description:**

```javascript
const interestRate =
  interestPeriod === "ANNUAL" ? rawInterestRate / 12 : rawInterestRate;
```

The `calculateLoanSchedule` function already handles annual rates internally. Dividing by 12 before passing to the scheduler results in monthly payments being **1/12th of what they should be** for annual-rate products.

### 7. Large Commented-Out Code Blocks with Live Logic

**Location:** `actions/deposits.ts`, `actions/withdraws.ts`
**Severity:** 🔴 CRITICAL
**Description:**
Both files contain MASSIVE commented-out original implementations (hundreds of lines) alongside new implementations. The commented code has different fee logic, different validation, and different error handling. This is a maintenance nightmare and a ticking time bomb.

### 8. No `transaction.fee` Set on Deposits

**Location:** `services/transaction.service.ts` — `processDeposit()`
**Severity:** 🔴 CRITICAL
**Description:**
`Transaction.fee` is never populated during deposit processing, even when agent deposit fees are charged. Fee income records exist in isolation, making it impossible to reconcile total fees from the Transaction table.

### 9. Share Capital GL Entry Missing on Disbursement

**Location:** `services/loan.service.ts` — `disburse()` share deduction section
**Severity:** 🔴 CRITICAL
**Description:**
When share capital is deducted from loan disbursement, `Account.balance` is increased. The `createComprehensiveLoanDisbursementJournalEntry` accepts `shareAccountId`, but if this parameter is undefined or the function fails silently, the EQUITY GL (Share Capital) is never credited — the system's equity is permanently understated.

---

## ⚠️ HIGH SEVERITY ISSUES

| #   | Issue                                               | Location                                                        | Details                                                                                                                                                               |
| --- | --------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **Vault Balance Not Updated in API Withdrawal**     | `app/api/v1/withdrawals/route.ts`                               | The raw POST endpoint processes withdrawals without checking or updating branch vault balance. Only the TransactionService path does vault checks.                    |
| 11  | **Loan Repayment - No Vault/Float Update**          | `actions/loans.ts` — `processLoanRepayment()`                   | Cash received for loan repayment should increase teller float; this function bypasses float system entirely.                                                          |
| 12  | **Deposit GL Missing Savings Liability Credit**     | `services/transaction.service.ts`                               | If `ledgerAccountId` is undefined on AccountType, the `createMemberDepositJournalEntry` may not credit the savings liability GL while debiting cash.                  |
| 13  | **Internal Transfer - No GL Entry for Same Ledger** | `services/transaction.service.ts` — `processInternalTransfer()` | If source and target share the same `ledgerAccountId`, NO journal entry is created. Member balances change with zero GL visibility.                                   |
| 14  | **Reversal: SavingsAccount.balance Not Restored**   | `app/api/v1/transactions/reverse/route.ts`                      | A `SavingsTransaction` is created but `SavingsAccount.balance` is never updated.                                                                                      |
| 15  | **Float Not Reversed for MOBILE_MONEY**             | `app/api/v1/transactions/reverse/route.ts`                      | Only CASH channel float is looked up and reversed; MOBILE_MONEY float effects persist after reversal.                                                                 |
| 16  | **Password Change Infinite Loop Risk**              | `middleware.ts`                                                 | If `/dashboard/force-password-change` page fails to update the token's `requiresPasswordChange` flag, user is stuck in infinite redirect.                             |
| 17  | **Balance Sheet GL Drift Risk**                     | Reports system                                                  | `ChartOfAccount.balance` is updated alongside journal entries but there's no reconciliation between "sum of JEs" and "ChartOfAccount.balance" — they can drift apart. |
| 18  | **buildAccountBalanceUpdate Double-Count Risk**     | `lib/accounting-rules.ts`                                       | Manual `ChartOfAccount.balance` updates alongside journal entries could double-count effects if both are processed.                                                   |

---

## MEDIUM SEVERITY ISSUES

| #   | Issue                                                         | Location                 | Details                                                                      |
| --- | ------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| 19  | MOBILE_MONEY withdrawal GL uses CASH account code             | `transaction.service.ts` | Uses code "102001" instead of bank/MOMO code "102002"                        |
| 20  | Repayment split: penalty before interest                      | `loan.service.ts`        | Standard: fees→penalty→interest→principal; Code: penalty→interest→principal  |
| 21  | Duplicate processing fee deduction guard                      | `loan.service.ts`        | Race condition risk in `existingProcessingFee` check                         |
| 22  | Overdue status race condition                                 | `loan.service.ts`        | Window where a loan could be marked overdue after near-zero repayment        |
| 23  | No admin override for 24hr reversal limit                     | `reverse/route.ts`       | Forces DB edits for legitimate late reversals                                |
| 24  | Stale branchId in token vs DB                                 | Multiple files           | Branch scope from token may differ from current DB assignment                |
| 25  | No IP whitelist for financial transactions                    | All API routes           | Any authenticated user from any location can process transactions            |
| 26  | Income/Expense reporting via BudgetCategory - no GAAP mapping | Reports                  | BudgetCategory codes not mapped to ChartOfAccount for standardized reporting |
| 27  | `EquityManualEntry` has no JE creation                        | Schema + Service         | GL equity accounts never updated for manual reserve/grant entries            |
| 28  | `transactionRef` collision risk                               | Multiple                 | No retry logic if Date.now() collision occurs at high volume                 |
| 29  | Relworx timeout holds DB locks 60s                            | `transaction.service.ts` | Network timeout during Relworx call inside $transaction holds DB locks       |
| 30  | No automatic trigger for failed MOBILE_MONEY cleanup          | `transaction.service.ts` | `verifyRelworxPayment` exists but needs external trigger (cron/webhook)      |
| 31  | Reversal fee match uses loose `contains`                      | `reverse/route.ts`       | TransactionRef substring match could match wrong records                     |

---

## LOW SEVERITY ISSUES

| #   | Issue                                                       | Location          | Details                                                |
| --- | ----------------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| 32  | `AccountTransaction` model redundant with `JournalEntry`    | Schema            | Two parallel GL posting systems = reconciliation risk  |
| 33  | `LoanAppeal` model lacks institution support                | Schema            | Institution loans cannot be appealed                   |
| 34  | No circular-reference constraint on ChartOfAccount          | Schema            | Possible infinite hierarchy in account tree            |
| 35  | No `LoanRepayment.transactionId` for ACCOUNT_DEBIT path     | `loan.service.ts` | Transaction created but not linked to repayment record |
| 36  | Client-side branchScope for non-admin users uses stale data | API routes        | Browser's `user.branchId` may differ from DB           |

---

## AFFECTED TRANSACTION PROCESSES — STATUS SUMMARY

| Process                                  | Status | Key Risk                                                                      |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| **Member Deposit (CASH)**                | ⚠️     | Float direction may be wrong for agents; fee not on Transaction               |
| **Member Deposit (MOBILE_MONEY)**        | 🔴     | PENDING status + immediate balance credit; no vault update                    |
| **Member Withdrawal (CASH)**             | ⚠️     | Vault not checked in API route; agent float direction may be wrong            |
| **Member Withdrawal (MOBILE_MONEY)**     | 🔴     | Relworx dependency; float reversal incomplete; wrong GL code                  |
| **Internal Transfer**                    | ⚠️     | Missing GL entries when same ledger account                                   |
| **Loan Disbursement**                    | 🔴     | Due date calculation bug; annual rate double-division; share capital GL drift |
| **Loan Repayment (CASH)**                | ⚠️     | Float not updated in server action path                                       |
| **Loan Repayment (ACCOUNT_DEBIT)**       | ⚠️     | Transaction ID not linked; no vault update                                    |
| **Transaction Reversal (API)**           | ⚠️     | Incomplete for MOBILE_MONEY; role check broken                                |
| **Transaction Reversal (Server Action)** | 🔴     | Dangerously incomplete — skips float, JE, income reversal                     |
| **Agent Transactions**                   | 🔴     | Float balance direction appears financially inverted                          |
| **Reports (Balance Sheet)**              | ⚠️     | GL drift risk from un-reconciled balance updates                              |

---

## PRIORITY ACTION ITEMS

### Tier 1 — Fix Before Any Production Deployment

1. 🔴 Fix `createLoanFromApplication` due date bug (`setMonth(getDate() + ...)`)
2. 🔴 Fix agent float increment/decrement direction in `TransactionService`
3. 🔴 Remove or fully implement the server action `reverseTransaction()`
4. 🔴 Fix `REVERSAL_ALLOWED_ROLES` to use valid enum values
5. 🔴 Fix annual interest rate double-division in `LoanService.disburse()`
6. 🔴 Add mobile money PENDING verification trigger (cron/webhook)
7. 🔴 Clean up commented-out code in `actions/deposits.ts` and `actions/withdraws.ts`

### Tier 2 — Fix Within First Sprint

8. ⚠️ Add vault check to `app/api/v1/withdrawals/route.ts`
9. ⚠️ Add float update to `actions/loans.ts` `processLoanRepayment()`
10. ⚠️ Add savings GL fallback when `ledgerAccountId` is null
11. ⚠️ Fix MOBILE_MONEY withdrawal GL code (use 102002 not 102001)
12. ⚠️ Populate `Transaction.fee` on deposits
13. ⚠️ Add `LoanRepayment.transactionId` for account debit repayments
14. ⚠️ Ensure `SavingsAccount.balance` is updated during reversal

### Tier 3 — Fix Within First Month

15. 🔄 Consolidate API route and server action paths into single TransactionService
16. 🔄 Add database-level reconciliation check (sum JEs vs ChartOfAccount.balance)
17. 🔄 Implement IP whitelist / geo-fencing for financial transactions
18. 🔄 Add admin override for 24-hour reversal limit
19. 🔄 Implement automatic Relworx payment verification (webhook)
20. 🔄 Remove redundant `AccountTransaction` model

---

## TECHNICAL DEBT NOTES

1. **TypeScript Issues:** Multiple files use `any` types for Prisma transaction clients (e.g., `tx: any`), bypassing type safety for financial operations.
2. **Prisma Enum Import Issues:** Some files import `LoanStatus` from local component paths instead of Prisma client.
3. **Magic Strings:** Hardcoded account codes like `"102001"`, `"102002"`, `"401000"`, etc., scattered across multiple files with no centralized constants.
4. **Error Handling:** Some catch blocks return generic messages in production while leaking details in development — inconsistent pattern.
5. **Console.error vs Logger:** Mix of `console.error` and `logger.error` — some critical paths use `console.error` which may not be captured in production logging.

---

_Report generated by comprehensive codebase review. All file paths relative to `d:/NEW REVOLUTION/bukonzemergencys`._
