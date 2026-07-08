import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    const userRole = (session.user as { role?: string }).role;
    const userBranchId = (session.user as { branchId?: string }).branchId ?? null;

    const like = `%${query}%`;

    type Row = {
      id: string;
      memberNumber: string;
      name: string | null;
      phone: string | null;
      branchName: string | null;
    };

    let rows: Row[];

    if (userRole === "ADMIN" || !userBranchId) {
      rows = await db.$queryRaw<Row[]>`
        SELECT
          m."id",
          m."memberNumber",
          u."name",
          u."phone",
          b."name" AS "branchName"
        FROM "Member" m
        LEFT JOIN "User" u ON u."id" = m."userId"
        LEFT JOIN "Branch" b ON b."id" = u."branchId"
        WHERE
          m."memberNumber" ILIKE ${like}
          OR u."name"      ILIKE ${like}
          OR u."phone"     ILIKE ${like}
        ORDER BY u."name" ASC NULLS LAST
        LIMIT 20
      `;
    } else {
      rows = await db.$queryRaw<Row[]>`
        SELECT
          m."id",
          m."memberNumber",
          u."name",
          u."phone",
          b."name" AS "branchName"
        FROM "Member" m
        LEFT JOIN "User" u ON u."id" = m."userId"
        LEFT JOIN "Branch" b ON b."id" = u."branchId"
        WHERE
          u."branchId" = ${userBranchId}
          AND (
            m."memberNumber" ILIKE ${like}
            OR u."name"      ILIKE ${like}
            OR u."phone"     ILIKE ${like}
          )
        ORDER BY u."name" ASC NULLS LAST
        LIMIT 20
      `;
    }

    const data = rows.map((r) => ({
      id: r.id,
      memberNumber: r.memberNumber,
      name: r.name || r.memberNumber,
      phone: r.phone || "N/A",
      branch: r.branchName || "N/A",
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error searching members:", error);
    return NextResponse.json({ error: "Failed to search members" }, { status: 500 });
  }
}
