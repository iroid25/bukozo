import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");

    const whereClause: any = {};
    if (memberId) whereClause.memberId = memberId;

    const deposits = await db.deposit.findMany({
      where: whereClause,
      take: limit,
      include: {
        transaction: true,
        member: {
          include: {
            user: {
              select: {
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
        handler: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        depositDate: "desc",
      },
    });

    return NextResponse.json({ data: deposits });
  } catch (error: any) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
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
