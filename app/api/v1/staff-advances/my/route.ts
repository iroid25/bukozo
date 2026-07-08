import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT * FROM "StaffAdvanceRequest"
      WHERE "staffId" = ${user.id}
      ORDER BY "createdAt" DESC
    `);

    const approverIds = Array.from(
      new Set(rows.flatMap((r) => [r.approvedById, r.rejectedById]).filter(Boolean)),
    );

    const approvers =
      approverIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: approverIds } },
            select: { id: true, name: true },
          })
        : [];

    const approverMap = new Map(approvers.map((u) => [u.id, u]));

    const data = rows.map((r) => ({
      ...r,
      approvedBy: r.approvedById ? approverMap.get(r.approvedById) || null : null,
      rejectedBy: r.rejectedById ? approverMap.get(r.rejectedById) || null : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching my advances:", error);
    return NextResponse.json({ error: "Failed to fetch advances", details: error.message }, { status: 500 });
  }
}
