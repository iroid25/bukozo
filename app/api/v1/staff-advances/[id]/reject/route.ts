import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT &&
      user.role !== UserRole.BRANCHMANAGER
    ) {
      return NextResponse.json({ error: "You do not have permission to reject advance requests." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rejectionReason = String(body.rejectionReason || "Rejected by approver").trim();

    const rows = await db.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
    );
    const advance = rows[0];

    if (!advance) return NextResponse.json({ error: "Advance request not found." }, { status: 404 });
    if (advance.status !== "PENDING") {
      return NextResponse.json({ error: "This advance request has already been processed." }, { status: 409 });
    }

    await db.$executeRaw(Prisma.sql`
      UPDATE "StaffAdvanceRequest"
      SET "status" = 'REJECTED',
          "rejectedById" = ${user.id},
          "rejectedAt" = NOW(),
          "rejectionReason" = ${rejectionReason},
          "approvedById" = NULL,
          "approvedAt" = NULL,
          "updatedAt" = NOW()
      WHERE "id" = ${id}
    `);

    const updated = await db.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error("Error rejecting staff advance:", error);
    return NextResponse.json({ error: "Failed to reject advance request", details: error.message }, { status: 500 });
  }
}
