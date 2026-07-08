import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { TransactionType, UserRole } from "@prisma/client";

function calculateResetStatistics(userFloats: any[]) {
  return {
    totalUsers: userFloats.length,
    totalBalance: userFloats.reduce((sum, uf) => sum + uf.balance, 0),
    activeUsers: userFloats.filter((uf) => uf.isActiveForDay).length,
    usersWithBalance: userFloats.filter((uf) => uf.balance > 0).length,
    pendingReconciliations: userFloats.filter((uf) => uf.pendingReconciliation)
      .length,
    blockedUsers: userFloats.filter((uf) => !uf.canStartNewDay).length,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!["ACCOUNTANT", "ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const whereClause =
      user.role === "ADMIN"
        ? {}
        : user.role === "ACCOUNTANT" || user.role === "BRANCHMANAGER"
        ? user.branchId
          ? { user: { branchId: user.branchId } }
          : null
        : null;

    if (
      (user.role === "ACCOUNTANT" || user.role === "BRANCHMANAGER") &&
      !user.branchId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "User must be assigned to a branch",
        },
        { status: 400 }
      );
    }

    const userFloats = await db.userFloat.findMany({
      where: whereClause || undefined,
      include: {
        user: {
          include: {
            branch: {
              select: {
                name: true,
                location: true,
              },
            },
          },
        },
        floatTransactions: {
          include: {
            performedByUser: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: { transactionDate: "desc" },
          take: 5,
        },
        floatReconciliation: {
          include: {
            reconciledByUser: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: { reconciliationDate: "desc" },
          take: 3,
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    const statistics = calculateResetStatistics(userFloats);

    return NextResponse.json({
      success: true,
      data: {
        userFloats,
        statistics,
        currentUserId: user.id,
        userRole: user.role,
      },
    });
  } catch (error) {
    console.error("Error fetching float reset data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!["ACCOUNTANT", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userFloatId = body.userFloatId;
    const resetType = body.resetType as
      | "FULL_RESET"
      | "BALANCE_ONLY"
      | "STATUS_ONLY";
    const newBalance =
      body.newBalance !== undefined && body.newBalance !== null
        ? Number(body.newBalance)
        : undefined;
    const reason = String(body.reason || "").trim();

    if (!userFloatId || !resetType || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (reason.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Reason must be at least 10 characters long",
        },
        { status: 400 }
      );
    }

    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true, name: true, branchId: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userFloat = await db.userFloat.findUnique({
      where: { id: userFloatId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            branchId: true,
          },
        },
      },
    });

    if (!userFloat) {
      return NextResponse.json(
        { success: false, error: "Float not found" },
        { status: 404 }
      );
    }

    if (
      currentUser.role === "ACCOUNTANT" &&
      currentUser.branchId !== userFloat.user.branchId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only reset floats within your branch",
        },
        { status: 403 }
      );
    }

    if (
      newBalance !== undefined &&
      (Number.isNaN(newBalance) || newBalance < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Balance must be a non-negative number",
        },
        { status: 400 }
      );
    }

    const oldBalance = Number(userFloat.balance) || 0;

    await db.$transaction(async (tx) => {
      let updateData: Record<string, unknown> = {};
      let transactionAmount = 0;
      let transactionDescription = "";

      switch (resetType) {
        case "FULL_RESET":
          updateData = {
            balance: 0,
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
            currentDayStarted: null,
            lastReconciliation: new Date(),
          };
          transactionAmount = oldBalance;
          transactionDescription = "Full float reset - balance set to 0";
          break;
        case "BALANCE_ONLY":
          updateData = { balance: newBalance };
          transactionAmount = Math.abs((newBalance ?? 0) - oldBalance);
          transactionDescription = `Balance-only float reset from ${formatCurrency(oldBalance)} to ${formatCurrency(newBalance ?? 0)}`;
          break;
        case "STATUS_ONLY":
          updateData = {
            isActiveForDay: false,
            canStartNewDay: true,
            pendingReconciliation: false,
            currentDayStarted: null,
            lastReconciliation: new Date(),
          };
          transactionAmount = 0;
          transactionDescription = "Status-only float reset";
          break;
      }

      await tx.userFloat.update({
        where: { id: userFloatId },
        data: updateData as any,
      });

      await tx.floatTransaction.create({
        data: {
          floatId: userFloat.id,
          type: TransactionType.OTHER,
          amount: transactionAmount,
          description: transactionDescription,
          performedByUserId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "FLOAT_RESET",
          entityType: "UserFloat",
          entityId: userFloatId,
          details: `${resetType}: ${reason}`,
        },
      });
    });

    revalidatePath("/dashboard/floats/reset");
    revalidatePath(`/dashboard/floats/users/${userFloat.userId}`);

    return NextResponse.json({
      success: true,
      message: `Float reset successful for ${userFloat.user.name}`,
    });
  } catch (error) {
    console.error("Error resetting float:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset float",
      },
      { status: 500 }
    );
  }
}
