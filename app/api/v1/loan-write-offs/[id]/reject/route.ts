import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as any;

    if (!["BRANCHMANAGER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Only managers can reject write-off requests" }, { status: 403 });
    }

    const { id: writeOffId } = await params;
    const { reason } = await request.json();

    const writeOff = await db.loanWriteOff.findUnique({
      where: { id: writeOffId },
      include: { loan: { include: { member: { include: { user: true } } } }, requestedBy: true },
    });

    if (!writeOff) return NextResponse.json({ success: false, error: "Write-off request not found" }, { status: 404 });
    if (writeOff.status !== "PENDING") return NextResponse.json({ success: false, error: "This write-off has already been processed" }, { status: 400 });

    await db.loanWriteOff.update({
      where: { id: writeOffId },
      data: { status: "REJECTED", approvedByUserId: user.id, approvedAt: new Date(), rejectionReason: reason },
    });

    await db.notification.create({
      data: {
        userId: writeOff.requestedByUserId, type: "IN_APP", subject: "Write-Off Request Rejected",
        message: `Your write-off request for ${writeOff.loan.member.user.name}'s loan has been rejected. Reason: ${reason}`,
        targetAddress: `/dashboard/loan-write-offs`, sentAt: new Date(), isRead: false, status: "SENT",
      },
    });

    return NextResponse.json({ success: true, message: "Write-off rejected successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
