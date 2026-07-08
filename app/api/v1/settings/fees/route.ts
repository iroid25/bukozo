import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { revalidatePath } from "next/cache";

// GET /api/v1/settings/fees - Fetch fee configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const config = await db.globalFeeConfiguration.findUnique({
        where: { key },
      });
      return NextResponse.json({ data: config ? config.value : null });
    }

    const configs = await db.globalFeeConfiguration.findMany();
    return NextResponse.json({ data: configs });
  } catch (error) {
    console.error("Error fetching fee configurations:", error);
    return NextResponse.json(
      { error: "Failed to fetch configurations" },
      { status: 500 }
    );
  }
}

// POST /api/v1/settings/fees - Update a fee configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    const result = await db.globalFeeConfiguration.upsert({
      where: { key },
      create: {
        key,
        value,
        updatedBy: (session.user as any).id,
      },
      update: {
        value,
        updatedBy: (session.user as any).id,
      },
    });

    try {
      revalidatePath("/dashboard/settings/fees");
    } catch (e) {
      console.warn("Revalidation failed:", e);
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Configuration for ${key} updated successfully`,
    });
  } catch (error) {
    console.error("Error updating fee configuration:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
