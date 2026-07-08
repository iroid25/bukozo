import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { sendLoanReminderEmail } from "@/lib/email";
import { addDays, startOfDay, endOfDay, format } from "date-fns";

export const dynamic = "force-dynamic"; // Ensure this route is not cached

export async function GET(request: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Check if authorization header matches `Bearer <CRON_SECRET>`
    if (
      authHeader !== `Bearer ${cronSecret}` &&
      request.headers.get("x-cron-secret") !== cronSecret // Also check for custom header often used
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Calculate Target Date (Today + 5 days)
    const today = new Date();
    const targetDate = addDays(today, 5);
    const startOfTarget = startOfDay(targetDate);
    const endOfTarget = endOfDay(targetDate);

    console.log(
      `[CRON] Checking for loans due between ${startOfTarget} and ${endOfTarget}`
    );

    // 3. Query Loans
    const loansDue = await db.loan.findMany({
      where: {
        status: "DISBURSED",
        dueDate: {
          gte: startOfTarget,
          lte: endOfTarget,
        },
        outstandingBalance: {
          gt: 0,
        },
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
      },
    });

    console.log(`[CRON] Found ${loansDue.length} loans due in 5 days.`);

    if (loansDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No loans due in 5 days.",
        processed: 0,
      });
    }

    // 4. Send Notifications
    const results = await Promise.all(
      loansDue.map(async (loan) => {
        try {
          // A. In-App Notification
          await db.notification.create({
            data: {
              userId: loan.member.userId,
              type: "IN_APP",
              subject: "Loan Due in 5 Days",
              message: `Your loan (${
                loan.loanApplication.loanProduct.name
              }) is due on ${format(
                new Date(loan.dueDate),
                "MMM dd, yyyy"
              )}. Amount Due: UGX ${loan.outstandingBalance.toLocaleString()}`,
              targetAddress: `/dashboard/loans/${loan.id}`,
              sentAt: new Date(),
              isRead: false,
              status: "SENT",
            },
          });

          // B. Email Notification
          if (loan.member.user.email) {
            await sendLoanReminderEmail(
              loan.member.user.email,
              loan.member.user.name,
              loan.loanApplication.loanProduct.name,
              loan.outstandingBalance,
              format(new Date(loan.dueDate), "MMM dd, yyyy")
            );
          }

          return { loanId: loan.id, status: "sent" };
        } catch (err) {
          console.error(`[CRON] Failed to process reminder for loan ${loan.id}`, err);
          return { loanId: loan.id, status: "failed", error: String(err) };
        }
      })
    );

    const successCount = results.filter((r) => r.status === "sent").length;

    return NextResponse.json({
      success: true,
      message: `Processed reminders for ${successCount}/${loansDue.length} loans.`,
      processed: successCount,
      failed: loansDue.length - successCount,
    });
  } catch (error) {
    console.error("[CRON] Internal Server Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
