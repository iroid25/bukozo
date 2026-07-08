import { NextRequest, NextResponse } from "next/server";
import { getBalanceSheetService } from "@/lib/services/financial-reports";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;


function parseFilters(source: URLSearchParams | any) {
  const read = (key: string) =>
    source instanceof URLSearchParams ? source.get(key) : source?.[key];

  return {
    section: read("section") || "all",
    subSection: read("subSection") || "all",
    includeZeroBalances:
      String(read("includeZeroBalances") || "false").toLowerCase() === "true",
    search: read("search") || "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const asOfStr = searchParams.get("asOf") || searchParams.get("endDate") || undefined;
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId =
      user.role === UserRole.ADMIN
        ? requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
          ? requestedBranchId
          : undefined
        : user.branchId || undefined;
    const filters = parseFilters(searchParams);

    const asOf = asOfStr ? new Date(asOfStr) : new Date();

    const data = await getBalanceSheetService(asOf, branchId, user, filters);
    
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in Balance Sheet API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const asOfStr = body.asOf || body.endDate || undefined;
    const requestedBranchId = body.branchId || undefined;
    const branchId =
      user.role === UserRole.ADMIN
        ? requestedBranchId && requestedBranchId !== "all" && requestedBranchId !== "ALL"
          ? requestedBranchId
          : undefined
        : user.branchId || undefined;
    const filters = parseFilters(body);

    const asOf = asOfStr ? new Date(asOfStr) : new Date();
    const data = await getBalanceSheetService(asOf, branchId, user, filters);
    
    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error in Balance Sheet API:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
