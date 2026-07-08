import { NextRequest, NextResponse } from "next/server";
import { getProfitAndLossStatementService } from "@/lib/services/financial-reports";
import { getAuthUser } from "@/config/useAuth";
import { buildProfitLossWorkbook } from "@/lib/reports/profit-loss-report";
import { UserRole } from "@prisma/client";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.ACCOUNTANT,
      UserRole.BRANCHMANAGER,
      UserRole.AUDITOR,
    ];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : new Date();
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId = requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
      ? requestedBranchId
      : undefined;

    const report = await getProfitAndLossStatementService(startDate, endDate, branchId, user);
    const buffer = await buildProfitLossWorkbook(report);

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="profit-loss-${format(endDate, "yyyyMMdd")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Profit & Loss export error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export profit and loss", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
