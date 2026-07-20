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
      select: { id: true, name: true },
    });

    if (!accountType) {
      return NextResponse.json(
        { success: false, error: "Account type not found" },
        { status: 404 },
      );
    }

    const depositRecords = await db.fixedDeposit.findMany({
      where: {
        status: { in: ["ACTIVE", "MATURED"] },
        isReversed: false,
      },
      select: {
        id: true,
        accountNumber: true,
        principalAmount: true,
        status: true,
        startDate: true,
        maturityDate: true,
        maturityAmount: true,
        branch: {
          select: { name: true },
        },
        member: {
          select: {
            memberNumber: true,
            user: { select: { name: true } },
          },
        },
        institution: {
          select: {
            institutionNumber: true,
            institutionName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sources = depositRecords.map((deposit) => ({
      depositId: deposit.id,
      accountNumber: deposit.accountNumber,
      ownerName:
        deposit.member?.user?.name ||
        deposit.institution?.institutionName ||
        "Unknown",
      ownerNumber:
        deposit.member?.memberNumber ||
        deposit.institution?.institutionNumber ||
        "-",
      branchName: deposit.branch?.name || "N/A",
      principalAmount: Number(deposit.principalAmount || 0),
      maturityAmount: Number(deposit.maturityAmount || 0),
      status: deposit.status,
      startDate: deposit.startDate.toISOString(),
      maturityDate: deposit.maturityDate.toISOString(),
    }));

    const sourceTotal = sources.reduce(
      (sum, s) => sum + s.principalAmount,
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
    console.error("Error fetching fixed deposit sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch fixed deposit sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
