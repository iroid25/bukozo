import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { NotificationType } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if it's an individual or institution loan
    const [loanApp, instLoanApp] = await Promise.all([
      db.loanApplication.findUnique({
        where: { id },
        include: {
          loanProduct: true,
          member: { include: { user: true } },
          loanOfficer: true,
        },
      }),
      db.institutionLoanApplication.findUnique({
        where: { id },
        include: {
          loanProduct: true,
          institution: { include: { user: true } },
          loanOfficer: true,
        },
      }),
    ]);

    const app = loanApp || instLoanApp;
    const isInstitution = !!instLoanApp;

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const loanOfficerId = (app as any).loanOfficerId;
    if (!loanOfficerId) {
      return NextResponse.json({ error: "No loan officer assigned to this application" }, { status: 400 });
    }

    const officer = (app as any).loanOfficer;
    const applicantName = isInstitution 
      ? `🏢 ${(app as any).institution.institutionName}` 
      : (app as any).member.user.name;

    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(app.amountApplied);

    // Re-send notification to loan officer
    await db.notification.create({
      data: {
        userId: loanOfficerId,
        type: NotificationType.IN_APP,
        subject: "Action Required: Loan Application Assigned (Resent)",
        message: `${applicantName} has a ${app.loanProduct.name} loan of ${formattedAmount} assigned to you for processing.`,
        targetAddress: `/dashboard/loans/manager-loan-process-tracking?highlight=${app.id}`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    // Also notify the applicant again
    const applicantUserId = isInstitution ? (app as any).institution.user.id : (app as any).member.user.id;
    await db.notification.create({
      data: {
        userId: applicantUserId,
        type: NotificationType.IN_APP,
        subject: "Loan Application Update (Resent)",
        message: `Your ${app.loanProduct.name} loan of ${formattedAmount} is being processed by ${officer?.name || "a loan officer"}.`,
        targetAddress: isInstitution ? `/dashboard/institution/loans` : `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    return NextResponse.json({ message: "Notifications resent successfully" });
  } catch (error) {
    console.error("Error resending loan notification:", error);
    return NextResponse.json(
      { error: "Failed to resend notification" },
      { status: 500 }
    );
  }
}
