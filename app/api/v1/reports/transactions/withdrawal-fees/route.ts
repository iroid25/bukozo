import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";
import { calculateWithdrawalFee } from "@/lib/fees";
import { AGENT_WITHDRAWAL_FEES } from "@/config/fees";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/transactions/withdrawal-fees?startDate=&endDate=&branchId=
// Returns completed withdrawals and computes the charged fee versus the expected fee.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const user = session.user as any;
    const isAdmin = user.role === UserRole.ADMIN;

    const where: any = {
      withdrawalDate: { gte: start, lte: end },
      transaction: {
        is: {
          type: "WITHDRAWAL",
          status: { in: ["COMPLETED", "APPROVED"] },
        },
      },
    };

    if (!isAdmin && user.branchId) {
      where.account = { branchId: user.branchId };
    } else if (branchId && branchId !== "all") {
      where.account = { branchId };
    }

    const withdrawals = await db.withdrawal.findMany({
      where,
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            channel: true,
            transactionRef: true,
            description: true,
            externalReference: true,
            transactionDate: true,
            fee: true,
          },
        },
        account: {
          include: {
            member: { include: { user: { select: { name: true } } } },
            accountType: {
              select: {
                name: true,
                flatWithdrawalFee: true,
                withdrawalFeePercentage: true,
                withdrawalFeeTiers: true,
              },
            },
            branch: { select: { name: true } },
          },
        },
        member: {
          include: {
            user: { select: { name: true } },
          },
        },
        institution: {
          include: {
            user: { select: { name: true } },
          },
        },
        handler: { select: { name: true, role: true } },
      },
      orderBy: [{ withdrawalDate: "asc" }],
    });

    const agentConfig = await db.globalFeeConfiguration.findUnique({
      where: { key: "AGENT_WITHDRAWAL_FEES" },
      select: { value: true },
    });
    const memberConfig = await db.systemConfiguration.findUnique({
      where: { key: "TELLER_WITHDRAWAL_RATES_MEMBER" },
      select: { value: true },
    });
    const institutionConfig = await db.systemConfiguration.findUnique({
      where: { key: "TELLER_WITHDRAWAL_RATES_INSTITUTION" },
      select: { value: true },
    });

    const parseAgentTiers = (raw: unknown) => {
      try {
        const source =
          Array.isArray(raw) ? raw : typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(source)) return AGENT_WITHDRAWAL_FEES;
        const tiers = source
          .map((tier: any) => ({
            min: Number(tier?.min) || 0,
            max:
              tier?.max === null || tier?.max === undefined
                ? null
                : Number.isFinite(Number(tier.max))
                  ? Number(tier.max)
                  : null,
            charge: Number(tier?.charge) || Number(tier?.fee) || 0,
            saccoShare: Number(tier?.saccoShare) || 0,
            agentShare: Number(tier?.agentShare) || 0,
          }))
          .filter((tier: any) => tier.charge >= 0);
        return tiers.length > 0 ? tiers : AGENT_WITHDRAWAL_FEES;
      } catch {
        return AGENT_WITHDRAWAL_FEES;
      }
    };

    const agentTiers = parseAgentTiers(agentConfig?.value);
    const memberFallbackTiersJson = memberConfig?.value ?? null;
    const institutionFallbackTiersJson = institutionConfig?.value ?? null;

    const records = withdrawals.map((withdrawal, index) => {
      const chargedFee = Number(withdrawal.fee ?? withdrawal.transaction?.fee ?? 0);
      const withdrawalAmount = Number(withdrawal.amount) || 0;
      const handlerRole = String(withdrawal.handler?.role ?? "").toUpperCase();
      const channel = String(withdrawal.channel ?? withdrawal.transaction?.channel ?? "CASH");
      const isAgentCash = handlerRole === "AGENT" && channel.toUpperCase() === "CASH";
      const expectedFee = isAgentCash
        ? (() => {
            const hit = agentTiers.find(
              (tier: any) =>
                withdrawalAmount >= tier.min &&
                (tier.max === null || tier.max === 0 || withdrawalAmount <= tier.max),
            );
            return Number(hit?.charge ?? 0);
          })()
        : calculateWithdrawalFee(
            withdrawalAmount,
            withdrawal.account?.accountType,
            withdrawal.account,
            withdrawal.institutionId
              ? institutionFallbackTiersJson
              : memberFallbackTiersJson,
          );

      return {
        sequence: index + 1,
        id: withdrawal.id,
        transactionRef: withdrawal.transaction?.transactionRef ?? "N/A",
        transactionDate:
          withdrawal.transaction?.transactionDate?.toISOString() ??
          withdrawal.withdrawalDate.toISOString(),
        memberName:
          withdrawal.member?.user?.name ??
          withdrawal.institution?.institutionName ??
          withdrawal.account?.member?.user?.name ??
          "N/A",
        accountNumber: withdrawal.account?.accountNumber ?? "N/A",
        accountType: withdrawal.account?.accountType?.name ?? "N/A",
        branch: withdrawal.account?.branch?.name ?? "N/A",
        channel,
        withdrawalAmount,
        chargedFee,
        expectedFee,
        feeDifference: chargedFee - expectedFee,
        totalDeducted: withdrawalAmount + chargedFee,
        processedBy: withdrawal.handler?.name ?? "N/A",
        status: withdrawal.transaction?.status ?? "N/A",
      };
    });

    const totalWithdrawals = records.reduce((s, r) => s + r.withdrawalAmount, 0);
    const totalChargedFees = records.reduce((s, r) => s + r.chargedFee, 0);
    const totalExpectedFees = records.reduce((s, r) => s + r.expectedFee, 0);
    const totalFeeVariance = records.reduce((s, r) => s + r.feeDifference, 0);

    return NextResponse.json({
      success: true,
      data: records,
      summary: {
        count: records.length,
        totalWithdrawals,
        totalChargedFees,
        totalExpectedFees,
        totalFeeVariance,
        totalDeducted: totalWithdrawals + totalChargedFees,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Withdrawal fee report error:", error);
    return NextResponse.json(
      { error: "Failed to generate withdrawal fee report", details: error.message },
      { status: 500 },
    );
  }
}
