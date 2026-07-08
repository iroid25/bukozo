import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { InsuranceContributionType } from "@prisma/client";

const LOAN_INSURANCE_POOL_ACCOUNT = "SACCO_LOAN_INSURANCE_POOL";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      records,
      insuranceAccount,
      totalCollectedResult,
      totalPaidOutResult,
      monthlyCollectionResult,
      uniqueMembers,
    ] = await Promise.all([
      db.insuranceContribution.findMany({
        include: {
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
          account: {
            select: {
              accountNumber: true,
            },
          },
          createdBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.account.findFirst({
        where: { accountNumber: LOAN_INSURANCE_POOL_ACCOUNT },
        select: { balance: true },
      }),
      db.insuranceContribution.aggregate({
        where: { type: InsuranceContributionType.CONTRIBUTION },
        _sum: { amount: true },
      }),
      db.insuranceContribution.aggregate({
        where: { type: InsuranceContributionType.PAYMENT_OUT },
        _sum: { amount: true },
      }),
      db.insuranceContribution.aggregate({
        where: {
          type: InsuranceContributionType.CONTRIBUTION,
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      db.insuranceContribution.findMany({
        where: {
          type: InsuranceContributionType.CONTRIBUTION,
          memberId: { not: null },
        },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
    ]);

    const totalCollected = totalCollectedResult._sum.amount || 0;
    const statistics = {
      totalPoolBalance: insuranceAccount?.balance || 0,
      totalCollected,
      totalPaidOut: totalPaidOutResult._sum.amount || 0,
      monthlyCollection: monthlyCollectionResult._sum.amount || 0,
      membersCovered: uniqueMembers.length,
      averageContribution: uniqueMembers.length
        ? totalCollected / uniqueMembers.length
        : 0,
    };

    return NextResponse.json({
      records: records.map((record) => ({
        id: record.id,
        amount: record.amount,
        type: record.type,
        description: record.description,
        memberName: record.member?.user?.name,
        memberNumber: record.member?.memberNumber,
        accountNumber: record.account.accountNumber,
        reference: record.reference ?? undefined,
        createdAt: record.createdAt.toISOString(),
        createdBy: record.createdById,
        createdByName: record.createdBy.name,
      })),
      statistics,
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error fetching insurance data:", error);
    return NextResponse.json(
      { error: "Failed to fetch insurance data" },
      { status: 500 },
    );
  }
}
