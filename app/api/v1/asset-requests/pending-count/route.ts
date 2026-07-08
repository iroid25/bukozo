import { NextResponse } from "next/server";
import { AssetStatus, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT &&
      user.role !== UserRole.BRANCHMANAGER
    ) {
      return NextResponse.json({ success: true, total: 0, transfers: 0, disposals: 0 });
    }

    const branchScope =
      user.role !== UserRole.ADMIN && user.branchId
        ? { branchId: user.branchId }
        : {};

    const [transferCount, disposalCount] = await Promise.all([
      db.assetTransfer.count({
        where: {
          status: "PENDING_APPROVAL",
          ...branchScope,
        },
      }),
      db.fixedAsset.count({
        where: {
          status: AssetStatus.ACTIVE,
          approvalStatus: "PENDING_APPROVAL",
          disposalDate: { not: null },
          ...branchScope,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      total: transferCount + disposalCount,
      transfers: transferCount,
      disposals: disposalCount,
    });
  } catch (error: any) {
    console.error("Error loading asset request counts:", error);
    return NextResponse.json(
      { error: "Failed to load request counts", details: error.message },
      { status: 500 },
    );
  }
}
