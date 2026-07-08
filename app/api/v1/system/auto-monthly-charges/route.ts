import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { processVoluntarySavingsMonthlyCharges } from "@/lib/cron/voluntarySavingsMonthlyCharges";
import { sendMonthlyChargeNotifications } from "@/lib/cron/monthlyChargeNotifications";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

export const dynamic = "force-dynamic";

// Roles that should trigger the auto-run check on dashboard load.
// MEMBER and INSTITUTION users are excluded — only staff trigger it.
const TRIGGER_ROLES = new Set(["ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "TELLER", "AGENT", "LOANOFFICER", "AUDITOR"]);

async function chargesAlreadyRunThisMonth(year: number, month: number): Promise<boolean> {
  const config = await db.systemConfiguration.findUnique({
    where: { key: "LAST_MONTHLY_CHARGE_DATE" },
  });
  if (!config?.value) return false;
  const last = new Date(config.value);
  return last.getFullYear() === year && last.getMonth() + 1 === month;
}

async function markChargesRunForMonth(year: number, month: number) {
  // Stamp the run date regardless of whether there were eligible accounts,
  // so the endpoint is never triggered again for this month.
  await db.systemConfiguration.upsert({
    where: { key: "LAST_MONTHLY_CHARGE_DATE" },
    create: {
      key: "LAST_MONTHLY_CHARGE_DATE",
      value: new Date().toISOString(),
      description: "Last time monthly charges were processed",
      category: "PERIODIC",
    },
    update: { value: new Date().toISOString() },
  });
}

// POST /api/v1/system/auto-monthly-charges
// Called silently from the dashboard on first load each month.
// Runs monthly charges if they have not yet been processed for the current month.
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user || !TRIGGER_ROLES.has(user.role)) {
      return NextResponse.json({ ran: false, reason: "not_applicable" }, { status: 200 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (await chargesAlreadyRunThisMonth(year, month)) {
      return NextResponse.json({ ran: false, reason: "already_run" }, { status: 200 });
    }

    const result = await processVoluntarySavingsMonthlyCharges({
      year,
      month,
      dryRun: false,
      processedByUserId: user.id,
    });

    // Always stamp the run date so this doesn't fire again this month
    await markChargesRunForMonth(year, month);

    if (!result.dryRun && result.summary.charged > 0) {
      await bumpAccountingSyncState("Auto monthly savings charges processed");
      await sendMonthlyChargeNotifications(result).catch((e) =>
        console.error("[auto-monthly-charges] Notifications failed:", e),
      );
    }

    return NextResponse.json({
      ran: true,
      summary: result.summary,
    }, { status: 200 });
  } catch (error: any) {
    // Fail silently — this is a background task; we never want it to break the UI
    console.error("[auto-monthly-charges] Error:", error?.message);
    return NextResponse.json({ ran: false, reason: "error" }, { status: 200 });
  }
}
