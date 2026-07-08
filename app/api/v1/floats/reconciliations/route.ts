import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { ReconciliationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/v1/floats/reconciliations?status=PENDING|APPROVED|REJECTED
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role !== "ACCOUNTANT" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const branchFilter = user.branchId
      ? { float: { user: { branchId: user.branchId } } }
      : {};

    const include = {
      float: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      reconciledByUser: {
        select: { id: true, name: true, email: true },
      },
    };

    const [pending, approved, rejected] = await Promise.all([
      db.floatReconciliation.findMany({
        where: { status: ReconciliationStatus.PENDING, ...branchFilter },
        include,
        orderBy: { reconciliationDate: "desc" },
      }),
      db.floatReconciliation.findMany({
        where: { status: ReconciliationStatus.APPROVED, ...branchFilter },
        include,
        orderBy: { approvalDate: "desc" },
        take: 50,
      }),
      db.floatReconciliation.findMany({
        where: { status: ReconciliationStatus.REJECTED, ...branchFilter },
        include,
        orderBy: { approvalDate: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { pending, approved, rejected },
    });
  } catch (error: any) {
    console.error("Error fetching float reconciliations:", error);
    return NextResponse.json({ error: "Failed to fetch reconciliations" }, { status: 500 });
  }
}
