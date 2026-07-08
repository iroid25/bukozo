import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
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
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const asset = await db.fixedAsset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    if (asset.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Asset has already been disposed or written off." },
        { status: 409 },
      );
    }

    const updated = await db.fixedAsset.update({
      where: { id },
      data: {
        approvalStatus: "PENDING_APPROVAL",
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        disposalMethod: body.disposalMethod || "WRITE_OFF",
        disposalAmount: Number(body.disposalAmount || 0),
        disposalDate: body.disposalDate ? new Date(body.disposalDate) : new Date(),
        disposalNotes:
          typeof body.disposalNotes === "string" ? body.disposalNotes.trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Asset disposal request submitted for approval",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error creating fixed asset disposal request:", error);
    return NextResponse.json(
      { error: "Failed to create asset disposal request", details: error.message },
      { status: 500 },
    );
  }
}
