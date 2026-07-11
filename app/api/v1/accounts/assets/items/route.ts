import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

// GET /api/v1/accounts/assets/items?assetType=FIXED|CURRENT&category=...&branchId=
//
// Drill-down for a single Fixed/Current Asset category node on the Assets
// dashboard page (FIXED_ASSET_CATEGORY / CURRENT_ASSET_CATEGORY NodeRef from
// /api/v1/accounts/assets). Reads db.fixedAsset.findMany directly instead of
// going through the shared chart-of-accounts/[id]/items endpoint, which used
// to resolve a single asset via a fragile `(FA-xxxxx)` regex match on the COA
// account name.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const assetType = searchParams.get("assetType");
    const category = searchParams.get("category");
    const requestedBranchId = searchParams.get("branchId");

    if (assetType !== "FIXED" && assetType !== "CURRENT") {
      return NextResponse.json(
        { success: false, error: "assetType must be FIXED or CURRENT" },
        { status: 400 },
      );
    }

    if (!category) {
      return NextResponse.json(
        { success: false, error: "category is required" },
        { status: 400 },
      );
    }

    const branchId = resolveBranchScope(
      session.user as { role: string; branchId?: string | null },
      requestedBranchId,
    );

    const assets = await db.fixedAsset.findMany({
      where: {
        assetType,
        category,
        status: { not: "DISPOSED" },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { purchaseDate: "desc" },
      take: 200,
    });

    const items = assets.map((asset) => ({
      // Generic "Underlying Items" table fields (page.tsx renderItemsTable)
      id: asset.id,
      name: asset.assetName,
      code: asset.assetCode,
      date: asset.purchaseDate,
      amount: asset.currentValue,
      status: asset.status,
      details: [
        `Purchase Price: ${Number(asset.purchasePrice || 0).toLocaleString("en-UG")}`,
        `Current Value: ${Number(asset.currentValue || 0).toLocaleString("en-UG")}`,
        asset.location ? `Location: ${asset.location}` : null,
        asset.branch?.name ? `Branch: ${asset.branch.name}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      // Raw fields (mirrors AssetDisposalTarget shape) so a per-row dispose
      // action can be wired directly from this drill-down for FIXED assets.
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      assetType: asset.assetType,
      category: asset.category,
      approvalStatus: asset.approvalStatus,
      receiptNo: asset.receiptNo,
      accountId: asset.accountId,
      currentValue: asset.currentValue,
      purchasePrice: asset.purchasePrice,
      purchaseDate: asset.purchaseDate,
      location: asset.location,
      disposalDate: asset.disposalDate,
      disposalMethod: asset.disposalMethod,
      disposalAmount: asset.disposalAmount,
      branchId: asset.branchId,
      branch: asset.branch ? { id: asset.branch.id, name: asset.branch.name } : null,
    }));

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error) {
    console.error("Error fetching asset category items:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch asset category items",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
