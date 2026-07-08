import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

const TRANSFER_STATUS_PENDING = "PENDING_APPROVAL";
const TRANSFER_STATUS_REJECTED = "REJECTED";

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
        { error: "You do not have permission to reject transfers." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";

    const transferRows = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "AssetTransfer"
      WHERE "id" = ${id}
      LIMIT 1
    `);
    const transfer = transferRows[0];

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found." }, { status: 404 });
    }

    if (transfer.status !== TRANSFER_STATUS_PENDING) {
      return NextResponse.json(
        { error: "This transfer has already been processed." },
        { status: 409 },
      );
    }

    await db.$executeRaw(Prisma.sql`
      UPDATE "AssetTransfer"
      SET
        "status" = ${TRANSFER_STATUS_REJECTED},
        "rejectedByUserId" = ${user.id},
        "rejectedAt" = NOW(),
        "rejectionReason" = ${rejectionReason || "Rejected by approver"},
        "approvedByUserId" = NULL,
        "approvedAt" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);

    const updated = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "AssetTransfer"
      WHERE "id" = ${id}
      LIMIT 1
    `);

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error("Error rejecting current asset transfer:", error);
    return NextResponse.json(
      { error: "Failed to reject current asset transfer", details: error.message },
      { status: 500 },
    );
  }
}
