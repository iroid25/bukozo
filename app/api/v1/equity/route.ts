import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import { ensureEquityStructure } from '@/lib/services/equity-structure';
import { bumpAccountingSyncState } from '@/lib/services/accounting-sync';
import { resolveBranchScope } from '@/lib/services/branch-scope';
import { HIDDEN_COA_CODES } from '@/lib/accounting/coa-identity';

/**
 * GET /api/v1/equity
 * Returns the Equity tree from the Chart of Accounts.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureEquityStructure();
    const requestedBranchId = request.nextUrl.searchParams.get("branchId");
    const branchId = resolveBranchScope(
      user as { role: string; branchId?: string | null },
      requestedBranchId,
    );

    const [equityAccounts, shareAccountTypes] = await Promise.all([
      db.chartOfAccount.findMany({
        where: {
          OR: [
            { accountCode: { startsWith: '3' } },
            { ledgerType: 'EQUITY' }
          ],
          isActive: true,
          NOT: {
            accountCode: {
              in: Array.from(HIDDEN_COA_CODES),
            },
          },
        },
        include: {
          parent: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              fullCode: true,
            },
          },
          _count: {
            select: {
              children: true,
              journalEntries: true,
            },
          },
        },
        orderBy: { accountCode: 'asc' }
      }),
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

    const getShareCapitalCode = (name: string) => {
      const normalized = name.toLowerCase();
      if (normalized.includes("affiliate")) return "304001";
      if (normalized.includes("ordinary")) return "304002";
      if (normalized.includes("associate")) return "304003";
      return "304004";
    };

    const shareCapitalItems = shareAccountTypes.map((accountType) => {
      const aggregate = balanceMap.get(accountType.id) || {
        amount: 0,
        shares: 0,
        count: 0,
      };

      return {
        id: accountType.id,
        sourceType: "SHARE_ACCOUNT_TYPE",
        accountTypeId: accountType.id,
        accountCode: getShareCapitalCode(accountType.name),
        name: accountType.name,
        rawName: accountType.name,
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
      data: equityAccounts,
      groups: {
        shareCapital: {
          title: "Share Capital",
          items: shareCapitalItems,
          total: shareCapitalTotal,
        },
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

            // Credit: The New Equity Account (Increases Equity)
            await tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: coaAccount.id,
                debitAmount: 0,
                creditAmount: initialBalance,
                description: `Initial Balance for Equity: ${data.equityName}`,
                entryDate: new Date(),
                reference: `INIT-${coaCode}`,
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
                entryDate: new Date(),
                reference: `INIT-${coaCode}`,
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
