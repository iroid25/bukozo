import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUserWithFreshBranch } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserWithFreshBranch();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId") || undefined;
    const institutionId = searchParams.get("institutionId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");
    const branchId = searchParams.get("branchId") || undefined;
    const branchScope =
      user.role === UserRole.ADMIN
        ? branchId && branchId !== "all" && branchId !== "ALL"
          ? branchId
          : undefined
        : user.branchId || undefined;

    const whereClause: any = {
      type: "DEPOSIT",
      status: "COMPLETED",
      ...(!memberId && !institutionId && branchScope ? { account: { branchId: branchScope } } : {}),
    };
    if (memberId) whereClause.memberId = memberId;
    if (institutionId) whereClause.institutionId = institutionId;

    const transactions = await db.transaction.findMany({
      where: whereClause,
      take: limit,
      include: {
        deposit: true,
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        institution: {
          select: {
            id: true,
            institutionName: true,
            institutionNumber: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    const deposits = transactions.map((tx) => ({
      id: tx.deposit?.id ?? tx.id,
      transactionId: tx.id,
      memberId: tx.memberId,
      institutionId: tx.institutionId,
      accountId: tx.accountId,
      amount: tx.amount,
      depositDate: tx.transactionDate,
      handlerUserId: tx.processedByUserId,
      channel: tx.channel,
      mobileMoneyRef: tx.deposit?.mobileMoneyRef ?? null,
      depositorName: tx.deposit?.depositorName ?? null,
      institutionName: tx.deposit?.institutionName ?? null,
      transaction: {
        id: tx.id,
        transactionRef: tx.transactionRef,
        type: tx.type,
        status: tx.status,
        description: tx.description,
        amount: tx.amount,
        currency: tx.currency ?? "UGX",
        branchId: tx.branchId,
        notes: tx.notes,
      },
      member: tx.member
        ? {
            id: tx.member.id,
            memberNumber: tx.member.memberNumber,
            user: {
              id: tx.member.user.id,
              name: tx.member.user.name,
              email: tx.member.user.email,
              phone: tx.member.user.phone,
              image: tx.member.user.image,
            },
          }
        : null,
      institution: tx.institution
        ? {
            id: tx.institution.id,
            institutionNumber: tx.institution.institutionNumber,
            institutionName: tx.institution.institutionName,
            institutionType: (tx.institution as any).institutionType ?? "",
            institutionEmail: (tx.institution as any).institutionEmail ?? "",
            institutionPhone: (tx.institution as any).institutionPhone ?? "",
            user: tx.institution.user
              ? {
                  id: tx.institution.user.id,
                  name: tx.institution.user.name,
                  email: tx.institution.user.email,
                  phone: tx.institution.user.phone,
                  image: tx.institution.user.image,
                }
              : null,
          }
        : null,
      account: {
        id: tx.account.id,
        accountNumber: tx.account.accountNumber,
        balance: tx.account.balance,
        accountType: {
          id: tx.account.accountType.id,
          name: tx.account.accountType.name,
          minBalance: (tx.account.accountType as any).minBalance ?? 0,
        },
        branch: tx.account.branch
          ? {
              id: tx.account.branch.id,
              name: tx.account.branch.name,
              location: (tx.account.branch as any).location ?? "",
            }
          : { id: "", name: "Unknown", location: "" },
      },
      handler: tx.processedByUser
        ? {
            id: tx.processedByUser.id,
            name: tx.processedByUser.name,
            role: tx.processedByUser.role,
          }
        : { id: "", name: "System", role: "SYSTEM" },
    }));

    return NextResponse.json({ data: deposits });
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserWithFreshBranch();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    // 1. Basic validation
    if (!data.accountId || !data.amount) {
      return NextResponse.json(
        { error: "Account ID and amount are required" },
        { status: 400 },
      );
    }

    // Share accounts must be funded through /api/v1/shares/purchase, which
    // records the ShareAccount/ShareTransaction and the 304000 Share Capital
    // GL entry. A plain deposit only touches the generic Account.balance and
    // would silently miss Share Capital.
    const targetAccount = await db.account.findUnique({
      where: { id: data.accountId },
      select: { accountType: { select: { isShareAccount: true } } },
    });
    if (targetAccount?.accountType?.isShareAccount) {
      return NextResponse.json(
        {
          error:
            "This is a share account. Use Share Purchase/Transfer to fund it, not a regular deposit.",
        },
        { status: 400 },
      );
    }

    // 2. Call TransactionService to process the deposit
    // The service handles transaction records, balance updates, and float logic
    const { TransactionService } =
      await import("@/services/transaction.service");
    const result = await TransactionService.processDeposit(data, user.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Deposit processed successfully",
      data: result.data,
      floatBalance: result.floatBalance,
    });
  } catch (error: any) {
    console.error("Deposit Creation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process deposit" },
      { status: 500 },
    );
  }
}
