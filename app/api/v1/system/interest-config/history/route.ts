import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

/**
 * GET /api/v1/system/interest-config/history
 * Fetch configuration change history (Audit trail)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization - Admin only
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch configuration history
    const history = await db.systemConfiguration.findMany({
      where: {
        category: "INTEREST",
      },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        updatedBy: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Fetch user details for updatedBy
    const userIds = [...new Set(history.map((h) => h.updatedBy).filter(Boolean))];
    const users = await db.user.findMany({
      where: {
        id: { in: userIds as string[] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich history with user details
    const enrichedHistory = history.map((item) => ({
      ...item,
      updatedByUser: item.updatedBy ? userMap.get(item.updatedBy) : null,
    }));

    // Get total count
    const total = await db.systemConfiguration.count({
      where: {
        category: "INTEREST",
      },
    });

    return NextResponse.json({
      data: enrichedHistory,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching interest configuration history:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration history" },
      { status: 500 }
    );
  }
}
