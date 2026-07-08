import { NextRequest, NextResponse } from "next/server";
import { AssetStatus, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { finalizeFixedAssetDisposal } from "@/lib/services/fixed-asset-disposal";

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
        { error: "You do not have permission to approve disposal requests." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const asset = await db.fixedAsset.findUnique({ where: { id } });
    if (!asset || asset.status !== AssetStatus.ACTIVE) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    if (asset.approvalStatus !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "This disposal request has already been processed." },
        { status: 409 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      return finalizeFixedAssetDisposal(tx, {
        assetId: id,
        userId: user.id,
        disposalMethod: asset.disposalMethod || body.disposalMethod,
        disposalAmount: asset.disposalAmount ?? body.disposalAmount,
        disposalDate: asset.disposalDate || body.disposalDate,
        disposalNotes: asset.disposalNotes || body.disposalNotes,
        proceedsAccountId: body.proceedsAccountId,
      });
    });

    return NextResponse.json({ success: true, data: result.asset, accounting: result.journalEntry });
  } catch (error: any) {
    console.error("Error approving fixed asset disposal:", error);
    return NextResponse.json(
      { error: "Failed to approve fixed asset disposal", details: error.message },
      { status: 500 },
    );
  }
}
