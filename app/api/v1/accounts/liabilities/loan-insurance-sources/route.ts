import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { InsuranceContributionType } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // InsuranceContribution has no branchId column of its own, and its
    // accountId always points at the global insurance pool Account (not a
    // per-branch account), so it can't be used for scoping either.
    // memberId -> Member has no branchId column, and loanApplicationId ->
    // LoanApplication has no branchId column either. The one FK path that is
    // actually populated is memberId -> Member -> User.branchId — this is
    // the exact field every insurance-collection call site
    // (services/loan.service.ts, app/api/v1/loans/applications/route.ts)
    // already passes as the contribution's branch when creating the pool
    // account/journal entries. Institution-loan contributions (no memberId)
    // won't match a branch filter and simply won't appear when a specific
    // branch is selected.
    const user = session.user as { role: string; branchId?: string | null };
    const requestedBranchId = request.nextUrl.searchParams.get("branchId");
    const scopedBranchId = resolveBranchScope(user, requestedBranchId);

    const rows = await db.insuranceContribution.findMany({
      where: {
        type: InsuranceContributionType.CONTRIBUTION,
        ...(scopedBranchId
          ? { member: { user: { branchId: scopedBranchId } } }
          : {}),
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
        branchScoped: Boolean(scopedBranchId),
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
