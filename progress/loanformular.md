# Interest Implementation In Loan Form

## Overview
The loan form was updated so that interest is handled using the loan product's configured rules instead of assuming everything is monthly.

## What Was Important
Two fields matter for interest:
- `interestType`
- `interestPeriod`

### `interestType`
This controls how interest is calculated:
- `FLAT_RATE`
- `REDUCING_BALANCE`

### `interestPeriod`
This controls whether the rate entered on the product is:
- `MONTHLY`
- `ANNUAL`

This was the key fix.

## Problem Before
The form was sending `interestType`, but it was not reliably sending `interestPeriod`.

Because of that, when a loan product was configured with an annual rate, the application could still later behave like the rate was monthly.

Example:
- Product rate: `30% ANNUAL`
- Wrong behavior: system treats it like `30% MONTHLY`
- Correct behavior: monthly schedule should use `30 / 12 = 2.5%`

## How It Was Implemented
In the loan form, when building the payload for submission, the selected loan product is used as the source of truth.

The payload now includes:

```tsx
interestType: (selectedInterestType?.value as "FLAT_RATE" | "REDUCING_BALANCE") || undefined,
interestPeriod: product?.interestPeriod || undefined,
```

## What This Means
- The form still lets the user choose or inherit the interest type.
- The form now also carries the product's `interestPeriod`.
- If the product says the rate is annual, that fact is preserved when the application is created.

## Source Of Interest Values
The form gets these from the selected loan product:
- `interestRate`
- `interestType`
- `interestPeriod`
- `repaymentPeriodDays`

So the loan product defines the interest rules, and the form passes them forward.

## Effect On Calculations
When the product is annual, later schedule calculations can correctly convert the rate into a monthly working rate.

Example:
- Principal: `1,000,000`
- Interest rate: `30% ANNUAL`
- Monthly working rate: `2.5%`

That prevents the system from charging `30%` every month.

## Files Involved
- `app/(dashboard)/dashboard/loan-applications/components/LoanApplicationCreateForm.tsx`
- `app/api/v1/loans/applications/route.ts`
- `types/loanApplication.ts`
- `services/loan.service.ts`
- `lib/services/loan-reports.ts`

## Summary
The main implementation change was simple:
- keep `interestType`
- add `interestPeriod`
- pass both from the product through the form into the application

That is what makes annual interest stay annual instead of being misread as monthly.
