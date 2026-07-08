import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const poolAccount = await db.account.findFirst({
      where: { accountNumber: "SACCO_LOAN_INSURANCE_POOL" },
      select: { balance: true },
    });

    const insuranceContributions = await db.insuranceContribution.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        member: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
        loanApplication: {
          select: {
            id: true,
            amountApplied: true,
            approvedAmount: true,
            applicationDate: true,
          },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });

    const contributions = insuranceContributions.filter(
      (entry) => entry.loanApplicationId !== null,
    );

    const now = new Date();
    const statistics = {
      totalPoolBalance: poolAccount?.balance || 0,
      totalContributions: contributions.length,
      totalFromLoans: contributions.filter((entry) => entry.type === "CONTRIBUTION").length,
      monthlyCollection: contributions
        .filter((entry) => {
          const createdAt = new Date(entry.createdAt);
          return (
            createdAt.getMonth() === now.getMonth() &&
            createdAt.getFullYear() === now.getFullYear()
          );
        })
        .reduce((sum, entry) => sum + entry.amount, 0),
    };

    return NextResponse.json({
      contributions,
      statistics,
      user: {
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error fetching insurance pool data:", error);
    return NextResponse.json(
      { error: "Failed to fetch insurance pool data" },
      { status: 500 },
    );
  }
}
