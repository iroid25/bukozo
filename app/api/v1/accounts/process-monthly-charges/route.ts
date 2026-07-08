import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole } from "@prisma/client";
import {
  processVoluntarySavingsMonthlyCharges,
} from "@/lib/cron/voluntarySavingsMonthlyCharges";
import { sendMonthlyChargeNotifications } from "@/lib/cron/monthlyChargeNotifications";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

// POST /api/v1/accounts/process-monthly-charges
// Admin-only: deducts the monthly service fee from active voluntary savings accounts.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role?: string };
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Only admins can process monthly charges" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const now = new Date();
    const year = body.year ? Number(body.year) : now.getFullYear();
    const month = body.month ? Number(body.month) : now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "month must be 1-12" }, { status: 400 });
    }

    const result = await processVoluntarySavingsMonthlyCharges({
      year,
      month,
      dryRun,
      processedByUserId: user.id,
    });

    if (!dryRun) {
      await bumpAccountingSyncState("Monthly voluntary savings charges processed");
      revalidatePath("/dashboard/accounts");
      revalidatePath("/dashboard/reports/manager");
      revalidatePath("/dashboard/reports/savings");
      revalidatePath("/dashboard/reports/savings/dormant-accounts");
      revalidatePath("/dashboard/reports/savings/savings-listing");
      revalidatePath("/dashboard/reports/savings/savings-performance");
      await sendMonthlyChargeNotifications(result).catch((e) =>
        console.error("[process-monthly-charges] Notifications failed:", e),
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("process-monthly-charges error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process monthly charges" },
      { status: 500 },
    );
  }
}
