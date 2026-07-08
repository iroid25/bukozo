# Organisational Reserve Dashboard - UI Guide

## What You Should See at `/dashboard/accounts/vault`

### Header Section
- **Title**: "Organisational Reserve"
- **Subtitle**: "Central fund management and branch allocations"
- **Refresh Button**: Top right corner

### Summary Cards (4 cards in a row)
1. **Total Reserve Balance** (Blue) - Shows HQ Central Reserve balance
2. **Physical Cash On Hand** (Purple) - Available for allocation
3. **Total Branch Reserves** (Green) - Sum across all branches
4. **Quick Actions** (Green) - Contains:
   - "Add Funds" button
   - "Fund a Branch" button (ADMIN only) ← **THIS IS WHERE YOU ALLOCATE FLOAT**
   - "Withdraw to Bank" button

### Tabbed Interface (3 tabs)

#### Tab 1: Overview
- Weekly Reserve Trend chart
- Transaction Distribution pie chart
- Recent Transactions list

#### Tab 2: Branch Reserves ← **IMPORTANT: SHOWS ALL BRANCHES**
- Table with columns:
  - Branch Name
  - Location
  - Reserve Balance
  - Physical Cash
  - Last Updated
  - Actions (Fund button for each branch)

#### Tab 3: Allocation History
- Shows all fund movements between HQ and branches
- Currently shows placeholder message

## How to Allocate Float to a Branch

### Method 1: From Quick Actions Card
1. Click "Fund a Branch" button (in Quick Actions card)
2. Select branch from dialog
3. Modal opens: "Allocate Branch Reserve & Float"
4. Enter Cash Amount (e.g., 10,000,000)
5. Enter Float Amount (e.g., 5,000,000)
6. Total shows: 15,000,000
7. Click "Allocate Funds"
8. ✅ Org Reserve reduces by 15M
9. ✅ Branch Reserve increases by 15M

### Method 2: From Branch Reserves Tab
1. Click "Branch Reserves" tab
2. Find the branch in the table
3. Click "Fund" button in the Actions column
4. Same modal opens as Method 1
5. Follow steps 4-9 above

## Troubleshooting

If you don't see this UI:
1. Hard refresh: Ctrl + Shift + R
2. Clear browser cache
3. Restart dev server: `pnpm dev`
4. Check you're logged in as ADMIN (some features are ADMIN-only)
