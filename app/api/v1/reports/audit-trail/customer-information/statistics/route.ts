import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { resolveBranchScope } from "@/lib/services/branch-scope";
import {
  ensureCustomerAuditTrailSchema,
  groupCustomerAuditTrailRows,
  type CustomerAuditTrailRow,
} from "@/lib/customer-audit-trail";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const rawBranchId = request.nextUrl.searchParams.get("branchId") || undefined;
    const branchId = resolveBranchScope(
      { role: user.role, branchId: user.branchId },
      rawBranchId,
    );

    await ensureCustomerAuditTrailSchema();

    const whereClause = branchId
      ? `WHERE "branchId" = '${branchId.replace(/'/g, "''")}'`
      : "";

    const rows = await db.$queryRawUnsafe<CustomerAuditTrailRow[]>(`
      SELECT *
      FROM "CustomerAuditTrail"
      ${whereClause}
      ORDER BY "changedAt" DESC, "auditEventId" DESC
    `);

    const events = groupCustomerAuditTrailRows(rows);
    const branches = new Set(
      rows.map((row) => row.branchId || row.branchCode || row.branchName || "Unknown"),
    );
    const customers = new Set(rows.map((row) => row.customerId));
    const beforeSnapshots = rows.filter((row) => row.snapshotType === "BEFORE").length;
    const afterSnapshots = rows.filter((row) => row.snapshotType === "AFTER").length;

    const countByAction = (actionType: string) =>
      events.filter((event) => event.actionType === actionType).length;

    return NextResponse.json({
      data: {
        totalEvents: events.length,
        totalSnapshots: rows.length,
        beforeSnapshots,
        afterSnapshots,
        customersAffected: customers.size,
        branchesAffected: branches.size,
        createdEvents: countByAction("Created"),
        editedEvents: countByAction("Edited"),
        deletedEvents: countByAction("Deleted"),
        activatedEvents: countByAction("Activated"),
        deactivatedEvents: countByAction("Deactivated"),
      },
    });
  } catch (error) {
    console.error("Error fetching customer information audit statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer information audit statistics" },
      { status: 500 },
    );
  }
}
