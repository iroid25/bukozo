import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountTypeId = request.nextUrl.searchParams.get("accountTypeId");

    if (!accountTypeId) {
      return NextResponse.json(
        { success: false, error: "accountTypeId is required" },
        { status: 400 },
      );
    }

    const accountType = await db.accountType.findUnique({
      where: { id: accountTypeId },
      select: {
        id: true,
        name: true,
        ledgerAccountId: true,
      },
    });

    if (!accountType) {
      return NextResponse.json(
        { success: false, error: "Savings product not found" },
        { status: 404 },
      );
    }

    const accounts = await db.account.findMany({
      where: {
        accountTypeId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
        status: true,
        branch: {
          select: {
            name: true,
          },
        },
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionNumber: true,
            institutionName: true,
          },
        },
      },
      orderBy: [{ balance: "desc" }, { accountNumber: "asc" }],
    });

    const sources = accounts.map((account) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      ownerName:
        account.member?.user?.name ||
        account.institution?.institutionName ||
        "Unknown Owner",
      ownerNumber:
        account.member?.memberNumber ||
        account.institution?.institutionNumber ||
        "-",
      branchName: account.branch?.name || "N/A",
      balance: Number(account.balance || 0),
      status: account.status,
    }));

    const sourceTotal = sources.reduce(
      (sum, source) => sum + Number(source.balance || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        accountType,
        sourceCount: sources.length,
        sourceTotal,
        sources,
      },
    });
  } catch (error) {
    console.error("Error fetching savings liability sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch savings liability sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
