import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

import { RescheduleStatus } from "@prisma/client";
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Only Loan Officers, Branch Managers, and Admins can request rescheduling
    const allowedRoles = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    const params = await props.params;
    const { id } = params;
    const body = await request.json();
    const { newDueDate, reason } = body;

    if (!newDueDate || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (newDueDate, reason)" },
        { status: 400 }
      );
    }

    // Try individual loan first, then institution loan — mirrors the same
    // dual-check pattern used by the disbursement route for a shared [id].
    const loan = await db.loan.findUnique({
      where: { id },
      include: {
        member: { include: { user: true } }
      }
    });

    let institutionLoan: any = null;
    if (!loan) {
      institutionLoan = await db.institutionLoan.findUnique({
        where: { id },
        include: { institution: { include: { user: true } } },
      });
    }

    if (!loan && !institutionLoan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 }
      );
    }

    const isInstitution = !!institutionLoan;
    const effectiveBranchId = isInstitution ? institutionLoan.institution.user.branchId : loan!.branchId;
    const oldDueDate = isInstitution ? institutionLoan.dueDate : loan!.dueDate;

    // Check access for branch manager
    if (user.role === "BRANCHMANAGER" && effectiveBranchId !== user.branchId) {
       return NextResponse.json(
        { success: false, error: "Access denied - Different branch" },
        { status: 403 }
      );
    }

    // Check if there is already a pending request
    const existingPending = await db.loanReschedule.findFirst({
        where: isInstitution
          ? { institutionLoanId: id, status: "PENDING" }
          : { loanId: id, status: "PENDING" }
    });

    if (existingPending) {
         return NextResponse.json(
        { success: false, error: "There is already a pending reschedule request for this loan." },
        { status: 400 }
      );
    }

    const reschedule = await db.loanReschedule.create({
      data: {
        loanId: isInstitution ? null : id,
        institutionLoanId: isInstitution ? id : null,
        oldDueDate,
        newDueDate: new Date(body.newDueDate),
        reason: body.reason,
        requestedById: user.id,
        status: RescheduleStatus.PENDING,

        village: body.village,
        parish: body.parish,
        county: body.county,
        spouseName: body.spouseName,
        spouseContact: body.spouseContact,
        spouseNIN: body.spouseNIN,
        rescheduleAmount: body.rescheduleAmount,
        reschedulePeriod: body.reschedulePeriod,
        securityType: body.securityType,
        securityDescription: body.securityDescription,
        securityPurchasePrice: body.securityPurchasePrice,
        securityCurrentPrice: body.securityCurrentPrice,
        securityValuation: body.securityValuation,
        forcedSaleValue: body.forcedSaleValue,
        guarantors: body.guarantors,
        officerComment: body.officerComment,
        loanOfficerId: body.loanOfficerId || null,
      },
    });

    await db.auditLog.create({
        data: {
            userId: user.id,
            action: "LOAN_RESCHEDULE_REQUEST",
            entityType: "LoanReschedule",
            entityId: reschedule.id,
            details: `Requested reschedule for ${isInstitution ? "institution " : ""}loan ${id}. New Due Date: ${newDueDate}, Reason: ${reason}`,
            timestamp: new Date()
        }
    })

    return NextResponse.json({ success: true, data: reschedule });
  } catch (error) {
    console.error("Reschedule error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
