import { NextRequest, NextResponse } from "next/server";
import { AssetType, Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

const ASSET_APPROVAL_STATUS_APPROVED = "APPROVED";

export async function POST(
  _request: NextRequest,
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
        { error: "You do not have permission to approve current assets." },
        { status: 403 },
      );
    }

    const { id } = await params;
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

    const amount = Number(asset.purchasePrice || asset.currentValue || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Current asset amount is missing or invalid." },
        { status: 400 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      return tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          approvalStatus: ASSET_APPROVAL_STATUS_APPROVED,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          status: "ACTIVE",
          currentValue: amount,
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error approving current asset:", error);
    return NextResponse.json(
      { error: "Failed to approve current asset", details: error.message },
      { status: 500 },
    );
  }
}
