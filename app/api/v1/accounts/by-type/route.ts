import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "savings";
    const user = session.user as any;
    const branchId = resolveBranchScope(user, searchParams.get("branchId") || undefined);

    const branchFilter = branchId ? { branchId } : {};

    if (category === "loans") {
      const loans = await db.loan.findMany({
        where: branchFilter,
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              user: { select: { name: true, phone: true } },
            },
          },
          loanApplication: {
            select: {
              id: true,
              loanProduct: { select: { id: true, name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, category, data: loans });
    }

    if (category === "fixed-deposits") {
      const fixedDeposits = await db.fixedDeposit.findMany({
        where: branchFilter,
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              user: { select: { name: true, phone: true } },
            },
          },
          institution: {
            select: {
              id: true,
              institutionName: true,
              institutionNumber: true,
            },
          },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, category, data: fixedDeposits });
    }

    const typeWhere =
      category === "shares"
        ? { accountType: { isShareAccount: true } }
        : { accountType: { isShareAccount: false, hasFixedPeriod: false } };

    const accounts = await db.account.findMany({
      where: { ...typeWhere, ...branchFilter },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: { select: { name: true, phone: true } },
          },
        },
        institution: {
          select: {
            id: true,
            institutionName: true,
            institutionNumber: true,
          },
        },
        accountType: {
          select: { id: true, name: true, isShareAccount: true, hasFixedPeriod: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json({ success: true, category, data: accounts });
  } catch (error) {
    console.error("Error fetching accounts by type:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load accounts" },
      { status: 500 },
    );
  }
}
