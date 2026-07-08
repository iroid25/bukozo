import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { RescheduleStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const allowedRoles = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "AUDITOR"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as RescheduleStatus | null;
    const loanId = searchParams.get("loanId");

    const where: any = {};
    if (status) where.status = status;
    if (loanId) where.loanId = loanId;
    
    // Branch Manager restriction
    if (user.role === "BRANCHMANAGER") {
        where.loan = { branchId: user.branchId };
    }
    // Loan Officer restriction (optional: can only see loans they manage? or all in branch? Usually all in branch or system depends on policy. Sticking to general view for now, usually LOs need to see their rescheduling history)
    
    const reschedules = await db.loanReschedule.findMany({
        where,
        include: {
            loan: {
                include: {
                    member: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    },
                    branch: {
                         select: { name: true }
                    }
                }
            },
            requestedBy: {
                select: {
                    name: true,
                    role: true
                }
            },
            approvedBy: {
                select: {
                    name: true,
                    role: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return NextResponse.json({ success: true, data: reschedules });
  } catch (error) {
    console.error("Fetch reschedules error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
