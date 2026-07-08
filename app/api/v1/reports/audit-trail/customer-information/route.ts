import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import {
  ensureCustomerAuditTrailSchema,
  groupCustomerAuditTrailRows,
  type CustomerAuditTrailRow,
  type CustomerAuditTrailFilters,
} from "@/lib/customer-audit-trail";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

function parseDate(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "100", 10));
    const sessionRole = (session.user as any).role as string | undefined;
    const sessionBranchId = (session.user as any).branchId as string | undefined;
    const requestedBranchId = searchParams.get("branchId") || undefined;
    const branchId =
      sessionRole === "ADMIN" ? requestedBranchId : sessionBranchId || undefined;
    const actionType = searchParams.get("actionType") || undefined;
    const search = (searchParams.get("search") || "").trim();
    const fromDate = parseDate(searchParams.get("fromDate"));
    const toDate = parseDate(searchParams.get("toDate"));

    const filters: CustomerAuditTrailFilters = {
      branchId,
      actionType,
      search,
      fromDate,
      toDate,
      limit,
    };

    await ensureCustomerAuditTrailSchema();

    const clauses: string[] = ["1 = 1"];
    if (filters.branchId) clauses.push(`"branchId" = '${filters.branchId.replace(/'/g, "''")}'`);
    if (filters.actionType && filters.actionType !== "all") {
      clauses.push(`"actionType" = '${filters.actionType.replace(/'/g, "''")}'`);
    }
    if (filters.search) {
      const term = filters.search.replace(/'/g, "''");
      clauses.push(
        `("fullName" ILIKE '%${term}%' OR "refNumber" ILIKE '%${term}%' OR "idCardNumber" ILIKE '%${term}%' OR "changedBy" ILIKE '%${term}%')`,
      );
    }
    if (filters.fromDate) {
      clauses.push(`"changedAt" >= '${filters.fromDate.toISOString()}'`);
    }
    if (filters.toDate) {
      clauses.push(`"changedAt" <= '${filters.toDate.toISOString()}'`);
    }

    const rows = await db.$queryRawUnsafe<CustomerAuditTrailRow[]>(`
      SELECT *
      FROM "CustomerAuditTrail"
      WHERE ${clauses.join(" AND ")}
      ORDER BY "changedAt" DESC, "auditEventId" DESC
    `);

    const groupedEvents = groupCustomerAuditTrailRows(rows);
    const events = groupedEvents.slice(0, limit);

    return NextResponse.json({
      data: {
        events,
        pagination: {
          total: groupedEvents.length,
          limit,
          hasMore: groupedEvents.length > limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customer information audit trail:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer information audit trail" },
      { status: 500 },
    );
  }
}
