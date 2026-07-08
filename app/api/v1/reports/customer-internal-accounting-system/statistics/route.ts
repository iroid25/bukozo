import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getCustomerInternalAccountingSummary } from "@/lib/reports/customer-internal-accounting-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;
    const status = searchParams.get("status") || undefined;

    const summary = await getCustomerInternalAccountingSummary({
      user: {
        role: (session.user as any).role || "MEMBER",
        branchId: (session.user as any).branchId || undefined,
      },
      branchId,
      status,
    });

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Error fetching customer accounting statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer accounting statistics" },
      { status: 500 },
    );
  }
}
