import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { TransactionStatus } from "@prisma/client";
import { RelworxPaymentService } from "@/services/relworx-payment.service";

export const dynamic = "force-dynamic";

const DEFAULT_POLL_AFTER_MS = 3 * 60 * 1000; // 3 minutes
const VERY_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 50;

/**
 * Catches mobile money transactions stuck PENDING because a webhook never arrived
 * (network blip, Relworx retry exhaustion, etc). Polls Relworx directly and runs
 * the same reconciliation path a webhook would.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (
      authHeader !== `Bearer ${cronSecret}` &&
      request.headers.get("x-cron-secret") !== cronSecret
    ) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const pollAfterMs = Number(process.env.RELWORX_STATUS_POLL_AFTER_MS ?? DEFAULT_POLL_AFTER_MS);
    const cutoff = new Date(Date.now() - pollAfterMs);

    const stale = await db.transaction.findMany({
      where: {
        channel: "MOBILE_MONEY",
        status: TransactionStatus.PENDING,
        externalReference: { not: null },
        transactionDate: { lt: cutoff },
      },
      take: BATCH_SIZE,
      orderBy: { transactionDate: "asc" },
    });

    const results: { transactionId: string; status: string; error?: string }[] = [];

    for (const tx of stale) {
      try {
        const outcome = await RelworxPaymentService.checkTransactionStatus(tx.externalReference!);
        results.push({ transactionId: tx.id, status: outcome.status });
      } catch (err) {
        console.warn(`[CRON] Relworx reconciliation poll failed for tx ${tx.id}: ${(err as Error).message}`);
        results.push({ transactionId: tx.id, status: "poll_failed", error: (err as Error).message });
        // do not mark as failed just because the status check itself errored — retry next cycle
      }
    }

    const veryStaleCutoff = new Date(Date.now() - VERY_STALE_MS);
    const veryStale = await db.transaction.count({
      where: {
        channel: "MOBILE_MONEY",
        status: TransactionStatus.PENDING,
        transactionDate: { lt: veryStaleCutoff },
      },
    });

    if (veryStale > 0) {
      // Deliberately not auto-mutated to FAILED — money may genuinely have moved.
      // Needs a human to reconcile against the Relworx dashboard.
      console.error(
        `[CRON] ${veryStale} mobile money transaction(s) have been PENDING for over 24h with no resolution — manual reconciliation required.`,
      );
    }

    return NextResponse.json({
      success: true,
      polled: stale.length,
      results,
      veryStalePendingCount: veryStale,
    });
  } catch (error) {
    console.error("[CRON] Relworx reconciliation internal error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
