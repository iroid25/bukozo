import { NextRequest, NextResponse } from "next/server";
import { AssetStatus, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

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
        { error: "You do not have permission to reject disposal requests." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

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

    const updated = await db.fixedAsset.update({
      where: { id },
      data: {
        approvalStatus: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || "Rejected by approver",
        disposalMethod: null,
        disposalAmount: null,
        disposalDate: null,
        disposalNotes: null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error rejecting fixed asset disposal:", error);
    return NextResponse.json(
      { error: "Failed to reject fixed asset disposal", details: error.message },
      { status: 500 },
    );
  }
}
