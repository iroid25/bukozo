import { NextRequest, NextResponse } from "next/server";
import { ReconciliationStatus, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { getFloatOpeningBalanceSource } from "@/lib/float-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await db.floatReconciliation.findMany({
      where: {
        isEndOfDay: true,
        status: ReconciliationStatus.PENDING,
        float: user.branchId
          ? {
              user: {
                branchId: user.branchId,
              },
            }
          : undefined,
      },
      include: {
        float: {
          include: {
            user: {
              include: {
                branch: true,
              },
            },
          },
        },
        reconciledByUser: true,
      },
      orderBy: { reconciliationDate: "desc" },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching pending float reconciliations:", error);
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const floatId = body.floatId as string | undefined;
    const actualCashOnHand = Number(body.actualCashOnHand ?? body.actualCash ?? 0);
    const actualFloatAmount = Number(body.actualFloatAmount ?? body.floatToReturn ?? 0);
    const notes = body.notes ? String(body.notes).trim() : "";

    if (!floatId) {
      return NextResponse.json(
        { success: false, error: "Float ID is required" },
        { status: 400 }
      );
    }

    if (actualCashOnHand < 0 || actualFloatAmount < 0) {
      return NextResponse.json(
        { success: false, error: "Amounts cannot be negative" },
        { status: 400 }
      );
    }

    const userFloat = await db.userFloat.findUnique({
      where: { id: floatId },
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

    if (userFloat.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "You can only reconcile your own float" },
        { status: 403 }
      );
    }

    if (userFloat.pendingReconciliation) {
      return NextResponse.json(
        {
          success: false,
          error: "There is already a pending reconciliation awaiting approval.",
        },
        { status: 400 }
      );
    }

    const systemBalance = Number(userFloat.balance) || 0;
    const totalPhysical = actualCashOnHand + actualFloatAmount;
    const variance = totalPhysical - systemBalance;
    const tolerance = 1000;
    const isBalanced = Math.abs(variance) <= tolerance;
    const openingBalanceSource = await getFloatOpeningBalanceSource(userFloat.id);
    const dayStart = userFloat.currentDayStarted || new Date();
    const dayEnd = new Date();

    const result = await db.$transaction(async (tx) => {
      const reconciliation = await tx.floatReconciliation.create({
        data: {
          floatId: userFloat.id,
          reconciliationDate: new Date(),
          dayStart,
          dayEnd,
          systemBalance,
          actualCash: totalPhysical,
          cashOnHand: actualCashOnHand,
          floatReturned: actualFloatAmount,
          difference: variance,
          isBalanced,
          reconciledByUserId: user.id,
          status: ReconciliationStatus.PENDING,
          notes: notes || null,
          reconciliationType: "END_OF_DAY",
          isEndOfDay: true,
        },
      });

      await tx.userFloat.update({
        where: { id: userFloat.id },
        data: {
          pendingReconciliation: true,
          isActiveForDay: false,
          canStartNewDay: false,
        },
      });

      // Note: no FloatTransaction is logged here. Submission does not change
      // UserFloat.balance (that only happens at APPROVE, which logs the single
      // ledger entry for the zeroing). Logging here previously duplicated the
      // -systemBalance deduction in FloatTransaction, causing SUM(FloatTransaction.amount)
      // to diverge from the real UserFloat.balance for every reconciled teller.

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "EOD_RECONCILIATION_SUBMITTED",
          entityType: "FloatReconciliation",
          entityId: reconciliation.id,
          details: JSON.stringify({
            tellerName: userFloat.user.name,
            systemBalance,
            openingBalance: openingBalanceSource?.balance ?? systemBalance,
            actualCashOnHand,
            actualFloatAmount,
            totalPhysical,
            variance,
            isBalanced,
            dayStart,
            dayEnd,
            notes: notes || null,
          }),
        },
      });

      if (userFloat.user.branchId) {
        const accountants = await tx.user.findMany({
          where: {
            role: UserRole.ACCOUNTANT,
            branchId: userFloat.user.branchId,
            isActive: true,
          },
          select: { id: true },
        });

        for (const accountant of accountants) {
          await tx.notification.create({
            data: {
              userId: accountant.id,
              type: "IN_APP",
              subject: `EOD Reconciliation Request: ${userFloat.user.name}`,
              message: `${userFloat.user.name} submitted end-of-day reconciliation. Amount: UGX ${totalPhysical.toLocaleString()}. ${isBalanced ? "Balanced" : `Variance UGX ${Math.abs(variance).toLocaleString()}`}`,
              isRead: false,
            },
          });
        }
      }

      return reconciliation;
    });

    return NextResponse.json({
      success: true,
      message: "Reconciliation submitted successfully",
      data: {
        id: result.id,
        status: result.status,
        openingBalance: openingBalanceSource?.balance ?? systemBalance,
        systemBalance,
        actualCash: totalPhysical,
        difference: variance,
        isBalanced,
      },
    });
  } catch (error) {
    console.error("Error reconciling float:", error);
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
