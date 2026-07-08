import { NextRequest, NextResponse } from "next/server";
import { AssetType, Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

const ASSET_APPROVAL_STATUS_APPROVED = "APPROVED";
const ASSET_APPROVAL_STATUS_REJECTED = "REJECTED";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      return NextResponse.json(
        { error: "You do not have permission to reject current assets." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    const assetRows = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "FixedAsset"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    const asset = assetRows[0];

    if (!asset || asset.assetType !== AssetType.CURRENT) {
      return NextResponse.json({ error: "Current asset not found." }, { status: 404 });
    }

    if (asset.approvalStatus === ASSET_APPROVAL_STATUS_APPROVED) {
      return NextResponse.json(
        { error: "This current asset has already been approved." },
        { status: 409 },
      );
    }

    const updated = await db.$queryRaw<any[]>(Prisma.sql`
      UPDATE "FixedAsset"
      SET
        "approvalStatus" = ${ASSET_APPROVAL_STATUS_REJECTED},
        "rejectedAt" = NOW(),
        "rejectionReason" = ${rejectionReason || "Rejected by approver"},
        "currentValue" = 0
      WHERE "id" = ${id}
      RETURNING *
    `);

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error("Error rejecting current asset:", error);
    return NextResponse.json(
      { error: "Failed to reject current asset", details: error.message },
      { status: 500 },
    );
  }
}
