import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { InsuranceContributionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const rows = await db.insuranceContribution.findMany({
      where: {
        type: InsuranceContributionType.CONTRIBUTION,
      },
      select: {
        id: true,
        amount: true,
        description: true,
        reference: true,
        createdAt: true,
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
        loanApplication: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sources = rows.map((row) => ({
      id: row.id,
      memberName: row.member?.user?.name || "Unknown Member",
      memberNumber: row.member?.memberNumber || "-",
      amount: Number(row.amount || 0),
      date: row.createdAt,
      reference: row.reference || row.loanApplication?.id || "-",
      description: row.description,
    }));

    const sourceTotal = sources.reduce((sum, row) => sum + row.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        sourceCount: sources.length,
        sourceTotal,
        sources,
      },
    });
  } catch (error) {
    console.error("Error fetching insurance pool sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch insurance pool sources",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
