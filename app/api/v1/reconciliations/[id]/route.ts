import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { ReconciliationStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Reconciliation ID is required" }, { status: 400 });

    const reconciliation = await db.floatReconciliation.findUnique({
      where: { id },
      include: {
        float: {
          include: {
            user: {
              select: {
                id: true, name: true, email: true, phone: true, role: true, branchId: true,
                branch: { select: { id: true, name: true, location: true } },
              },
            },
          },
        },
        reconciledByUser: { select: { id: true, name: true, email: true, role: true, phone: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true, phone: true } },
      },
    });

    if (!reconciliation) {
      return NextResponse.json({ error: "Reconciliation not found" }, { status: 404 });
    }

    const TOLERANCE = 1000;
    const data = {
      ...reconciliation,
      hasOverage: reconciliation.difference > TOLERANCE,
      hasShortage: reconciliation.difference < -TOLERANCE,
      variancePercentage:
        reconciliation.systemBalance > 0
          ? ((reconciliation.difference / reconciliation.systemBalance) * 100).toFixed(2)
          : "0.00",
      varianceAmount: Math.abs(reconciliation.difference),
      isPending: reconciliation.status === ReconciliationStatus.PENDING,
      isApproved: reconciliation.status === ReconciliationStatus.APPROVED,
      isRejected: reconciliation.status === ReconciliationStatus.REJECTED,
      isUnderReview: reconciliation.status === ReconciliationStatus.UNDER_REVIEW,
      tellerName: reconciliation.float.user.name,
      tellerEmail: reconciliation.float.user.email,
      branchName: reconciliation.float.user.branch?.name || "N/A",
      branchLocation: reconciliation.float.user.branch?.location || "N/A",
      approverName: reconciliation.approvedBy?.name || null,
      totalPhysicalCash: reconciliation.actualCash,
      expectedAmount: reconciliation.systemBalance,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    return NextResponse.json({ error: "Failed to fetch reconciliation" }, { status: 500 });
  }
}
