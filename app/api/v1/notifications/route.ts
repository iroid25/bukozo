import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors, getPaginationParams, createPaginationMeta } from "@/lib/api-utils";

// GET /api/v1/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(searchParams);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          subject: true,
          message: true,
          isRead: true,
          sentAt: true,
        },
        orderBy: {
          sentAt: "desc",
        },
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return successResponse({
      data: notifications,
      pagination: createPaginationMeta(page, limit, total),
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return ApiErrors.internalError(error.message);
  }
}

// PUT /api/v1/notifications/{notificationId}/read - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return ApiErrors.validationError("notificationId is required");
    }

    const notification = await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return successResponse(notification, "Notification marked as read");
  } catch (error: any) {
    console.error("Error updating notification:", error);
    return ApiErrors.internalError(error.message);
  }
}

// DELETE /api/v1/notifications?id={notificationId} - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) {
      return ApiErrors.validationError("Notification ID is required");
    }

    // Ensure notification belongs to user
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return ApiErrors.notFound("Notification not found");
    }

    if (notification.userId !== userId) {
      return ApiErrors.forbidden("You cannot delete this notification");
    }

    await db.notification.delete({
      where: { id: notificationId },
    });

    return successResponse(null, "Notification deleted");
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    return ApiErrors.internalError(error.message);
  }
}
