import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;


type ReportRow = {
  id: string;
  remittedAt: string;
  memberName: string;
  memberNumber: string;
  shareType: string;
  source: string;
  branch: string;
  amount: number;
};

function buildDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return {};

  const filter: { gte?: Date; lte?: Date } = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) {
    const date = new Date(endDate);
    date.setHours(23, 59, 59, 999);
    filter.lte = date;
  }

  return { transactionDate: filter };
}

function resolveMemberName(member: any) {
  return (
    member?.user?.name?.trim() ||
    [member?.surname, member?.otherNames]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Unknown Member"
  );
}

function resolveShareType(accountTypeName?: string) {
  const normalized = (accountTypeName || "").toLowerCase();
  if (normalized.includes("affiliate")) return "Affiliate Members";
  if (normalized.includes("ordinary")) return "Ordinary Members";
  if (normalized.includes("associate")) return "Associate Members";
  return accountTypeName || "General";
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const dateFilter = buildDateFilter(startDate, endDate);

    const shareTransactions = await db.shareTransaction.findMany({
      where: {
        isReversed: false,
        transactionType: {
          in: ["PURCHASE", "TRANSFER_IN", "DIVIDEND"],
        },
        ...dateFilter,
      },
      include: {
        account: {
          include: {
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
            member: {
              select: {
                memberNumber: true,
                surname: true,
                otherNames: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 250,
    });

    const loanSharePurchases = await db.transaction.findMany({
      where: {
        type: "SHARES_PURCHASE",
        status: "COMPLETED",
        loanId: { not: null },
        account: {
          accountType: {
            isShareAccount: true,
          },
        },
        ...dateFilter,
      },
      include: {
        account: {
          include: {
            accountType: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        member: {
          select: {
            memberNumber: true,
            surname: true,
            otherNames: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { transactionDate: "desc" },
      take: 250,
    });

    const existingRefs = new Set(
      shareTransactions
        .map((tx) => tx.reference)
        .filter((value): value is string => Boolean(value)),
    );

    const remittances: ReportRow[] = [
      ...shareTransactions.map((tx) => {
        const memberName = resolveMemberName(tx.account.member);
        const branch = tx.account.branch?.name || "Unassigned Branch";
        const shareType = resolveShareType(tx.account.accountType?.name);

        return {
          id: tx.id,
          remittedAt: tx.transactionDate.toISOString(),
          memberName,
          memberNumber: tx.account.member?.memberNumber || "-",
          shareType,
          source: tx.transactionType.replaceAll("_", " "),
          branch,
          amount: Number(tx.amount || 0),
        };
      }),
      ...loanSharePurchases
        .filter((tx) => {
          const expectedReference = tx.loanId
            ? `LN-SHARE-${tx.loanId.slice(0, 8)}`
            : null;
          return !expectedReference || !existingRefs.has(expectedReference);
        })
        .map((tx) => {
          const memberName = resolveMemberName(tx.member);
          const branch = tx.account.branch?.name || "Unassigned Branch";
          const shareType = resolveShareType(tx.account.accountType?.name);

          return {
            id: `txn-${tx.id}`,
            remittedAt: tx.transactionDate.toISOString(),
            memberName,
            memberNumber: tx.member?.memberNumber || "-",
            shareType,
            source: "Loan deduction - Associate Shares",
            branch,
            amount: Number(tx.amount || 0),
          };
        }),
    ].sort((a, b) => new Date(b.remittedAt).getTime() - new Date(a.remittedAt).getTime());

    const uniqueMembers = new Set(remittances.map((row) => row.memberNumber));
    const totalAmount = remittances.reduce((sum, row) => sum + row.amount, 0);
    const loanDeductions = remittances.filter((row) =>
      row.source.toLowerCase().includes("loan deduction"),
    );

    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: "share-capital",
          accountCode: "304000",
          accountName: "Share Capital",
        },
        data: remittances,
        summary: {
          totalRecords: remittances.length,
          totalAmount,
          averageAmount: remittances.length ? totalAmount / remittances.length : 0,
          uniqueMembers: uniqueMembers.size,
          loanDeductionCount: loanDeductions.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching share capital remittances:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch share capital remittances",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
