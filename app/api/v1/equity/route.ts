import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import { ensureEquityStructure } from '@/lib/services/equity-structure';
import { bumpAccountingSyncState } from '@/lib/services/accounting-sync';
import { resolveBranchScope } from '@/lib/services/branch-scope';
import { getRetainedEarnings } from '@/lib/accounting/getRetainedEarnings';

/**
 * GET /api/v1/equity
 *
 * Every equity bucket is now backed by a real table:
 *  - statutoryReserves / grantsAndDonations: EquityManualEntry rows (a real,
 *    structured record per reserve allocation / grant received). The
 *    ChartOfAccount leaf + JournalEntry pair created alongside each new
 *    entry (see POST below) is left untouched and keeps feeding
 *    reports/trial-balance — this table is the new read path for the page,
 *    not a replacement for the ledger.
 *  - retainedEarnings: computed live from IncomeRecord minus
 *    ExpenditureRecord (no separate table needed — it's arithmetic over
 *    data that's already real).
 *  - shareCapital: derived entirely from the real ShareAccount/AccountType
 *    tables, keyed by the stable `accountTypeId`.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // COA structure-seeding must keep running unchanged: journal posting
    // (the dual-write in POST below) and reports still depend on these
    // ChartOfAccount rows existing.
    await ensureEquityStructure();
    const requestedBranchId = request.nextUrl.searchParams.get("branchId");
    const branchId = resolveBranchScope(
      user as { role: string; branchId?: string | null },
      requestedBranchId,
    );
    const branchFilter = branchId ? { branchId } : {};

    // Manual entries: when a specific branch is selected, include both
    // entries for that branch AND global entries (branchId = null) which
    // are SACCO-wide and should appear in every branch view.
    const manualEntryWhere = branchId
      ? { OR: [{ branchId }, { branchId: null }] }
      : {};

    // Retained Earnings is always SACCO-wide — it represents cumulative
    // entity-level profit/loss, not a per-branch figure. Uses the shared
    // getRetainedEarnings() function (lib/accounting/getRetainedEarnings.ts)
    // — the same function the income statistics API calls — so both pages
    // agree on the same numbers by construction.
    // TODO: When period-close logic exists, this should read
    // ChartOfAccount.balance for account 303000 instead of computing live.
    const [manualEntries, retained, shareAccountTypes] = await Promise.all([
      db.equityManualEntry.findMany({
        where: manualEntryWhere,
        orderBy: { date: 'desc' },
      }),
      getRetainedEarnings(),
      db.accountType.findMany({
        where: {
          OR: [
            { isShareAccount: true },
            { shareAccounts: { some: { status: "ACTIVE" } } },
          ],
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const toManualEntryNode = (entry: (typeof manualEntries)[number]) => ({
      source: "EQUITY_MANUAL_ENTRY" as const,
      id: `EQUITY_MANUAL_ENTRY:${entry.id}`,
      key: entry.id,
      isManualLedger: false as const,
      entryId: entry.id,
      type: entry.type,
      amount: entry.amount,
      description: entry.description,
      donorOrSource: entry.source,
      reference: entry.reference,
      date: entry.date,
      branchId: entry.branchId,
      recordedByUserId: entry.recordedByUserId,
    });

    const statutoryReserveItems = manualEntries
      .filter((entry) => entry.type === "STATUTORY_RESERVE")
      .map(toManualEntryNode);
    const grantItems = manualEntries
      .filter((entry) => entry.type === "GRANT_DONATION")
      .map(toManualEntryNode);

    const sumAmount = (items: Array<{ amount: number }>) =>
      items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalIncome = retained.totalIncome;
    const totalExpenditure = retained.totalExpenditure;

    const statutoryReserves = {
      title: "Statutory Reserves",
      items: statutoryReserveItems,
      total: sumAmount(statutoryReserveItems),
    };

    const grantsAndDonations = {
      title: "Grants and Donations",
      items: grantItems,
      total: sumAmount(grantItems),
    };

    const retainedEarnings = {
      title: "Retained Earnings",
      amount: totalIncome - totalExpenditure,
      totalIncome,
      totalExpenditure,
      isComputed: true as const,
    };

    const shareAccountTypeIds = shareAccountTypes.map((accountType) => accountType.id);
    const shareBalanceRows =
      shareAccountTypeIds.length > 0
        ? await db.shareAccount.groupBy({
            by: ["accountTypeId"],
            where: {
              accountTypeId: { in: shareAccountTypeIds },
              status: "ACTIVE",
              ...(branchId ? { branchId } : {}),
            },
            _sum: {
              totalValue: true,
              numberOfShares: true,
            },
            _count: { _all: true },
          })
        : [];

    const balanceMap = new Map(
      shareBalanceRows.map((row) => [
        row.accountTypeId,
        {
          amount: Number(row._sum.totalValue || 0),
          shares: Number(row._sum.numberOfShares || 0),
          count:
            typeof row._count === "object" && "_all" in row._count
              ? Number(row._count._all || 0)
              : 0,
        },
      ]),
    );

    const shareCapitalItems = shareAccountTypes.map((accountType) => {
      const aggregate = balanceMap.get(accountType.id) || {
        amount: 0,
        shares: 0,
        count: 0,
      };

      return {
        source: "SHARE_ACCOUNT_TYPE" as const,
        id: `SHARE_ACCOUNT_TYPE:${accountType.id}`,
        key: accountType.id,
        isManualLedger: false as const,
        accountTypeId: accountType.id,
        name: accountType.name,
        amount: aggregate.amount,
        accountCount: aggregate.count,
        numberOfShares: aggregate.shares,
        shareValue: Number(accountType.sharePrice || 0),
      };
    });

    const shareCapitalTotal = shareCapitalItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      statutoryReserves,
      grantsAndDonations,
      retainedEarnings,
      shareCapital: {
        title: "Share Capital",
        items: shareCapitalItems,
        total: shareCapitalTotal,
      },
    });
  } catch (error: any) {
    console.error("Error fetching equity accounts:", error);
    return NextResponse.json({ error: "Failed to fetch equity accounts" }, { status: 500 });
  }
}

/**
 * POST /api/v1/equity
 * Creates a new Equity sub-account in the COA.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const data = await request.json();

    const result = await db.$transaction(async (tx) => {
      const getNextAvailableCode = async (
        baseCode: string,
        suffixLength: number,
        level: number,
      ) => {
        const latestAccount = await tx.chartOfAccount.findFirst({
          where: {
            accountCode: { startsWith: baseCode },
            level,
          },
          orderBy: { accountCode: "desc" },
        });

        let nextCodeInt = 1;
        if (latestAccount) {
          const suffix = latestAccount.accountCode.substring(baseCode.length);
          if (suffix) {
            nextCodeInt = Number.parseInt(suffix, 10) + 1;
          }
        }

        let candidate = `${baseCode}${nextCodeInt.toString().padStart(suffixLength, "0")}`;
        while (
          await tx.chartOfAccount.findUnique({
            where: { accountCode: candidate },
          })
        ) {
          nextCodeInt += 1;
          candidate = `${baseCode}${nextCodeInt.toString().padStart(suffixLength, "0")}`;
        }

        return candidate;
      };

      if (data.createCategory) {
        const categoryName = String(data.categoryName || "").trim();
        const requestedParentCode = String(data.parentClassificationCode || "300000").trim();

        if (!categoryName) {
          throw new Error("Category name is required.");
        }

        const parentAccount =
          (await tx.chartOfAccount.findUnique({
            where: { accountCode: requestedParentCode },
          })) ||
          (await tx.chartOfAccount.findUnique({
            where: { accountCode: "300000" },
          }));

        if (!parentAccount) {
          throw new Error("Equity root account not found.");
        }

        const existingCategory = await tx.chartOfAccount.findFirst({
          where: {
            accountName: { equals: categoryName, mode: "insensitive" },
            parentId: parentAccount.id,
            ledgerType: "EQUITY",
            isActive: true,
          },
        });

        if (existingCategory) {
          return existingCategory;
        }

        let generatedCode = "";
        if (parentAccount.accountCode === "300000") {
          const latestTopLevel = await tx.chartOfAccount.findFirst({
            where: {
              parentId: parentAccount.id,
              ledgerType: "EQUITY",
            },
            orderBy: { accountCode: "desc" },
          });

          let nextCode = latestTopLevel
            ? Number(latestTopLevel.accountCode) + 1000
            : 301000;
          generatedCode = String(nextCode).padStart(6, "0");
          while (
            await tx.chartOfAccount.findUnique({
              where: { accountCode: generatedCode },
            })
          ) {
            nextCode += 1000;
            generatedCode = String(nextCode).padStart(6, "0");
          }
        } else if (parentAccount.accountCode.endsWith("000")) {
          const prefix = parentAccount.accountCode.slice(0, 3);
          generatedCode = await getNextAvailableCode(prefix, 3, parentAccount.level + 1);
        } else {
          const prefix = parentAccount.accountCode.endsWith("00")
            ? parentAccount.accountCode.slice(0, 4)
            : parentAccount.accountCode;
          generatedCode = await getNextAvailableCode(prefix, 2, parentAccount.level + 1);
        }

        return tx.chartOfAccount.create({
          data: {
            accountName: categoryName,
            accountCode: generatedCode,
            fullCode: generatedCode,
            ledgerType: "EQUITY",
            debitCredit: "CR",
            isActive: true,
            level: parentAccount.level + 1,
            parentId: parentAccount.id,
            description: `Equity category under ${parentAccount.accountName}`,
            notes: "EQUITY_CATEGORY",
            category: parentAccount.category || "EQUITY",
          },
        });
      }

      // 1. Find the parent classification in COA
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { accountCode: data.classificationCode }
      });

      if (!parentAccount) {
        throw new Error(`Classification account (${data.classificationCode}) not found. Please verify COA.`);
      }

      const category = parentAccount.category || parentAccount.accountName;

      // 2. Generate COA Code under the selected equity category
      const parentCode = data.classificationCode;
      const baseCode = parentCode.endsWith("000")
        ? parentCode.slice(0, 3)
        : parentCode.endsWith("00")
          ? parentCode.slice(0, 4)
          : parentCode;
      const suffixLength = parentCode.endsWith("000") ? 3 : 2;

      const coaCode = await getNextAvailableCode(
        baseCode,
        suffixLength,
        parentAccount.level + 1,
      );

      // 3. Create the Chart of Account for this specific Equity entry
       const coaAccount = await tx.chartOfAccount.create({
         data: {
           accountName: data.equityName,
           accountCode: coaCode,
           fullCode: coaCode,
           ledgerType: "EQUITY",
           debitCredit: "CR", // Equity reflects a Credit normal balance
           isActive: true,
           level: parentAccount.level + 1,
           parentId: parentAccount.id,
           description: data.description || `Equity entry under [${category}]`,
           notes: "EQUITY_ITEM",
           category: category
         }
       });

       // 4. Create Initial Journal Entry if balance > 0
       const initialBalance = Number(data.initialBalance || 0);
       const userDate = data.recordDate ? new Date(data.recordDate) : new Date();
       const userReceiptNo = String(data.receiptNo || "").trim() || null;
       const userDescription = String(data.description || "").trim() || null;
       const userBranchId = String(data.branchId || "").trim() || null;

       if (initialBalance > 0) {
           if (!data.counterpartyAccountCode) {
               throw new Error("Counterparty Account Code is required when an initial balance is provided.");
           }

           const counterpartyAccount = await tx.chartOfAccount.findUnique({
             where: { accountCode: data.counterpartyAccountCode }
           });

           if (!counterpartyAccount) {
             throw new Error(`Counterparty account (${data.counterpartyAccountCode}) not found.`);
           }

           const entryNumber = `JE-EQUITY-INIT-${Date.now()}`;
           const reference = userReceiptNo || `INIT-${coaCode}`;

            // Credit: The New Equity Account (Increases Equity)
            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: coaAccount.id,
                debitAmount: 0,
                creditAmount: initialBalance,
                description: `Initial Balance for Equity: ${data.equityName}`,
                entryDate: userDate,
                reference,
                createdByUserId: user.id,
              }
            });

            // Debit: Counterparty Account (Increases Asset/Cash where the money was received)
            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: counterpartyAccount.id,
                debitAmount: initialBalance,
                creditAmount: 0,
                description: `Investment for Equity: ${data.equityName}`,
                entryDate: userDate,
                reference,
                createdByUserId: user.id,
              }
            });

           // Update Balances
           await tx.chartOfAccount.update({
             where: { id: coaAccount.id },
             data: { balance: { increment: initialBalance }, creditBalance: { increment: initialBalance } }
           });

           await tx.chartOfAccount.update({
             where: { id: counterpartyAccount.id },
             data: { balance: { increment: initialBalance }, debitBalance: { increment: initialBalance } }
           });

           // Dual-write: the COA leaf + journal entries above stay untouched
           // (reports/trial-balance/balance-sheet still read them), but the
           // Equity page itself now reads EquityManualEntry as the real
           // source for Statutory Reserves / Grants and Donations. Only
           // record here when the new item falls under one of those two
           // buckets (304xxx Share Capital already has its own real source
           // via ShareAccount, and 303000 Retained Earnings is computed
           // live, not manually entered).
           const manualEntryType = coaCode.startsWith("301")
             ? "STATUTORY_RESERVE"
             : coaCode.startsWith("302")
               ? "GRANT_DONATION"
               : null;

           if (manualEntryType) {
             await tx.equityManualEntry.create({
               data: {
                 type: manualEntryType,
                 amount: initialBalance,
                 description: data.equityName,
                 source: userDescription,
                 reference,
                 date: userDate,
                 branchId: userBranchId,
                 recordedByUserId: user.id,
               },
             });
           }
       }

       return coaAccount;
    });

    void bumpAccountingSyncState("Equity entry created");
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error creating equity:", error);
    return NextResponse.json(
      { error: "Failed to create equity entry", details: error.message },
      { status: 500 }
    );
  }
}
