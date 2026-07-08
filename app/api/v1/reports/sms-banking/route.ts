import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { NotificationType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/reports/sms-banking?startDate=&endDate=&smsType=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const notifications = await db.notification.findMany({
      where: {
        type: NotificationType.SMS,
        sentAt: { gte: start, lte: end },
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });

    const records = notifications.map((log) => ({
      phoneNumber: log.user?.phone || "N/A",
      memberName: log.user?.name || "N/A",
      smsType: log.subject || "SMS Alert",
      message: log.message.substring(0, 100) + (log.message.length > 100 ? "..." : ""),
      status: log.status || "SENT",
      sentAt: log.sentAt?.toISOString() || "N/A",
      deliveredAt: log.sentAt?.toISOString() || "N/A",
      cost: 0,
      provider: "System",
    }));

    const byType = records.reduce((acc: any, r) => {
      if (!acc[r.smsType]) {
        acc[r.smsType] = { count: 0, cost: 0, delivered: 0, failed: 0 };
      }
      acc[r.smsType].count++;
      acc[r.smsType].cost += r.cost;
      if (r.status === "DELIVERED" || r.status === "SENT") acc[r.smsType].delivered++;
      if (r.status === "FAILED") acc[r.smsType].failed++;
      return acc;
    }, {});

    return NextResponse.json({
      data: records,
      summary: {
        totalRecords: records.length,
        totalCost: 0,
        delivered: records.filter((r) => r.status === "DELIVERED" || r.status === "SENT").length,
        failed: records.filter((r) => r.status === "FAILED").length,
        pending: records.filter((r) => r.status === "PENDING").length,
        byType,
      },
    });
  } catch (error) {
    console.error("SMS banking report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

