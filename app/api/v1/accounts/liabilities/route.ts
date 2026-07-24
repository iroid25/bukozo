import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { Prisma } from "@prisma/client";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import { fetchLiabilitiesSummary } from "@/lib/services/accounting/liabilities-aggregate";

export const dynamic = "force-dynamic";

// GET /api/v1/accounts/liabilities - Fetch liabilities from real tables
// Uses the shared fetchLiabilitiesSummary() service.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get("branchId");
    const user = session.user as { role: string; branchId?: string | null };
    const scopedBranchId = resolveBranchScope(user, branchId);

    const summary = await fetchLiabilitiesSummary(scopedBranchId);

    return NextResponse.json({
      linkedAccountTypes: summary.linkedAccountTypes,
      groups: summary.groups,
    });
  } catch (error) {
    console.error("Error fetching liabilities:", error);

    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P1001") ||
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Error &&
        error.message.includes("Can't reach database server"))
    ) {
      return NextResponse.json(
        {
          error: "Database unavailable",
          details:
            "Unable to reach the database server right now. Please confirm the Neon database is online and your local network can reach it.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch liabilities",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
