// FILE: app/api/loan-repayment-requests/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, reason } = body;

    if (!token || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const repaymentRequest = await db.loanRepaymentRequest.findUnique({
      where: { approvalToken: token },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!repaymentRequest) {
      return NextResponse.json({ error: "Invalid request" }, { status: 404 });
    }

    if (repaymentRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `This request has already been ${repaymentRequest.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    // Update status
    await db.loanRepaymentRequest.update({
      where: { id: repaymentRequest.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Notify loan officer
    await db.notification.create({
      data: {
        userId: repaymentRequest.requestedByUserId,
        type: "IN_APP",
        subject: "Repayment Request Rejected",
        message: `${repaymentRequest.loan!.member.user.name} rejected the loan repayment request. Reason: ${reason}`,
        targetAddress: `/dashboard/loan-repayments`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    return NextResponse.json(
      { message: "Repayment request rejected" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error rejecting repayment:", error);
    return NextResponse.json(
      { error: "Failed to reject repayment request" },
      { status: 500 }
    );
  }
}
