// app/api/v1/accounts/my-account/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/accounts/my-account/transactions - Get authenticated user's transactions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const member = await db.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member record not found" },
        { status: 404 }
      );
    }

    const transactions = await db.transaction.findMany({
      where: {
        memberId: member.id,
      },
      include: {
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
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
        deposit: {
          include: {
            handler: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        withdrawal: {
          include: {
            handler: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: "desc",
      },
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}