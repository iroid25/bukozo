import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountTypeId = request.nextUrl.searchParams.get("accountTypeId");

    if (!accountTypeId) {
      return NextResponse.json(
        { success: false, error: "accountTypeId is required" },
        { status: 400 },
      );
    }

    const branchId = resolveBranchScope(
      user as { role: string; branchId?: string | null },
      request.nextUrl.searchParams.get("branchId"),
    );

    const accountType = await db.accountType.findUnique({
      where: { id: accountTypeId },
      select: {
        id: true,
        name: true,
        sharePrice: true,
        isShareAccount: true,
      },
    });

    if (!accountType || !accountType.isShareAccount) {
      return NextResponse.json(
        { success: false, error: "Share account type not found" },
        { status: 404 },
      );
    }

    const [accounts, transactions] = await Promise.all([
      db.shareAccount.findMany({
        where: {
          accountTypeId,
          status: "ACTIVE",
          ...(branchId ? { branchId } : {}),
        },
        select: {
          id: true,
          accountNumber: true,
          numberOfShares: true,
          shareValue: true,
          totalValue: true,
          status: true,
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
                },
              },
            },
          },
        },
        orderBy: [{ totalValue: "desc" }, { accountNumber: "asc" }],
      }),
      db.shareTransaction.findMany({
        where: {
          isReversed: false,
          account: {
            accountTypeId,
            ...(branchId ? { branchId } : {}),
          },
        },
        include: {
          account: {
            include: {
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
      }),
    ]);

    const resolveMemberName = (member?: {
      surname?: string | null;
      otherNames?: string | null;
      user?: { name?: string | null } | null;
    } | null) =>
      member?.user?.name?.trim() ||
      [member?.surname, member?.otherNames].filter(Boolean).join(" ").trim() ||
      "Unknown Member";

    const sourceAccounts = accounts.map((account) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      ownerName: resolveMemberName(account.member),
      ownerNumber: account.member?.memberNumber || "-",
      branchName: account.branch?.name || "Unassigned Branch",
      numberOfShares: Number(account.numberOfShares || 0),
      shareValue: Number(account.shareValue || 0),
      totalValue: Number(account.totalValue || 0),
      status: account.status,
    }));

    const transactionRows = transactions.map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      accountNumber: transaction.account.accountNumber,
      ownerName: resolveMemberName(transaction.account.member),
      ownerNumber: transaction.account.member?.memberNumber || "-",
      branchName: transaction.account.branch?.name || "Unassigned Branch",
      transactionType: transaction.transactionType,
      date: transaction.transactionDate,
      reference: transaction.reference || "-",
      description: transaction.description || "-",
      shares: Number(transaction.shares || 0),
      shareValue: Number(transaction.shareValue || 0),
      amount: Number(transaction.amount || 0),
      sharesBefore: Number(transaction.sharesBefore || 0),
      sharesAfter: Number(transaction.sharesAfter || 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        accountType,
        sourceCount: sourceAccounts.length,
        sourceTotal: sourceAccounts.reduce(
          (sum, source) => sum + Number(source.totalValue || 0),
          0,
        ),
        transactionCount: transactionRows.length,
        transactionTotal: transactionRows.reduce(
          (sum, transaction) => sum + Number(transaction.amount || 0),
          0,
        ),
        sourceAccounts,
        transactions: transactionRows,
      },
    });
  } catch (error) {
    console.error("Error fetching share capital sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch share capital sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
