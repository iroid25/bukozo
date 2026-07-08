import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  processVoluntarySavingsMonthlyCharges,
} from "@/lib/cron/voluntarySavingsMonthlyCharges";
import { sendMonthlyChargeNotifications } from "@/lib/cron/monthlyChargeNotifications";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

async function authorizeCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    // Validate against configured secret
    const tokenOk = authHeader === `Bearer ${cronSecret}`;
    const headerOk = request.headers.get("x-cron-secret") === cronSecret;
    return tokenOk || headerOk;
  }

  // No secret configured — accept Vercel's own cron invocation header as proof of origin
  return request.headers.get("x-vercel-cron") === "1";
}

async function currentMonthAlreadyCharged(year: number, month: number): Promise<boolean> {
  const config = await db.systemConfiguration.findUnique({
    where: { key: "LAST_MONTHLY_CHARGE_DATE" },
  });
  if (!config?.value) return false;

  const last = new Date(config.value);
  return last.getFullYear() === year && last.getMonth() + 1 === month;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorizeCron(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const year = body.year ? Number(body.year) : now.getFullYear();
    const month = body.month ? Number(body.month) : now.getMonth() + 1;
    const dryRun = !!body.dryRun;

    // Skip if this month has already been charged (self-healing: runs daily but only works once per month)
    if (!dryRun && await currentMonthAlreadyCharged(year, month)) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Monthly charges for ${year}-${String(month).padStart(2, "0")} already processed.`,
      });
    }

    const result = await processVoluntarySavingsMonthlyCharges({
      year,
      month,
      dryRun,
      processedByUserId: "SYSTEM",
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
        console.error("[CRON] Monthly charge notifications failed:", e),
      );
    }

    return NextResponse.json({
      success: true,
      message: "Monthly voluntary savings charges processed",
      ...result,
    });
  } catch (error) {
    console.error("[CRON] Monthly charges error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Monthly charges cron failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
