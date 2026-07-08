import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

// PUT /api/v1/notifications/mark-all-read - Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const userId = (session.user as any).id;

    const result = await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return successResponse(
      { updated: result.count },
      `${result.count} notification(s) marked as read`
    );
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return ApiErrors.internalError(error.message);
  }
}
