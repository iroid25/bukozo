import { db } from "@/prisma/db";
import { NotificationType, UserRole } from "@prisma/client";
import type { MonthlyChargeRunResult } from "./voluntarySavingsMonthlyCharges";

const fmt = (n: number) => `UGX ${new Intl.NumberFormat("en-UG").format(n)}`;

export async function sendMonthlyChargeNotifications(result: MonthlyChargeRunResult) {
  if (result.dryRun || result.summary.charged === 0) return;

  const period = result.period;
  const chargedDetails = result.details.filter(
    (d) => d.status === "charged" || d.status === "dormant",
  );
  const chargedAccountIds = chargedDetails.map((d) => d.accountId);

  const summaryMessage =
    `Monthly service charges for ${period} have been processed. ` +
    `${result.summary.charged} account(s) charged, total ${fmt(result.summary.totalCharged)} deducted. ` +
    `${result.summary.skipped} account(s) skipped.`;

  // ── 1. Per-member notifications ─────────────────────────────────────────
  if (chargedAccountIds.length > 0) {
    const accounts = await db.account.findMany({
      where: { id: { in: chargedAccountIds } },
      select: {
        id: true,
        accountNumber: true,
        member: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    const memberRows = accounts
      .filter((a) => a.member?.userId)
      .map((a) => {
        const detail = chargedDetails.find((d) => d.accountId === a.id);
        const name = a.member?.user?.name || "Member";
        const charged = fmt(detail?.monthlyCharge ?? 0);
        const balance = fmt(detail?.balanceAfter ?? 0);
        return {
          userId: a.member!.userId!,
          type: NotificationType.IN_APP,
          subject: "Monthly Service Charge Deducted",
          message:
            `Dear ${name}, a monthly service charge of ${charged} has been deducted ` +
            `from your Voluntary Savings account ${a.accountNumber} for ${period}. ` +
            `Remaining balance: ${balance}.`,
        };
      });

    if (memberRows.length > 0) {
      await db.notification.createMany({ data: memberRows });
    }
  }

  // ── 2. Branch manager notifications ─────────────────────────────────────
  const branchManagers = await db.user.findMany({
    where: { role: UserRole.BRANCHMANAGER, isActive: true },
    select: { id: true },
  });

  if (branchManagers.length > 0) {
    await db.notification.createMany({
      data: branchManagers.map((u) => ({
        userId: u.id,
        type: NotificationType.IN_APP,
        subject: `Monthly Charges Processed — ${period}`,
        message: summaryMessage,
      })),
    });
  }

  // ── 3. Accountant notifications ──────────────────────────────────────────
  const accountants = await db.user.findMany({
    where: { role: UserRole.ACCOUNTANT, isActive: true },
    select: { id: true },
  });

  if (accountants.length > 0) {
    await db.notification.createMany({
      data: accountants.map((u) => ({
        userId: u.id,
        type: NotificationType.IN_APP,
        subject: `Monthly Charges Processed — ${period}`,
        message: summaryMessage,
      })),
    });
  }
}
