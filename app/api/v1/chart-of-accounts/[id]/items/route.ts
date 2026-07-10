import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import {
  findActiveAccountByCodes,
  getAccountCodeCandidates,
  isHiddenCoaCode,
} from "@/lib/accounting/coa-identity";

// GET /api/v1/chart-of-accounts/[id]/items
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = params.id;
    const requestedBranchId = new URL(request.url).searchParams.get("branchId");
    const branchId = resolveBranchScope(
      session.user as { role: string; branchId?: string | null },
      requestedBranchId,
    );
    const account = await db.chartOfAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const resolvedCanonicalAccount = isHiddenCoaCode(account.accountCode)
      ? await findActiveAccountByCodes(db, getAccountCodeCandidates(account.accountCode))
      : null;

    if (isHiddenCoaCode(account.accountCode) && !resolvedCanonicalAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const resolvedAccount = resolvedCanonicalAccount || account;

    let items: any[] = [];
    let type = "GENERIC";

    const shareCapitalCodes = new Set(["304000", "304001", "304002", "304003", "304004"]);
    const isShareCapitalAccount =
      resolvedAccount.ledgerType === "EQUITY" &&
      (shareCapitalCodes.has(resolvedAccount.accountCode) ||
        resolvedAccount.accountCode.startsWith("304"));

    if (isShareCapitalAccount) {
      type = "SHARE_CAPITAL_SOURCES";

      const shareTransactions = await db.shareTransaction.findMany({
        where: {
          isReversed: false,
          ...(branchId
            ? { account: { branchId } }
            : {}),
          transactionType: {
            in: ["PURCHASE", "TRANSFER_IN", "DIVIDEND"],
          },
        },
        include: {
          account: {
            include: {
              accountType: {
                select: {
                  name: true,
                },
              },
              branch: {
                select: {
                  name: true,
                },
              },
              member: {
                select: {
                  memberNumber: true,
                  surname: true,
                  otherNames: true,
                  user: {
                    select: {
                      name: true,
                      phone: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 100,
        orderBy: {
          transactionDate: "desc",
        },
      });

      items = shareTransactions.map((tx) => {
        const memberName =
          tx.account.member?.user?.name?.trim() ||
          [tx.account.member?.surname, tx.account.member?.otherNames]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          "Unknown Member";

        const branchName = tx.account.branch?.name || "Unassigned Branch";
        const memberNumber = tx.account.member?.memberNumber || "-";
        const accountTypeName = tx.account.accountType?.name || "";
        const normalizedType = accountTypeName.toLowerCase();
        const shareCategoryCode = normalizedType.includes("affiliate")
          ? "304001"
          : normalizedType.includes("ordinary")
            ? "304002"
            : normalizedType.includes("associate")
              ? "304003"
              : "304004";

        return {
          id: tx.id,
          name: memberName,
          memberName,
          code: memberNumber,
          memberNumber,
          date: tx.transactionDate,
          remittedAt: tx.transactionDate,
          amount: Number(tx.amount || 0),
          status: tx.transactionType,
          source: tx.transactionType.replaceAll("_", " "),
          details: `Branch: ${branchName} | Share Type: ${accountTypeName || "General"} | Source: ${tx.transactionType.replaceAll("_", " ")}`,
          branch: branchName,
          shareType: accountTypeName || "General",
          shareCategoryCode,
        };
      });

      const loanSharePurchases = await db.transaction.findMany({
        where: {
          type: "SHARES_PURCHASE",
          status: "COMPLETED",
          loanId: { not: null },
          ...(branchId ? { branchId } : {}),
          account: {
            accountType: {
              isShareAccount: true,
            },
          },
        },
        include: {
          account: {
            include: {
              accountType: {
                select: {
                  name: true,
                },
              },
            },
          },
          member: {
            select: {
              memberNumber: true,
              surname: true,
              otherNames: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        take: 100,
        orderBy: {
          transactionDate: "desc",
        },
      });

      const existingLoanRefs = new Set(
        shareTransactions
          .map((tx) => tx.reference)
          .filter((value): value is string => !!value),
      );

      const fallbackLoanItems = loanSharePurchases
        .filter((tx) => {
          const expectedReference = tx.loanId
            ? `LN-SHARE-${tx.loanId.slice(0, 8)}`
            : null;

          return !expectedReference || !existingLoanRefs.has(expectedReference);
        })
        .map((tx) => {
          const memberName =
            tx.member?.user?.name?.trim() ||
            [tx.member?.surname, tx.member?.otherNames]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            "Unknown Member";

          const memberNumber = tx.member?.memberNumber || "-";
          const accountTypeName = tx.account?.accountType?.name || "";
          const normalizedType = accountTypeName.toLowerCase();
          const shareCategoryCode = normalizedType.includes("affiliate")
            ? "304001"
            : normalizedType.includes("ordinary")
              ? "304002"
              : normalizedType.includes("associate")
                ? "304003"
                : "304004";

            return {
              id: `txn-${tx.id}`,
              name: memberName,
              memberName,
              code: memberNumber,
              memberNumber,
              date: tx.transactionDate,
              remittedAt: tx.transactionDate,
              amount: Number(tx.amount || 0),
              status: "PURCHASE",
              source: "Loan deduction - Associate Shares",
              details: `Source: Loan deduction - Associate Shares | Share Type: ${accountTypeName || "General"} | Ref: ${tx.transactionRef}`,
              branch: "Unassigned Branch",
              shareType: accountTypeName || "General",
              shareCategoryCode,
            };
          });

      items = [...items, ...fallbackLoanItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      if (account.accountCode !== "304000") {
        items = items.filter(
          (item) => item.shareCategoryCode === account.accountCode,
        );
      }
    }

    const isLoanAssetAccount =
      account.ledgerType === "ASSETS" &&
      (account.accountCode.startsWith("107") ||
        account.accountName.toLowerCase().includes("loan"));

    if (items.length === 0 && isLoanAssetAccount) {
      type = "LOAN_REPAYMENTS";

      const repayments = await db.loanRepayment.findMany({
        where: branchId
          ? {
              loan: {
                branchId,
              },
            }
          : undefined,
        include: {
          member: {
            select: {
              memberNumber: true,
              surname: true,
              otherNames: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          loan: {
            select: {
              id: true,
              loanApplication: {
                select: {
                  loanProduct: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          handler: {
            select: {
              name: true,
            },
          },
        },
        take: 100,
        orderBy: {
          repaymentDate: "desc",
        },
      });

      items = repayments.map((repayment) => {
        const memberName =
          repayment.member?.user?.name?.trim() ||
          [repayment.member?.surname, repayment.member?.otherNames]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          "Unknown Member";
        const loanProductName =
          repayment.loan?.loanApplication?.loanProduct?.name || "Loan Repayment";
        const principalAmount = Number(repayment.principalPaid || 0);
        const interestAmount = Number(repayment.interestPaid || 0);
        const penaltyAmount = Number(repayment.penaltyPaid || 0);

        return {
          id: repayment.id,
          name: memberName,
          code: repayment.transactionId || repayment.loanId.slice(0, 8),
          date: repayment.repaymentDate,
          amount: principalAmount,
          status: "COMPLETED",
          details: [
            `Loan: ${loanProductName}`,
            `Principal: ${principalAmount.toLocaleString("en-UG")}`,
            `Interest posted to income: ${interestAmount.toLocaleString("en-UG")}`,
            `Penalty posted to income: ${penaltyAmount.toLocaleString("en-UG")}`,
            `Channel: ${repayment.channel || "-"}`,
            `Collected by: ${repayment.handler?.name || "-"}`,
          ].join(" | "),
          principalAmount,
          interestAmount,
          penaltyAmount,
        };
      });
    }

    if (Array.isArray(items)) {
      items = items.filter((item) => !isHiddenCoaCode(item.code) && !isHiddenCoaCode(item.accountCode));
    }

    // 1. LIABILITY / EQUITY (Member Accounts)
    if (
      items.length === 0 &&
      (account.ledgerType === "LIABILITIES" || account.ledgerType === "EQUITY")
    ) {
      // Find AccountType strictly by mapping, fallback to name mapping just in case
      let accountType = await db.accountType.findFirst({
        where: { ledgerAccountId: account.id },
      });

      if (!accountType && account.product) {
         accountType = await db.accountType.findFirst({
           where: { name: account.product },
         });
      }

      if (accountType) {
        type = "MEMBER_ACCOUNTS";
        // Fetch Member Accounts linked to this type
        const memberAccounts = await db.account.findMany({
          where: {
            accountTypeId: accountType.id,
            ...(branchId ? { branchId } : {}),
          },
          include: {
            member: {
              select: { 
                  surname: true, 
                  otherNames: true, 
                  memberNumber: true,
                  user: { select: { name: true } }
              },
            },
          },
          take: 50, // Limit for performance
          orderBy: { openedAt: "desc" },
        });
        
        items = memberAccounts.map(acc => {
           // Construct name from User or Member fields
           let memberName = "Unknown Member";
           if (acc.member) {
               if (acc.member.user?.name) {
                   memberName = acc.member.user.name;
               } else {
                   memberName = [acc.member.surname, acc.member.otherNames].filter(Boolean).join(" ");
               }
           }

           return {
              id: acc.id,
              name: memberName || "Member",
              code: acc.accountNumber,
              date: acc.openedAt,
              amount: acc.balance,
              status: acc.status,
              details: `Member: ${acc.member?.memberNumber || "-"}`
           };
        });
      }
    }

    // 2. ASSETS (Fixed Assets or Loans)
    else if (account.ledgerType === "ASSETS") {
      // Logic: Exact name match or contains code
      const codeMatch = account.accountName.match(/\((FA-\d+)\)/);
      const assetCode = codeMatch ? codeMatch[1] : null;

      if (assetCode) {
         type = "FIXED_ASSET";
         const asset = await db.fixedAsset.findFirst({
           where: {
             assetCode: assetCode,
             ...(branchId ? { branchId } : {}),
           }
         });
         
         if (asset) {
            items = [{
              id: asset.id,
              name: asset.assetName,
              code: asset.assetCode,
              date: asset.purchaseDate,
              amount: asset.purchasePrice,
              status: asset.status,
              details: `Value: ${asset.currentValue} | Dep: ${asset.depreciationRate}%`
            }];
         }
      }
    }

    // 3. INCOME / EXPENSES
    else if (resolvedAccount.ledgerType === "INCOME" || resolvedAccount.ledgerType === "EXPENDITURES") {
      // Find BudgetCategory by name
      const category = await db.budgetCategory.findFirst({
        where: { 
            name: resolvedAccount.accountName, 
            kind: resolvedAccount.ledgerType === "INCOME" ? "INCOME" : "EXPENSE" 
        }
      });

      if (category) {
        if (resolvedAccount.ledgerType === "INCOME") {
            type = "INCOME_RECORDS";
          const incomes = await db.incomeRecord.findMany({
                where: {
                  categoryId: category.id,
                  ...(branchId ? { branchId } : {}),
                },
                take: 50,
                orderBy: { date: "desc" }
            });
             items = incomes.map(rec => ({
                id: rec.id,
                name: rec.description || "Income Record",
                code: rec.receiptNumber || "-",
                date: rec.date,
                amount: rec.amount,
                status: "COMPLETED",
                details: `Source: ${rec.depositorName || "Unknown"}`
             }));
        } else {
            type = "EXPENSE_RECORDS";
             const expenses = await db.expenditureRecord.findMany({
                where: {
                  categoryId: category.id,
                  ...(branchId ? { branchId } : {}),
                },
                take: 50,
                orderBy: { date: "desc" }
            });
             items = expenses.map(rec => ({
                id: rec.id,
                name: rec.description || "Expense Record",
                code: rec.receiptNumber || "-",
                date: rec.date,
                amount: rec.amount,
                status: rec.status,
                details: `Payee: ${rec.payee || "-"}`
             }));
        }
      }
    }

    // 4. FALLBACK: GENERAL JOURNAL ENTRIES
    // If no specific sub-ledger logic matched, fetch raw journal entries to provide the "exact stats/history"
    if (items.length === 0) {
      type = "JOURNAL_ENTRIES";
          const entries = await db.journalEntry.findMany({
        where: {
          accountId: resolvedAccount.id,
          ...(branchId
            ? {
                OR: [
                  { transaction: { branchId } },
                  { transactionId: null, branchId },
                ],
              }
            : {}),
        },
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { transaction: { select: { transactionRef: true } } }
      });

      items = entries.map(entry => ({
         id: entry.id,
         name: entry.description || "Journal Entry",
         code: entry.transaction?.transactionRef || entry.entryNumber,
         date: entry.createdAt,
         amount: entry.debitAmount > 0 ? entry.debitAmount : entry.creditAmount,
         status: "COMPLETED",
         details: entry.debitAmount > 0 ? "Debit (Dr)" : "Credit (Cr)"
      }));
    }

    return NextResponse.json({ 
        account: {
            id: resolvedAccount.id,
            name: resolvedAccount.accountName,
            code: resolvedAccount.accountCode,
            type: resolvedAccount.ledgerType
        },
        itemsType: type,
        items
    });

  } catch (error) {
    console.error("Error fetching account items:", error);
    return NextResponse.json(
      { error: "Failed to fetch account items" },
      { status: 500 }
    );
  }
}
